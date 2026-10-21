import { access } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createSportFixture } from './fixtures'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const actions = await import('@/features/club/actions')
const { getClubPlace, getCurrentBoard, getDonationInfo, getTrainingBySeries, getTransparency } = await import(
  '@/features/club/queries'
)
const { uploadsDir } = await import('@/features/media/files')
const { POST } = await import('@/app/api/admin/media/route')
const devMedia = await import('@/app/media/[...path]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

/** Un PDF mínimo válido: la firma `%PDF-` es lo que se revisa. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
  'latin1',
)

function upload(bytes: Buffer, name: string, type = 'application/pdf'): Promise<Response> {
  const body = new FormData()
  body.set('file', new Blob([new Uint8Array(bytes)], { type }), name)
  body.set('kind', 'document')
  return POST(new Request('http://localhost:3000/api/admin/media', { method: 'POST', body }))
}

async function uploadPdf(name = 'acta.pdf'): Promise<{ id: string; storageKey: string }> {
  const response = await upload(PDF, name)
  expect(response.status).toBe(201)
  const { data } = (await response.json()) as { data: { id: string; alt: string } }
  expect(data.alt).toBe(name)
  const [row] = await admin<
    { storage_key: string }[]
  >`select storage_key from media_assets where id = ${data.id}`
  return { id: data.id, storageKey: row?.storage_key ?? '' }
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  )

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

const documentInput = (fileMediaId: string, extra: Record<string, unknown> = {}) => ({
  title: 'Acta de asamblea',
  category: 'acta',
  periodLabel: '',
  documentDate: '2025-03-15',
  fileMediaId,
  description: '',
  isPublished: true,
  ...extra,
})

const memberInput = (fullName: string, extra: Record<string, unknown> = {}) => ({
  fullName,
  roleTitle: 'Presidenta',
  photoMediaId: '',
  publicEmail: 'Directiva@Cachorros.test',
  termStart: '2025-01-01',
  termEnd: '2026-12-31',
  isCurrent: true,
  sortOrder: '0',
  ...extra,
})

async function wipe() {
  await admin`delete from staff_assignments`
  await admin`delete from staff_members where full_name like 'Entrenador%'`
  await cleanSport(admin)
  await admin`delete from documents`
  await admin`delete from board_members`
  await admin`delete from media_assets where kind = 'documento' or storage_key = 'club-imagen'`
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

describe('subida de PDF (especificación 9.5)', () => {
  it('acepta un PDF por su firma y lo sirve con sandbox', async () => {
    const { id, storageKey } = await uploadPdf()
    const [row] = await admin<{ kind: string; mime: string; bytes: number }[]>`
      select kind, mime, bytes from media_assets where id = ${id}`
    expect(row).toEqual({ kind: 'documento', mime: 'application/pdf', bytes: PDF.byteLength })
    expect(await exists(path.join(uploadsDir(), storageKey, 'documento.pdf'))).toBe(true)

    const served = await devMedia.GET(new Request('http://localhost:3000'), {
      params: Promise.resolve({ path: [storageKey, 'documento.pdf'] }),
    })
    expect(served.headers.get('content-type')).toBe('application/pdf')
    expect(served.headers.get('content-security-policy')).toBe('sandbox')
    expect(served.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('rechaza lo que no es PDF aunque se llame .pdf', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } })
      .png()
      .toBuffer()
    const html = Buffer.from('<html><script>alert(1)</script></html>')
    for (const bytes of [png, html]) {
      const response = await upload(bytes, 'balance.pdf')
      expect(response.status).toBe(415)
      expect(await response.json()).toEqual({
        ok: false,
        message: 'Ese archivo no es un PDF. Los documentos se suben solo en PDF.',
      })
    }
  })

  it('sin permiso no sube', async () => {
    await actAs('prensa')
    expect((await upload(PDF, 'acta.pdf')).status).toBe(403)
  })
})

describe('documentos de transparencia', () => {
  it('publica, filtra por categoría y año, y no acepta una imagen como archivo', async () => {
    const acta = await uploadPdf('acta-2025.pdf')
    const balance = await uploadPdf('balance-2024.pdf')
    await idOf(actions.crearDocumento(documentInput(acta.id)))
    expect(invalidatedTags()).toContain('club')
    await idOf(
      actions.crearDocumento(
        documentInput(balance.id, { title: 'Balance 2024', category: 'balance', documentDate: '2024-12-31' }),
      ),
    )
    const draft = await uploadPdf('borrador.pdf')
    await idOf(actions.crearDocumento(documentInput(draft.id, { title: 'Borrador', isPublished: false })))

    const all = await getTransparency({ category: null, year: null })
    expect(all.documents.map((document) => document.title)).toEqual(['Acta de asamblea', 'Balance 2024'])
    expect(all.categories.sort()).toEqual(['acta', 'balance'])
    expect(all.years).toEqual([2025, 2024])
    expect(all.documents[0]?.url).toBe(`/media/${acta.storageKey}/documento.pdf`)
    expect((await getTransparency({ category: 'balance', year: null })).documents).toHaveLength(1)
    expect((await getTransparency({ category: null, year: 2025 })).documents.map((d) => d.title)).toEqual([
      'Acta de asamblea',
    ])

    const [image] = await admin<{ id: string }[]>`
      insert into media_assets (kind, storage_key, mime, bytes, alt_text)
      values ('imagen', 'club-imagen', 'image/jpeg', 10, 'Foto') returning id`
    expect(await actions.crearDocumento(documentInput(image?.id ?? ''))).toMatchObject({
      ok: false,
      fieldErrors: { fileMediaId: ['El archivo de un documento tiene que ser un PDF.'] },
    })
  })

  it('al reemplazar o eliminar, el PDF que queda sin uso se borra con sus archivos', async () => {
    const first = await uploadPdf('primero.pdf')
    const second = await uploadPdf('segundo.pdf')
    const id = await idOf(actions.crearDocumento(documentInput(first.id, { title: 'Memoria' })))
    await idOf(actions.actualizarDocumento(id, documentInput(second.id, { title: 'Memoria' })))
    const gone = await admin`select id from media_assets where id = ${first.id}`
    expect(gone).toHaveLength(0)
    expect(await exists(path.join(uploadsDir(), first.storageKey))).toBe(false)

    await idOf(actions.eliminarDocumento(id))
    expect(await admin`select id from media_assets where id = ${second.id}`).toHaveLength(0)
    expect(await exists(path.join(uploadsDir(), second.storageKey))).toBe(false)
  })
})

describe('directiva', () => {
  it('muestra solo a los vigentes, en orden, y guarda el correo en minúsculas', async () => {
    await idOf(actions.crearIntegrante(memberInput('Ana Rojas', { sortOrder: '1' })))
    await idOf(actions.crearIntegrante(memberInput('Berta Soto', { roleTitle: 'Tesorera', sortOrder: '0' })))
    const past = await idOf(actions.crearIntegrante(memberInput('Carla Díaz', { isCurrent: false })))
    expect(invalidatedTags()).toContain('club')

    const board = await getCurrentBoard()
    expect(board.map((member) => member.fullName)).toEqual(['Berta Soto', 'Ana Rojas'])
    expect(board[1]?.publicEmail).toBe('directiva@cachorros.test')

    expect(
      await actions.actualizarIntegrante(past, memberInput('Carla Díaz', { termEnd: '2024-01-01' })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { termEnd: ['El término del período no puede ser anterior al inicio.'] },
    })
  })
})

describe('horarios de entrenamiento', () => {
  it('por serie, de lunes a domingo; formativas trae a su cuerpo técnico de la temporada actual', async () => {
    const f = await createSportFixture(admin)
    const [youth] = await admin<{ id: string }[]>`
      insert into series (name, slug, short_name, kind, contains_minors, description)
      values ('Sub-12', 'sub-12', 'Sub-12', 'formativa', true, 'Nacidos en 2014 y 2015.') returning id`
    const youthId = youth?.id ?? ''
    const [venue] = await admin<{ id: string }[]>`
      insert into venues (name, is_home) values ('Cancha de prueba', true) returning id`
    const session = (seriesId: string, weekday: string, startsAt: string, endsAt: string) => ({
      seriesId,
      weekday,
      startsAt,
      endsAt,
      venueId: venue?.id ?? '',
      notes: '',
    })
    await idOf(actions.crearHorario(session(youthId, '4', '18:00', '19:15')))
    await idOf(actions.crearHorario(session(youthId, '2', '18:00', '19:15')))
    expect(invalidatedTags()).toContain('club')
    expect(await actions.crearHorario(session(youthId, '2', '19:00', '18:00'))).toMatchObject({
      ok: false,
      fieldErrors: { endsAt: ['El término tiene que ser después del inicio.'] },
    })
    const [coach] = await admin<{ id: string }[]>`
      insert into staff_members (full_name) values ('Entrenador Formativo') returning id`
    await admin`insert into staff_assignments (staff_id, season_id, series_id, role)
      values (${coach?.id ?? ''}, ${f.seasonId}, ${youthId}, 'director_tecnico')`

    const youthTraining = await getTrainingBySeries('youth')
    expect(youthTraining).toEqual([
      {
        slug: 'sub-12',
        name: 'Sub-12',
        description: 'Nacidos en 2014 y 2015.',
        sessions: [
          { weekday: 2, startsAt: '18:00', endsAt: '19:15', venueName: 'Cancha de prueba', notes: null },
          { weekday: 4, startsAt: '18:00', endsAt: '19:15', venueName: 'Cancha de prueba', notes: null },
        ],
        coaches: [{ name: 'Entrenador Formativo', role: 'director_tecnico' }],
      },
    ])
    // En La cancha van todas las series, pero solo las que tienen horario (Honor no tiene).
    expect((await getTrainingBySeries('all')).map((row) => row.slug)).toEqual(['sub-12'])
    await admin`delete from training_schedules`
    await admin`delete from venues where id = ${venue?.id ?? ''}`
  })
})

describe('la cancha y los aportes', () => {
  it('lee la dirección, las coordenadas y los datos de transferencia de Configuración', async () => {
    const [before] = await admin<
      { geo_lat: number | null; bank_details: unknown; donation_url: string | null }[]
    >`
      select geo_lat, bank_details, donation_url from site_settings where id = 1`
    try {
      await admin`update site_settings set geo_lat = -34.99, geo_lng = -71.38, address = 'Camino a la cancha s/n',
        bank_details = ${admin.json({ holder: 'Club', rut: '65.000.000-0', bank: 'Banco', accountType: 'Vista', accountNumber: '1' })},
        donation_url = '[COMPLETAR: link de pago]' where id = 1`
      expect(await getClubPlace()).toMatchObject({
        address: 'Camino a la cancha s/n',
        geo: { lat: -34.99, lng: -71.38 },
      })
      const donation = await getDonationInfo()
      expect(donation.transferText).toContain('Número de cuenta: 1')
      // Un marcador no es un link de pago.
      expect(donation.paymentUrl).toBeNull()
    } finally {
      await admin`update site_settings set geo_lat = ${before?.geo_lat ?? null},
        bank_details = ${before?.bank_details ? admin.json(before.bank_details as Record<string, string>) : null},
        donation_url = ${before?.donation_url ?? null} where id = 1`
    }
  })
})
