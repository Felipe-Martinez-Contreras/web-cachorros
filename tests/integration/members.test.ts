import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const actions = await import('@/features/members/actions')
const { actualizarMensaje } = await import('@/features/inbox/actions')
const exportRoute = await import('@/app/api/admin/exportar/[lista]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

const planInput = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  feeClp: '3000',
  feePeriod: 'mensual',
  benefits: 'Entrada liberada\n\n  Voto en la asamblea  ',
  isActive: true,
  sortOrder: '0',
  ...extra,
})

const memberInput = (fullName: string, extra: Record<string, unknown> = {}) => ({
  fullName,
  rut: '',
  email: '',
  phone: '',
  planId: '',
  status: 'activo',
  joinedOn: '2026-10-20',
  ...extra,
})

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function createRequest(fullName: string, planId: string | null = null): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into membership_requests (full_name, email, rut, plan_id, privacy_consent_at, privacy_policy_version)
    values (${fullName}, 'solicitante@correo.cl', '12.345.678-5', ${planId}, now(), 'v1')
    returning id`
  return row?.id ?? ''
}

async function wipe() {
  await admin`delete from membership_requests`
  await admin`delete from members`
  await admin`delete from membership_plans`
  await admin`delete from contact_messages`
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

describe('planes de socio', () => {
  it('crea un plan con un beneficio por línea e invalida la página Hazte socio', async () => {
    const id = await idOf(actions.crearPlan(planInput('Plan Integración')))
    const [row] = await admin<{ benefits: string[]; fee_clp: number }[]>`
      select benefits, fee_clp from membership_plans where id = ${id}`
    expect(row).toEqual({ benefits: ['Entrada liberada', 'Voto en la asamblea'], fee_clp: 3000 })
    expect(invalidatedTags()).toContain('membership')
  })

  it('no elimina un plan que tiene socios: propone desactivarlo', async () => {
    const planId = await idOf(actions.crearPlan(planInput('Plan Con Socios')))
    await idOf(actions.crearSocio(memberInput('Socio Del Plan', { planId })))
    const result = await actions.eliminarPlan(planId)
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('desactívalo') })
  })

  it('exige el permiso de socios', async () => {
    await actAs('prensa')
    expect(await actions.crearPlan(planInput('Plan Sin Permiso'))).toMatchObject({ ok: false })
  })
})

describe('padrón', () => {
  beforeEach(async () => {
    await admin`delete from membership_requests`
    await admin`delete from members`
  })

  it('asigna números correlativos, respeta un número dado a mano y rechaza uno repetido', async () => {
    await idOf(actions.crearSocio(memberInput('Primero')))
    await idOf(actions.crearSocio(memberInput('Histórico', { memberNumber: '40' })))
    await idOf(actions.crearSocio(memberInput('Siguiente', { rut: '12345678-5' })))
    const rows = await admin<{ full_name: string; member_number: number; rut: string | null }[]>`
      select full_name, member_number, rut from members order by member_number`
    expect(rows).toEqual([
      { full_name: 'Primero', member_number: 1, rut: null },
      { full_name: 'Histórico', member_number: 40, rut: null },
      { full_name: 'Siguiente', member_number: 41, rut: '12.345.678-5' },
    ])

    const repeated = await actions.crearSocio(memberInput('Repetido', { memberNumber: '40' }))
    expect(repeated).toMatchObject({
      ok: false,
      fieldErrors: { memberNumber: ['Ese número de socio ya está ocupado.'] },
    })
  })

  it('la auditoría guarda el número de socio, nunca el nombre, el RUT ni el correo', async () => {
    const id = await idOf(
      actions.crearSocio(memberInput('Nombre Privado', { rut: '12345678-5', email: 'privado@correo.cl' })),
    )
    const [entry] = await admin<{ summary: string; meta: Record<string, unknown> }[]>`
      select summary, meta from audit_log where entity_id = ${id} and action = 'member.create'`
    const text = JSON.stringify(entry)
    expect(entry?.summary).toBe('Dio de alta al socio N.º 1')
    expect(text).not.toContain('Nombre Privado')
    expect(text).not.toContain('12.345.678-5')
    expect(text).not.toContain('privado@correo.cl')
  })
})

describe('aprobar una solicitud', () => {
  beforeEach(async () => {
    await admin`delete from membership_requests`
    await admin`delete from members`
  })

  it('da de alta al socio con el número siguiente y deja la solicitud aprobada', async () => {
    await idOf(actions.crearSocio(memberInput('Socio Antiguo')))
    const requestId = await createRequest('Nueva Socia')
    await idOf(actions.aprobarSolicitudSocio(requestId))

    const [request] = await admin<{ status: string; member_number: number; full_name: string }[]>`
      select r.status, m.member_number, m.full_name
      from membership_requests r join members m on m.id = r.member_id where r.id = ${requestId}`
    expect(request).toEqual({ status: 'aprobada', member_number: 2, full_name: 'Nueva Socia' })

    expect(await actions.aprobarSolicitudSocio(requestId)).toMatchObject({
      ok: false,
      message: 'Esta solicitud ya fue aprobada.',
    })
  })

  it('dos aprobaciones simultáneas de la misma solicitud crean un solo socio', async () => {
    const requestId = await createRequest('Doble Clic')
    const results = await Promise.all([
      actions.aprobarSolicitudSocio(requestId),
      actions.aprobarSolicitudSocio(requestId),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(await admin`select id from members`).toHaveLength(1)
  })

  it('aprobaciones simultáneas de solicitudes distintas reciben números distintos y seguidos', async () => {
    const ids = await Promise.all(['Uno', 'Dos', 'Tres', 'Cuatro'].map((name) => createRequest(name)))
    const results = await Promise.all(ids.map((id) => actions.aprobarSolicitudSocio(id)))
    expect(results.every((result) => result.ok)).toBe(true)
    const numbers = await admin<{ member_number: number }[]>`
      select member_number from members order by member_number`
    expect(numbers.map((row) => row.member_number)).toEqual([1, 2, 3, 4])
  })

  it('«Aprobada» solo llega con el alta; una aprobada solo puede quedar así o archivarse', async () => {
    const pending = await createRequest('Pendiente')
    expect(
      await actions.actualizarSolicitudSocio(pending, { status: 'aprobada', internalNotes: '' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { status: [expect.stringContaining('Aprobar y dar de alta')] },
    })
    await idOf(
      actions.actualizarSolicitudSocio(pending, { status: 'en_revision', internalNotes: 'Llamar el lunes' }),
    )

    await idOf(actions.aprobarSolicitudSocio(pending))
    expect(
      await actions.actualizarSolicitudSocio(pending, { status: 'nueva', internalNotes: '' }),
    ).toMatchObject({ ok: false })
    await idOf(actions.actualizarSolicitudSocio(pending, { status: 'archivada', internalNotes: 'Listo' }))
  })
})

describe('mensajes de contacto', () => {
  it('cambia el estado y guarda las notas; no acepta estados de socio', async () => {
    const [row] = await admin<{ id: string }[]>`
      insert into contact_messages (name, email, topic, message)
      values ('Mensaje Integración', 'a@correo.cl', 'general', 'Hola') returning id`
    const id = row?.id ?? ''
    await idOf(actualizarMensaje(id, { status: 'respondida', internalNotes: 'Respondido por correo' }))
    expect(await actualizarMensaje(id, { status: 'aprobada', internalNotes: '' })).toMatchObject({
      ok: false,
    })
    const [saved] = await admin<{ status: string; internal_notes: string }[]>`
      select status, internal_notes from contact_messages where id = ${id}`
    expect(saved).toEqual({ status: 'respondida', internal_notes: 'Respondido por correo' })
  })
})

describe('GET /api/admin/exportar/[lista]', () => {
  const get = (lista: string) =>
    exportRoute.GET(new Request(`http://localhost:3000/api/admin/exportar/${lista}`), {
      params: Promise.resolve({ lista }),
    })

  it('descarga el padrón en CSV para Excel, neutraliza fórmulas y audita cuántas filas salieron', async () => {
    await admin`delete from members`
    await idOf(actions.crearSocio(memberInput('=HYPERLINK("https://malo.example")')))
    await idOf(actions.crearSocio(memberInput('Ñandú Pérez; hijo')))

    const response = await get('padron')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="padron-de-socios-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
    // `text()` descarta el BOM al decodificar: se revisan los bytes.
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    expect(text.startsWith('N.º;Nombre;RUT;')).toBe(true)
    expect(text).toContain(`1;"'=HYPERLINK(""https://malo.example"")";`)
    expect(text).toContain('2;"Ñandú Pérez; hijo";')

    const [entry] = await admin<{ meta: { rows: number }; summary: string }[]>`
      select meta, summary from audit_log where action = 'member.export' order by created_at desc limit 1`
    expect(entry?.meta).toEqual({ rows: 2 })
    expect(entry?.summary).not.toContain('Ñandú')
  })

  it('sin permiso responde 403 y una lista desconocida, 404', async () => {
    await actAs('prensa')
    expect((await get('padron')).status).toBe(403)
    await actAs('nadie')
    expect((await get('mensajes')).status).toBe(401)
    expect((await get('otra-cosa')).status).toBe(404)
  })
})
