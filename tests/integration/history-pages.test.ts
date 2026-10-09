import { asc, desc, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { db, sql } = await import('@/db/client')
const { auditLog, hallOfFame, historicKits, historyMilestones, honours, pageBlocks } = await import(
  '@/db/schema'
)
const history = await import('@/features/history/actions')
const { getHallOfFame, getHistoricKits, getHistoryAdmin, getHonours, getTimeline, listHistoryAdmin } =
  await import('@/features/history/queries')
const { guardarTextoDePagina } = await import('@/features/pages/actions')
const { getPageBlock, listPageBlocksAdmin } = await import('@/features/pages/queries')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

const milestone = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  year: '1934',
  month: '',
  day: '',
  body: '',
  imageMediaId: '',
  isPlaceholder: false,
  ...extra,
})
const idol = (fullName: string) => ({
  fullName,
  nickname: '',
  eraLabel: '',
  position: '',
  bio: '',
  photoMediaId: '',
})
const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

async function idOf(result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>) {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function wipe() {
  await admin.unsafe(`
    DELETE FROM history_milestones; DELETE FROM honours; DELETE FROM hall_of_fame;
    DELETE FROM historic_kits; DELETE FROM page_blocks;
    DELETE FROM media_assets WHERE storage_key LIKE 'historia-test-%';
  `)
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

describe('autorización', () => {
  it('sin sesión, sin permiso o con una sección que no existe no se escribe', async () => {
    for (const who of ['nadie', 'prensa'] as const) {
      await actAs(who)
      const message =
        who === 'nadie' ? 'Debes iniciar sesión para continuar.' : 'No tienes permiso para hacer esto.'
      for (const result of [
        await history.crearRegistroDeHistoria('hitos', milestone('No debe crearse')),
        await history.crearRegistroDeHistoria('salon-de-la-fama', idol('No debe crearse')),
        await guardarTextoDePagina('historia.intro', { title: '', body: doc('No debe guardarse') }),
      ]) {
        expect(result).toEqual({ ok: false, message })
      }
    }
    await actAs('admin')
    expect(await history.crearRegistroDeHistoria('constructor', milestone('Sección falsa'))).toEqual({
      ok: false,
      message: 'Esa sección de Historia no existe.',
    })
    expect(await db.select().from(historyMilestones)).toEqual([])
    expect(await db.select().from(pageBlocks)).toEqual([])
    expect(invalidatedTags()).toEqual([])
  })
})

describe('línea de tiempo', () => {
  it('guarda la fecha con su precisión, ordena por fecha y oculta la de un hito sin confirmar', async () => {
    const founded = await idOf(
      history.crearRegistroDeHistoria('hitos', milestone('Fundación del club', { month: '4', day: '1' })),
    )
    await idOf(
      history.crearRegistroDeHistoria(
        'hitos',
        milestone('Primer título', { year: '1950', isPlaceholder: true, body: 'Relato por confirmar.' }),
      ),
    )
    await idOf(
      history.crearRegistroDeHistoria('hitos', milestone('Cincuenta años', { year: '1984', month: '4' })),
    )
    expect(invalidatedTags().slice(-1)).toEqual(['history'])

    const [row] = await db.select().from(historyMilestones).where(eq(historyMilestones.id, founded))
    expect(row).toMatchObject({ occurredOn: '1934-04-01', datePrecision: 'dia', isPlaceholder: false })

    expect(await getTimeline()).toMatchObject([
      { title: 'Fundación del club', year: 1934, dateLabel: '1 de abril de 1934', isPlaceholder: false },
      { title: 'Primer título', year: 1950, dateLabel: null, isPlaceholder: true },
      { title: 'Cincuenta años', year: 1984, dateLabel: 'abril de 1984' },
    ])

    const [entry] = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(1)
    expect(entry).toMatchObject({ action: 'history_milestone.create', entityType: 'history_milestone' })
  })

  it('valida en español: título, año, día sin mes y fechas que no existen', async () => {
    expect(await history.crearRegistroDeHistoria('hitos', milestone('', { year: '1800' }))).toMatchObject({
      ok: false,
      fieldErrors: { title: ['Escribe el título del hito.'], year: ['Escribe un año entre 1900 y 2100.'] },
    })
    expect(
      await history.crearRegistroDeHistoria('hitos', milestone('Día sin mes', { day: '5' })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { month: ['Para indicar el día, elige también el mes.'] },
    })
    expect(
      await history.crearRegistroDeHistoria('hitos', milestone('30 de febrero', { month: '2', day: '30' })),
    ).toMatchObject({ ok: false, fieldErrors: { day: ['Ese día no existe en ese mes.'] } })
  })

  it('edita y elimina; un id que no existe se rechaza', async () => {
    const id = await idOf(
      history.crearRegistroDeHistoria('hitos', milestone('Para editar', { year: '2000' })),
    )
    await idOf(
      history.actualizarRegistroDeHistoria('hitos', id, milestone('Editado', { year: '2001', month: '6' })),
    )
    expect(await getHistoryAdmin('hitos', id)).toMatchObject({
      name: 'Editado',
      defaults: { title: 'Editado', year: '2001', month: '6', day: '' },
    })
    await idOf(history.eliminarRegistroDeHistoria('hitos', id))
    expect(await getHistoryAdmin('hitos', id)).toBeNull()
    expect(await history.eliminarRegistroDeHistoria('hitos', id)).toMatchObject({ ok: false })
    expect(await history.actualizarRegistroDeHistoria('hitos', id, milestone('Ya no existe'))).toMatchObject({
      ok: false,
    })
    expect(await history.actualizarRegistroDeHistoria('hitos', 'no-es-id', milestone('X'))).toMatchObject({
      ok: false,
    })
  })

  it('no acepta una foto marcada con menores', async () => {
    const [media] = await admin<{ id: string }[]>`
      insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors)
      values ('imagen', 'historia-test-menores', 'image/jpeg', 10, 'Foto de prueba', true) returning id`
    expect(
      await history.crearRegistroDeHistoria('hitos', milestone('Con foto', { imageMediaId: media?.id })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { imageMediaId: [expect.stringContaining('menores de edad')] },
    })
  })
})

describe('títulos, salón de la fama y camisetas', () => {
  it('los títulos salen del más reciente al más antiguo, con los sin año al final', async () => {
    const honour = (name: string, year: string) => ({
      name,
      year,
      seriesId: '',
      competitionName: 'Campeonato de prueba',
      description: '',
      imageMediaId: '',
    })
    await idOf(history.crearRegistroDeHistoria('titulos', honour('Título antiguo', '1960')))
    await idOf(history.crearRegistroDeHistoria('titulos', honour('Título sin año', '')))
    await idOf(history.crearRegistroDeHistoria('titulos', honour('Título reciente', '2019')))
    expect((await getHonours()).map((item) => item.name)).toEqual([
      'Título reciente',
      'Título antiguo',
      'Título sin año',
    ])
    expect((await listHistoryAdmin('titulos'))[0]).toMatchObject({
      title: 'Título reciente',
      subtitle: '2019 · Campeonato de prueba',
    })
    expect(await db.select().from(honours)).toHaveLength(3)
  })

  it('el salón de la fama se ordena con subir y bajar', async () => {
    const first = await idOf(history.crearRegistroDeHistoria('salon-de-la-fama', idol('Primero')))
    await idOf(history.crearRegistroDeHistoria('salon-de-la-fama', idol('Segundo')))
    const third = await idOf(history.crearRegistroDeHistoria('salon-de-la-fama', idol('Tercero')))
    const names = async () => (await getHallOfFame()).map((item) => item.fullName)
    expect(await names()).toEqual(['Primero', 'Segundo', 'Tercero'])

    await idOf(history.moverRegistroDeHistoria('salon-de-la-fama', third, 'subir'))
    expect(await names()).toEqual(['Primero', 'Tercero', 'Segundo'])
    await idOf(history.moverRegistroDeHistoria('salon-de-la-fama', first, 'bajar'))
    expect(await names()).toEqual(['Tercero', 'Primero', 'Segundo'])
    expect(await history.moverRegistroDeHistoria('salon-de-la-fama', third, 'subir')).toMatchObject({
      ok: false,
      message: 'Ya está en el extremo de la lista.',
    })
    // La línea de tiempo se ordena sola.
    expect(await history.moverRegistroDeHistoria('hitos', first, 'subir')).toMatchObject({ ok: false })

    const orders = await db
      .select({ sortOrder: hallOfFame.sortOrder })
      .from(hallOfFame)
      .orderBy(asc(hallOfFame.sortOrder))
    expect(orders.map((row) => row.sortOrder)).toEqual([10, 20, 30])
  })

  it('las camisetas muestran su período y validan los años', async () => {
    const kit = (description: string, yearFrom: string, yearTo: string) => ({
      description,
      yearFrom,
      yearTo,
      imageMediaId: '',
    })
    expect(await history.crearRegistroDeHistoria('camisetas', kit('Al revés', '1990', '1980'))).toMatchObject(
      {
        ok: false,
        fieldErrors: { yearTo: ['No puede ser anterior al año de inicio.'] },
      },
    )
    await idOf(history.crearRegistroDeHistoria('camisetas', kit('Negra con franja naranja', '1984', '1990')))
    await idOf(history.crearRegistroDeHistoria('camisetas', kit('Actual', '2020', '')))
    await idOf(history.crearRegistroDeHistoria('camisetas', kit('Sin fecha', '', '')))
    expect((await getHistoricKits()).map((item) => item.years)).toEqual(['1984 – 1990', 'Desde 2020', null])
    expect(await db.select().from(historicKits)).toHaveLength(3)
  })
})

describe('textos de páginas', () => {
  it('guarda por clave, reduce el texto a la lista blanca e invalida el tag pages', async () => {
    expect(await getPageBlock('historia.intro')).toBeNull()
    expect(await guardarTextoDePagina('no.existe', { title: '', body: doc('X') })).toEqual({
      ok: false,
      message: 'Ese texto no existe.',
    })
    expect(
      await guardarTextoDePagina('historia.intro', { title: 'Nuestra historia', body: null }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { body: ['Escribe el texto.'] },
    })

    await idOf(
      guardarTextoDePagina('historia.intro', { title: 'Nuestra historia', body: doc('Primer relato.') }),
    )
    expect(invalidatedTags().slice(-1)).toEqual(['pages'])
    expect(await getPageBlock('historia.intro')).toMatchObject({ title: 'Nuestra historia', images: {} })

    // Guardar de nuevo actualiza la misma fila.
    await idOf(guardarTextoDePagina('historia.intro', { title: '', body: doc('Relato corregido.') }))
    const rows = await db.select().from(pageBlocks)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'historia.intro', title: null })
    expect(JSON.stringify(rows[0]?.body)).toContain('Relato corregido.')

    const list = await listPageBlocksAdmin()
    expect(list.map((row) => row.key)).toContain('privacidad.politica')
    expect(list.find((row) => row.key === 'historia.intro')).toMatchObject({
      isEmpty: false,
      isPending: false,
    })
    expect(list.find((row) => row.key === 'socios.beneficios')).toMatchObject({ isEmpty: true })
  })
})
