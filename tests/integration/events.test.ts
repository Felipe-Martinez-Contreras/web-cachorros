import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const { proxySql } = await import('@/db/proxy-client')
const actions = await import('@/features/events/actions')
const { getEventDetail, getEventsPage, getUpcomingEvents, resolveEventRedirect } = await import(
  '@/features/events/queries'
)
const { eventSlugStatus } = await import('@/features/events/slug')
const icsRoute = await import('@/app/api/ics/evento/[id]/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

/** Fecha `AAAA-MM-DD` a `days` días de hoy (en UTC; basta para estar claramente antes o después). */
const dayFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

const eventInput = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  type: 'completada',
  startDate: dayFromNow(10),
  startTime: '13:00',
  endDate: '',
  endTime: '17:00',
  locationText: 'Sede social',
  venueId: '',
  posterMediaId: '',
  description: null,
  priceText: 'Completo $2.000',
  ctaUrl: '',
  status: 'programado',
  isPublished: true,
  ...extra,
})

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function wipe() {
  await admin`delete from events`
  await admin`delete from slug_redirects where entity_type = 'event'`
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
  await proxySql.end()
})

describe('acciones de eventos', () => {
  it('guarda la hora de pared de Santiago como instante e invalida los eventos', async () => {
    const id = await idOf(
      actions.crearEvento(eventInput('Completada de invierno', { startDate: '2026-07-04', endDate: '' })),
    )
    expect(invalidatedTags()).toContain('events')
    const [row] = await admin<{ starts_at: Date; ends_at: Date; slug: string }[]>`
      select starts_at, ends_at, slug from events where id = ${id}`
    // Julio: Chile continental está en UTC−4.
    expect(row?.starts_at.toISOString()).toBe('2026-07-04T17:00:00.000Z')
    expect(row?.ends_at.toISOString()).toBe('2026-07-04T21:00:00.000Z')
    expect(row?.slug).toBe('completada-de-invierno')
  })

  it('al renombrar, la dirección antigua redirige; un borrador no existe', async () => {
    const id = await idOf(actions.crearEvento(eventInput('Rifa')))
    await idOf(actions.actualizarEvento(id, eventInput('Rifa solidaria')))
    expect(await resolveEventRedirect('rifa')).toBe('rifa-solidaria')
    expect(await eventSlugStatus('rifa')).toEqual({ kind: 'moved', slug: 'rifa-solidaria' })
    expect(await eventSlugStatus('rifa-solidaria')).toEqual({ kind: 'found' })

    await idOf(actions.actualizarEvento(id, eventInput('Rifa solidaria', { isPublished: false })))
    expect(await eventSlugStatus('rifa-solidaria')).toEqual({ kind: 'missing' })
    expect(await getEventDetail('rifa-solidaria')).toBeNull()
  })

  it('rechaza una cancha que no existe', async () => {
    const result = await actions.crearEvento(
      eventInput('Sin cancha', { venueId: '00000000-0000-4000-8000-000000000000' }),
    )
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { venueId: ['Esa cancha ya no existe. Elige otra.'] },
    })
  })

  it('sin permiso no escribe', async () => {
    actAs('nadie')
    expect(await actions.crearEvento(eventInput('No'))).toMatchObject({ ok: false })
  })
})

describe('listado público', () => {
  it('próximos en orden ascendente y pasados en descendente; uno en curso sigue próximo', async () => {
    await wipe()
    await idOf(actions.crearEvento(eventInput('Bingo lejano', { startDate: dayFromNow(30) })))
    await idOf(actions.crearEvento(eventInput('Bingo cercano', { startDate: dayFromNow(3) })))
    await idOf(actions.crearEvento(eventInput('Aniversario', { startDate: dayFromNow(-60), endTime: '' })))
    await idOf(actions.crearEvento(eventInput('Asamblea', { startDate: dayFromNow(-5), endTime: '' })))
    // Empezó ayer y termina mañana: está en curso.
    await idOf(
      actions.crearEvento(
        eventInput('Campeonato de verano', {
          startDate: dayFromNow(-1),
          endDate: dayFromNow(1),
          endTime: '20:00',
        }),
      ),
    )
    // Marcado como realizado antes de su fecha: ya es pasado.
    await idOf(actions.crearEvento(eventInput('Completada adelantada', { status: 'realizado' })))
    await idOf(actions.crearEvento(eventInput('Borrador', { isPublished: false })))

    const { upcoming, past, page, totalPages } = await getEventsPage(1)
    expect(upcoming.map((event) => event.title)).toEqual([
      'Campeonato de verano',
      'Bingo cercano',
      'Bingo lejano',
    ])
    expect(past.map((event) => event.title)).toEqual(['Completada adelantada', 'Asamblea', 'Aniversario'])
    expect({ page, totalPages }).toEqual({ page: 1, totalPages: 1 })
    // La página pedida no pasa de la última.
    expect((await getEventsPage(7)).page).toBe(1)
    expect((await getUpcomingEvents(2)).map((event) => event.title)).toEqual([
      'Campeonato de verano',
      'Bingo cercano',
    ])
  })

  it('pagina los pasados de a 9', async () => {
    await wipe()
    for (let index = 1; index <= 10; index++) {
      await idOf(actions.crearEvento(eventInput(`Pasado ${index}`, { startDate: dayFromNow(-index - 1) })))
    }
    const first = await getEventsPage(1)
    expect(first.past).toHaveLength(9)
    expect(first.totalPages).toBe(2)
    const second = await getEventsPage(2)
    expect(second.past.map((event) => event.title)).toEqual(['Pasado 10'])
  })
})

describe('.ics de un evento', () => {
  it('descarga el evento con su duración; uno sin publicar no existe', async () => {
    const id = await idOf(
      actions.crearEvento(eventInput('Bingo, familiar; y solidario', { startDate: '2026-12-05' })),
    )
    const response = await icsRoute.GET(new Request('http://localhost:3000'), {
      params: Promise.resolve({ id }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    const body = await response.text()
    // Diciembre: Chile continental está en UTC−3.
    expect(body).toContain('DTSTART:20261205T160000Z')
    expect(body).toContain('DTEND:20261205T200000Z')
    expect(body).toContain('SUMMARY:Bingo\\, familiar\\; y solidario')
    expect(body).toContain('LOCATION:Sede social')

    await idOf(
      actions.actualizarEvento(id, eventInput('Bingo, familiar; y solidario', { isPublished: false })),
    )
    const hidden = await icsRoute.GET(new Request('http://localhost:3000'), {
      params: Promise.resolve({ id }),
    })
    expect(hidden.status).toBe(404)
  })
})
