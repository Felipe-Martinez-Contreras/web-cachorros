import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers } from './session'

const { sql } = await import('@/db/client')
const { buscarDatosPersonales, eliminarDatosPersonales } = await import('@/features/privacy/actions')
const { runRetention, ANONYMIZED_EMAIL } = await import('@/features/inbox/retention')
const exportRoute = await import('@/app/api/admin/datos-personales/exportar/route')
const dailyRoute = await import('@/app/api/cron/daily/route')
const { env } = await import('@/lib/env')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
const SITE = new URL(env.SITE_URL).origin

const ANA = { email: 'ana@correo.cl', rut: '12.345.678-5', phone: '+56987654321' }

async function wipe() {
  await admin`delete from membership_requests`
  await admin`delete from members`
  await admin`delete from sponsorship_inquiries`
  await admin`delete from contact_messages`
}

/** Ana tiene datos en las cuatro tablas; Beto, solo un mensaje (no debe tocarse). */
async function seedPeople() {
  await wipe()
  const [member] = await admin<{ id: string }[]>`
    insert into members (member_number, full_name, rut, email, phone_e164)
    values (7, 'Ana Pérez', ${ANA.rut}, ${ANA.email}, ${ANA.phone}) returning id`
  await admin`
    insert into membership_requests (full_name, email, rut, phone_e164, status, member_id, privacy_consent_at, privacy_policy_version)
    values ('Ana Pérez', ${ANA.email}, ${ANA.rut}, ${ANA.phone}, 'aprobada', ${member?.id ?? null}, now(), 'v1')`
  await admin`
    insert into sponsorship_inquiries (business_name, contact_name, email, phone_e164)
    values ('Almacén Ana', 'Ana Pérez', ${ANA.email}, null)`
  await admin`
    insert into contact_messages (name, email, phone_e164, topic, message) values
      ('Ana Pérez', 'otro@correo.cl', ${ANA.phone}, 'general', 'Hola desde mi celular'),
      ('Beto Soto', 'beto@correo.cl', null, 'general', 'Hola')`
}

beforeAll(async () => {
  await ensureTestUsers()
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await wipe()
  await admin.end()
  await sql.end()
})

describe('datos de una persona (derechos, 9.6)', () => {
  beforeEach(seedPeople)

  it('busca por correo, RUT o celular y cuenta dónde hay datos', async () => {
    const byEmail = await buscarDatosPersonales({ q: 'ANA@correo.cl' })
    expect(byEmail).toMatchObject({ ok: true, data: { kind: 'email', total: 3 } })
    const byPhone = await buscarDatosPersonales({ q: '9 8765 4321' })
    expect(byPhone.ok && byPhone.data.sources.map((entry) => entry.count)).toEqual([1, 1, 0, 1])
    expect(await buscarDatosPersonales({ q: 'Ana' })).toMatchObject({ ok: false })
  })

  it('exporta todo en JSON por POST desde el panel y lo audita sin el dato buscado', async () => {
    const body = new FormData()
    body.set('q', '12345678-5')
    const response = await exportRoute.POST(
      new Request(`${SITE}/api/admin/datos-personales/exportar`, {
        method: 'POST',
        body,
        headers: { origin: SITE },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toMatch(/datos-personales-\d{4}-\d{2}-\d{2}\.json/)
    const json = (await response.json()) as {
      buscadoPor: string
      registros: Record<string, { rut?: string }[]>
    }
    expect(json.buscadoPor).toBe('rut')
    expect(json.registros.members?.[0]?.rut).toBe(ANA.rut)
    expect(json.registros.membershipRequests).toHaveLength(1)

    const [entry] = await admin<{ meta: Record<string, unknown>; summary: string }[]>`
      select meta, summary from audit_log where action = 'personal_data.export' order by created_at desc limit 1`
    expect(entry?.meta).toEqual({ kind: 'rut', rows: 2 })
    expect(JSON.stringify(entry)).not.toContain('12.345.678')
  })

  it('la exportación rechaza otro origen y a quien no tiene el permiso', async () => {
    const request = (origin: string) => {
      const body = new FormData()
      body.set('q', ANA.email)
      return new Request(`${SITE}/api/admin/datos-personales/exportar`, {
        method: 'POST',
        body,
        headers: { origin },
      })
    }
    expect((await exportRoute.POST(request('https://otro.example'))).status).toBe(403)
    await actAs('prensa')
    expect((await exportRoute.POST(request(SITE))).status).toBe(403)
  })

  it('elimina sus solicitudes y mensajes, y en el padrón lo deja de baja sin datos; Beto sigue igual', async () => {
    const result = await eliminarDatosPersonales({ q: ANA.email })
    expect(result).toMatchObject({ ok: true })
    await eliminarDatosPersonales({ q: ANA.phone })

    expect(await admin`select id from membership_requests`).toHaveLength(0)
    expect(await admin`select id from sponsorship_inquiries`).toHaveLength(0)
    const messages = await admin<{ name: string }[]>`select name from contact_messages`
    expect(messages).toEqual([{ name: 'Beto Soto' }])
    const [member] = await admin<
      { member_number: number; full_name: string; rut: string | null; email: string | null; status: string }[]
    >`select member_number, full_name, rut, email, status from members`
    expect(member).toEqual({
      member_number: 7,
      full_name: 'Datos eliminados',
      rut: null,
      email: null,
      status: 'baja',
    })

    const [entry] = await admin<{ meta: Record<string, number | string> }[]>`
      select meta from audit_log where action = 'personal_data.erase' order by created_at asc limit 1`
    expect(entry?.meta).toEqual({
      kind: 'email',
      membershipRequests: 1,
      members: 1,
      sponsorshipInquiries: 1,
      contactMessages: 0,
    })
    expect(JSON.stringify(entry)).not.toContain('ana@')
  })

  it('sin datos que borrar, lo dice; sin permiso, no borra nada', async () => {
    expect(await eliminarDatosPersonales({ q: 'nadie@correo.cl' })).toMatchObject({
      ok: false,
      message: 'No encontramos datos de esa persona.',
    })
    await actAs('prensa')
    expect(await eliminarDatosPersonales({ q: ANA.email })).toMatchObject({ ok: false })
    expect(await admin`select id from membership_requests`).toHaveLength(1)
  })
})

describe('retención (tarea daily)', () => {
  const now = new Date('2026-10-20T12:00:00Z')

  beforeEach(async () => {
    await wipe()
    await admin`delete from audit_log where action = 'retencion.prueba'`
    await admin`
      insert into membership_requests (full_name, email, rut, status, created_at, privacy_consent_at, privacy_policy_version) values
        ('Cerrada Antigua', 'vieja@correo.cl', '12.345.678-5', 'rechazada', '2025-09-01', '2025-09-01', 'v1'),
        ('Abierta Antigua', 'abierta@correo.cl', null, 'en_revision', '2025-09-01', '2025-09-01', 'v1'),
        ('Cerrada Reciente', 'reciente@correo.cl', null, 'archivada', '2026-01-01', '2026-01-01', 'v1')`
    await admin`
      insert into sponsorship_inquiries (business_name, contact_name, email, status, created_at) values
        ('Almacén Viejo', 'Contacto Viejo', 'almacen@correo.cl', 'archivada', '2025-01-01')`
    await admin`
      insert into contact_messages (name, email, topic, message, created_at) values
        ('Mensaje Viejo', 'm1@correo.cl', 'general', 'Hola', '2025-10-19'),
        ('Mensaje Nuevo', 'm2@correo.cl', 'general', 'Hola', '2025-10-21')`
    await admin`
      insert into audit_log (action, created_at) values ('retencion.prueba', '2025-10-01'), ('retencion.prueba', '2026-10-01')`
  })

  it('anonimiza las solicitudes cerradas y borra mensajes y auditoría de más de 12 meses; es idempotente', async () => {
    expect(await runRetention(now)).toEqual({
      membershipRequests: 1,
      sponsorshipInquiries: 1,
      contactMessages: 1,
      auditLog: 1,
    })
    const requests = await admin<{ full_name: string; email: string; rut: string | null }[]>`
      select full_name, email, rut from membership_requests order by full_name`
    expect(requests).toEqual([
      { full_name: 'Abierta Antigua', email: 'abierta@correo.cl', rut: null },
      { full_name: 'Cerrada Reciente', email: 'reciente@correo.cl', rut: null },
      { full_name: 'Datos eliminados', email: ANONYMIZED_EMAIL, rut: null },
    ])
    const [inquiry] = await admin<{ business_name: string; contact_name: string }[]>`
      select business_name, contact_name from sponsorship_inquiries`
    expect(inquiry).toEqual({ business_name: 'Almacén Viejo', contact_name: 'Datos eliminados' })
    expect(await admin`select name from contact_messages`).toEqual([{ name: 'Mensaje Nuevo' }])
    expect(await admin`select id from audit_log where action = 'retencion.prueba'`).toHaveLength(1)

    expect(await runRetention(now)).toEqual({
      membershipRequests: 0,
      sponsorshipInquiries: 0,
      contactMessages: 0,
      auditLog: 0,
    })
  })

  it('GET /api/cron/daily exige el Bearer de CRON_SECRET', async () => {
    const call = (authorization?: string) =>
      dailyRoute.GET(
        new Request(`${SITE}/api/cron/daily`, { headers: authorization ? { authorization } : {} }),
      )
    expect((await call()).status).toBe(401)
    expect((await call('Bearer otro')).status).toBe(401)
    const response = await call(`Bearer ${env.CRON_SECRET}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      retention: { contactMessages: expect.any(Number) },
    })
  })
})
