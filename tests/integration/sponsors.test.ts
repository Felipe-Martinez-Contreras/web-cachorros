import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const actions = await import('@/features/sponsors/actions')
const { getClicksReport } = await import('@/features/sponsors/admin-queries')
const clickRoute = await import('@/app/r/auspiciador/[slug]/route')
const exportRoute = await import('@/app/api/admin/exportar/[lista]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

const sponsorInput = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  tier: 'oficial',
  logoMediaId: '',
  description: '',
  websiteUrl: 'https://roble.example/inicio',
  instagramUrl: '',
  whatsapp: '+56 9 1234 5678',
  startsOn: '',
  endsOn: '',
  isActive: true,
  sortOrder: '0',
  ...extra,
})

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

function click(slug: string, query = '', init: RequestInit = {}) {
  return clickRoute.GET(new Request(`http://localhost:3000/r/auspiciador/${slug}${query}`, init), {
    params: Promise.resolve({ slug }),
  })
}

const clicksOf = async (sponsorId: string) => {
  const rows = await admin<{ clicks: number }[]>`
    select clicks from sponsor_clicks_daily where sponsor_id = ${sponsorId}`
  return rows.reduce((sum, row) => sum + row.clicks, 0)
}

async function wipe() {
  await admin`delete from sponsors`
  await admin`delete from sponsorship_inquiries`
}

beforeAll(async () => {
  await wipe()
  await ensureTestUsers()
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await wipe()
  await admin.end()
  await sql.end()
})

describe('acciones de auspiciadores', () => {
  it('crea con un slug que no cambia al renombrar, e invalida la vitrina', async () => {
    const id = await idOf(actions.crearAuspiciador(sponsorInput('Ferretería El Roble')))
    expect(invalidatedTags()).toContain('sponsors')
    await idOf(actions.actualizarAuspiciador(id, sponsorInput('Ferretería El Roble Ltda.')))
    const [row] = await admin<{ slug: string; whatsapp_e164: string }[]>`
      select slug, whatsapp_e164 from sponsors where id = ${id}`
    expect(row).toEqual({ slug: 'ferreteria-el-roble', whatsapp_e164: '+56912345678' })
  })

  it('rechaza una vigencia que termina antes de empezar', async () => {
    const result = await actions.crearAuspiciador(
      sponsorInput('Vigencia Mala', { startsOn: '2026-05-01', endsOn: '2026-04-01' }),
    )
    expect(result).toMatchObject({ ok: false, fieldErrors: { endsOn: [expect.any(String)] } })
  })

  it('exige el permiso de auspiciadores', async () => {
    await actAs('prensa')
    expect(await actions.crearAuspiciador(sponsorInput('Sin Permiso'))).toMatchObject({ ok: false })
  })
})

describe('GET /r/auspiciador/[slug]', () => {
  let sponsorId = ''

  beforeAll(async () => {
    await actAs('admin')
    sponsorId = await idOf(actions.crearAuspiciador(sponsorInput('Panadería La Espiga')))
  })

  beforeEach(async () => {
    await admin`delete from sponsor_clicks_daily`
  })

  it('suma el clic del día y redirige al enlace pedido con 302', async () => {
    const web = await click('panaderia-la-espiga', '?a=web')
    expect(web.status).toBe(302)
    expect(web.headers.get('location')).toBe('https://roble.example/inicio')
    expect(web.headers.get('cache-control')).toBe('no-store')

    const whatsapp = await click('panaderia-la-espiga', '?a=whatsapp')
    expect(whatsapp.headers.get('location')).toBe('https://wa.me/56912345678')
    expect(await clicksOf(sponsorId)).toBe(2)

    const [row] = await admin<{ day: string }[]>`
      select day::text as day from sponsor_clicks_daily where sponsor_id = ${sponsorId}`
    expect(row?.day).toBe(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()),
    )
  })

  it('clics simultáneos se cuentan todos (upsert atómico)', async () => {
    await Promise.all(Array.from({ length: 10 }, () => click('panaderia-la-espiga')))
    expect(await clicksOf(sponsorId)).toBe(10)
  })

  it('una precarga o un HEAD no cuentan', async () => {
    await click('panaderia-la-espiga', '', { headers: { 'sec-purpose': 'prefetch' } })
    await clickRoute.HEAD(
      new Request('http://localhost:3000/r/auspiciador/panaderia-la-espiga', { method: 'HEAD' }),
      {
        params: Promise.resolve({ slug: 'panaderia-la-espiga' }),
      },
    )
    expect(await clicksOf(sponsorId)).toBe(0)
  })

  it('un auspiciador vencido, oculto o inexistente vuelve a la vitrina sin contar', async () => {
    await idOf(actions.crearAuspiciador(sponsorInput('Auspicio Vencido', { endsOn: '2020-12-31' })))
    for (const slug of ['auspicio-vencido', 'no-existe']) {
      const response = await click(slug)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/auspiciadores')
    }
    expect(await admin`select 1 from sponsor_clicks_daily`).toHaveLength(0)
  })
})

describe('reporte mensual de clics', () => {
  it('suma por auspiciador y por día del mes pedido, y se descarga en CSV auditado', async () => {
    await admin`delete from sponsor_clicks_daily`
    const [espiga] = await admin<{ id: string }[]>`select id from sponsors where slug = 'panaderia-la-espiga'`
    const [roble] = await admin<{ id: string }[]>`select id from sponsors where slug = 'ferreteria-el-roble'`
    await admin`
      insert into sponsor_clicks_daily (sponsor_id, day, clicks) values
        (${espiga?.id ?? ''}, '2026-09-30', 7),
        (${espiga?.id ?? ''}, '2026-10-01', 3),
        (${espiga?.id ?? ''}, '2026-10-31', 2),
        (${roble?.id ?? ''}, '2026-10-15', 9)`

    const report = await getClicksReport('2026-10')
    expect(report.total).toBe(14)
    expect(report.sponsors.map((entry) => [entry.name, entry.total])).toEqual([
      ['Ferretería El Roble Ltda.', 9],
      ['Panadería La Espiga', 5],
    ])
    expect(report.sponsors[1]?.days).toEqual([
      { day: '2026-10-01', clicks: 3 },
      { day: '2026-10-31', clicks: 2 },
    ])

    const response = await exportRoute.GET(
      new Request('http://localhost:3000/api/admin/exportar/clics-auspiciadores?mes=2026-10'),
      { params: Promise.resolve({ lista: 'clics-auspiciadores' }) },
    )
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="clics-auspiciadores-2026-10.csv"',
    )
    const text = await response.text()
    expect(text).toContain('Panadería La Espiga;2026-10-31;2')
    expect(text).not.toContain('2026-09-30')
    const [entry] = await admin<{ meta: { rows: number } }[]>`
      select meta from audit_log where action = 'sponsor.export' order by created_at desc limit 1`
    expect(entry?.meta).toEqual({ rows: 3 })
  })
})
