import { and, asc, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch } from './fixtures'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { db, sql } = await import('@/db/client')
const schema = await import('@/db/schema')
const {
  auditLog,
  players,
  seasons,
  series,
  slugRedirects,
  squadRegistrations,
  staffAssignments,
  teams,
  venues,
} = schema
const seriesActions = await import('@/features/series/actions')
const teamActions = await import('@/features/teams/actions')
const playerActions = await import('@/features/players/actions')
const staffActions = await import('@/features/staff/actions')
const { getPlayerAdmin, listPlayersAdmin } = await import('@/features/players/queries')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

const serieInput = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  shortName: name,
  kind: 'adulta',
  halfLengthMinutes: '45',
  containsMinors: false,
  isActive: true,
  description: '',
  ...extra,
})

const playerInput = (firstName: string, lastName: string, extra: Record<string, unknown> = {}) => ({
  firstName,
  lastName,
  nickname: '',
  birthDate: '',
  primaryPosition: 'delantero',
  positionDetail: '',
  photoMediaId: '',
  isActive: true,
  imageConsent: false,
  ...extra,
})

/** Desempaqueta el id de una acción que debía salir bien (o muestra por qué falló). */
async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function wipe() {
  await admin`delete from staff_assignments`
  await admin`delete from staff_members`
  await cleanSport(admin)
  await admin`delete from venues`
  await admin`delete from slug_redirects`
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

describe('autorización de los catálogos', () => {
  it('sin sesión o sin permiso no se escribe ni se audita', async () => {
    const before = (await db.select().from(auditLog)).length
    await actAs('nadie')
    expect(await seriesActions.crearSerie(serieInput('Sin sesión'))).toEqual({
      ok: false,
      message: 'Debes iniciar sesión para continuar.',
    })
    await actAs('prensa')
    for (const result of [
      await seriesActions.crearSerie(serieInput('Sin permiso')),
      await teamActions.crearRival({ name: 'Sin permiso', shortName: 'SP', commune: '', crestMediaId: '' }),
      await playerActions.crearJugador(playerInput('Sin', 'Permiso', { seriesId: '', shirtNumber: '' })),
      await staffActions.crearIntegrante({ fullName: 'Sin Permiso', photoMediaId: '', bio: '' }),
    ]) {
      expect(result).toEqual({ ok: false, message: 'No tienes permiso para hacer esto.' })
    }
    expect(await db.select().from(series)).toEqual([])
    expect((await db.select().from(auditLog)).length).toBe(before)
    expect(invalidatedTags()).toEqual([])
  })
})

describe('series', () => {
  it('crea con slug y orden, valida en español y audita', async () => {
    const invalid = await seriesActions.crearSerie(serieInput('', { halfLengthMinutes: '90' }))
    expect(invalid).toMatchObject({
      ok: false,
      fieldErrors: {
        name: ['Escribe el nombre de la serie.'],
        halfLengthMinutes: ['Cada tiempo dura entre 5 y 60 minutos.'],
      },
    })

    const honor = await idOf(seriesActions.crearSerie(serieInput('Honor')))
    const segunda = await idOf(seriesActions.crearSerie(serieInput('Segunda')))
    const tercera = await idOf(seriesActions.crearSerie(serieInput('Tercera', { halfLengthMinutes: 40 })))
    const rows = await db.select().from(series).orderBy(asc(series.sortOrder))
    expect(rows.map((row) => [row.slug, row.sortOrder])).toEqual([
      ['honor', 10],
      ['segunda', 20],
      ['tercera', 30],
    ])
    expect(rows[2]?.halfLengthMinutes).toBe(40)
    expect(invalidatedTags()).toEqual(expect.arrayContaining(['matches', 'players']))

    const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, honor))
    expect(entry).toMatchObject({ action: 'series.create', summary: 'Creó la serie Honor' })

    // Subir y bajar con botones.
    expect((await seriesActions.moverSerie(tercera, 'subir')).ok).toBe(true)
    expect((await seriesActions.moverSerie(honor, 'subir')).ok).toBe(false)
    const reordered = await db.select({ id: series.id }).from(series).orderBy(asc(series.sortOrder))
    expect(reordered.map((row) => row.id)).toEqual([honor, tercera, segunda])
  })

  it('al renombrar cambia el slug y deja la redirección del anterior', async () => {
    const [row] = await db.select().from(series).where(eq(series.slug, 'segunda'))
    const id = row?.id ?? ''
    expect((await seriesActions.actualizarSerie(id, serieInput('Segunda Adultos'))).ok).toBe(true)
    const [updated] = await db.select().from(series).where(eq(series.id, id))
    expect(updated?.slug).toBe('segunda-adultos')
    const redirects = await db.select().from(slugRedirects).where(eq(slugRedirects.entityId, id))
    expect(redirects).toMatchObject([{ entityType: 'series', oldSlug: 'segunda' }])
  })

  it('no elimina una serie con datos (pide desactivarla) y sí una vacía', async () => {
    const [honor] = await db.select().from(series).where(eq(series.slug, 'honor'))
    const [season] = await db
      .insert(seasons)
      .values({ name: 'Temporada 2026', year: 2026, isCurrent: true })
      .returning()
    const player = await idOf(
      playerActions.crearJugador(playerInput('Con', 'Datos', { seriesId: honor?.id, shirtNumber: '9' })),
    )
    expect(player).not.toBe('')
    expect(season).toBeDefined()

    const blocked = await seriesActions.eliminarSerie(honor?.id ?? '')
    expect(blocked).toEqual({
      ok: false,
      message: 'No se puede eliminar porque tiene datos asociados. Si ya no se usa, desactívalo.',
    })
    const [tercera] = await db.select().from(series).where(eq(series.slug, 'tercera'))
    expect((await seriesActions.eliminarSerie(tercera?.id ?? '')).ok).toBe(true)
    expect(await seriesActions.eliminarSerie('no-es-un-id')).toEqual({
      ok: false,
      message: 'No encontramos esa serie.',
    })
  })
})

describe('temporadas', () => {
  it('solo una es la actual: marcar otra desmarca la anterior', async () => {
    const next = await idOf(
      seriesActions.crearTemporada({
        name: 'Temporada 2027',
        year: '2027',
        startsOn: '',
        endsOn: '',
        isCurrent: true,
      }),
    )
    const current = await db.select().from(seasons).where(eq(seasons.isCurrent, true))
    expect(current.map((row) => row.id)).toEqual([next])

    const dup = await seriesActions.crearTemporada({
      name: 'Temporada 2027',
      year: 2027,
      startsOn: '2027-03-01',
      endsOn: '2027-01-01',
      isCurrent: false,
    })
    expect(dup).toMatchObject({
      ok: false,
      fieldErrors: { endsOn: ['El término no puede ser anterior al inicio.'] },
    })
    const sameName = await seriesActions.crearTemporada({
      name: 'Temporada 2027',
      year: 2027,
      startsOn: '',
      endsOn: '',
      isCurrent: false,
    })
    expect(sameName).toMatchObject({
      ok: false,
      fieldErrors: { name: ['Ya existe una temporada con ese nombre.'] },
    })
  })

  it('copia el plantel y el cuerpo técnico sin las bajas, y repetir no duplica', async () => {
    const [from] = await db.select().from(seasons).where(eq(seasons.name, 'Temporada 2026'))
    const [to] = await db.select().from(seasons).where(eq(seasons.name, 'Temporada 2027'))
    const [honor] = await db.select().from(series).where(eq(series.slug, 'honor'))
    const fromId = from?.id ?? ''
    const toId = to?.id ?? ''
    const honorId = honor?.id ?? ''

    // 2026: «Con Datos» (#9, de la prueba anterior), un capitán y una baja.
    const captain = await idOf(
      playerActions.crearJugador(playerInput('Capi', 'Tán', { seriesId: '', shirtNumber: '' })),
    )
    const gone = await idOf(
      playerActions.crearJugador(playerInput('De', 'Baja', { seriesId: '', shirtNumber: '' })),
    )
    const reg = (playerId: string, extra: Record<string, unknown>) =>
      playerActions.inscribirJugador(playerId, {
        seasonId: fromId,
        seriesId: honorId,
        shirtNumber: '',
        isCaptain: false,
        status: 'activo',
        ...extra,
      })
    await idOf(reg(captain, { shirtNumber: '5', isCaptain: true }))
    await idOf(reg(gone, { shirtNumber: '7', status: 'baja' }))
    const dt = await idOf(
      staffActions.crearIntegrante({ fullName: 'Profe Ejemplo', photoMediaId: '', bio: '' }),
    )
    await idOf(
      staffActions.asignarIntegrante(dt, { seasonId: fromId, seriesId: honorId, role: 'director_tecnico' }),
    )

    expect((await seriesActions.copiarPlantel(toId, { fromSeasonId: toId })).ok).toBe(false)
    expect((await seriesActions.copiarPlantel(toId, { fromSeasonId: fromId })).ok).toBe(true)
    expect((await seriesActions.copiarPlantel(toId, { fromSeasonId: fromId })).ok).toBe(true)

    const copied = await db
      .select()
      .from(squadRegistrations)
      .where(eq(squadRegistrations.seasonId, toId))
      .orderBy(asc(squadRegistrations.shirtNumber))
    expect(copied.map((row) => [row.shirtNumber, row.isCaptain, row.status])).toEqual([
      [5, true, 'activo'],
      [9, false, 'activo'],
    ])
    expect(await db.select().from(staffAssignments).where(eq(staffAssignments.seasonId, toId))).toHaveLength(
      1,
    )

    const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, 'season.copy-squad'))
    expect(entry?.meta).toMatchObject({ players: 2, staff: 1 })
  })
})

describe('jugadores e inscripciones', () => {
  it('no permite repetir la inscripción ni el número de camiseta en la misma serie', async () => {
    const [season] = await db.select().from(seasons).where(eq(seasons.name, 'Temporada 2026'))
    const [honor] = await db.select().from(series).where(eq(series.slug, 'honor'))
    const [nine] = await db
      .select({ playerId: squadRegistrations.playerId })
      .from(squadRegistrations)
      .where(and(eq(squadRegistrations.seasonId, season?.id ?? ''), eq(squadRegistrations.shirtNumber, 9)))
    const base = { seasonId: season?.id, seriesId: honor?.id, isCaptain: false, status: 'activo' }

    expect(
      await playerActions.inscribirJugador(nine?.playerId ?? '', { ...base, shirtNumber: '' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { seriesId: ['Ya está inscrito en esa serie y temporada.'] },
    })
    const other = await idOf(
      playerActions.crearJugador(playerInput('Otro', 'Nueve', { seriesId: '', shirtNumber: '' })),
    )
    expect(await playerActions.inscribirJugador(other, { ...base, shirtNumber: '9' })).toMatchObject({
      ok: false,
      fieldErrors: { shirtNumber: ['Ese número ya lo usa otro jugador de la serie en esa temporada.'] },
    })
    expect(await playerActions.inscribirJugador(other, { ...base, shirtNumber: '100' })).toMatchObject({
      ok: false,
      fieldErrors: { shirtNumber: ['El número de camiseta va entre 1 y 99.'] },
    })
    expect((await playerActions.inscribirJugador(other, { ...base, shirtNumber: '19' })).ok).toBe(true)
  })

  it('marca como menor al juvenil por edad o por serie, y la lista filtra por serie', async () => {
    const [season] = await db.select().from(seasons).where(eq(seasons.isCurrent, true))
    const juvenil = await idOf(
      seriesActions.crearSerie(serieInput('Juvenil', { kind: 'juvenil', containsMinors: true })),
    )
    const [honor] = await db.select().from(series).where(eq(series.slug, 'honor'))
    const year = new Date().getFullYear()

    // Sin fecha de nacimiento, inscrito en una serie con menores.
    const bySeries = await idOf(
      playerActions.crearJugador(playerInput('Pedro', 'Juvenil', { seriesId: juvenil })),
    )
    // Con 16 años, inscrito solo en una serie adulta.
    const byAge = await idOf(
      playerActions.crearJugador(
        playerInput('Tomás', 'Promesa', { birthDate: `${year - 16}-01-15`, seriesId: honor?.id }),
      ),
    )
    expect((await getPlayerAdmin(bySeries))?.isMinor).toBe(true)
    expect((await getPlayerAdmin(byAge))?.isMinor).toBe(true)

    const list = await listPlayersAdmin({ seasonId: season?.id, seriesId: juvenil })
    expect(list.items.map((item) => item.lastName)).toEqual(['Juvenil'])
    expect(list.items[0]).toMatchObject({ isMinor: true, registrations: [{ seriesName: 'Juvenil' }] })
    expect((await listPlayersAdmin({ q: 'promesa' })).items.map((item) => item.firstName)).toEqual(['Tomás'])

    // La fecha de nacimiento no queda en la auditoría.
    const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, byAge))
    expect(JSON.stringify(entry)).not.toContain(`${year - 16}-01-15`)
  })

  it('renombrar cambia el slug con redirección; un jugador con partidos no se elimina', async () => {
    const id = await idOf(
      playerActions.crearJugador(playerInput('Juan', 'Pérez', { seriesId: '', shirtNumber: '' })),
    )
    const again = await idOf(
      playerActions.crearJugador(playerInput('Juan', 'Pérez', { seriesId: '', shirtNumber: '' })),
    )
    const slugs = await db
      .select({ id: players.id, slug: players.slug })
      .from(players)
      .where(eq(players.lastName, 'Pérez'))
    expect(slugs.find((row) => row.id === id)?.slug).toBe('juan-perez')
    expect(slugs.find((row) => row.id === again)?.slug).toBe('juan-perez-2')

    expect((await playerActions.actualizarJugador(id, playerInput('Juan Pablo', 'Pérez'))).ok).toBe(true)
    const [renamed] = await db.select().from(players).where(eq(players.id, id))
    expect(renamed?.slug).toBe('juan-pablo-perez')
    expect(await db.select().from(slugRedirects).where(eq(slugRedirects.entityId, id))).toMatchObject([
      { entityType: 'player', oldSlug: 'juan-perez' },
    ])
    expect(invalidatedTags()).toEqual(expect.arrayContaining(['players', 'stats', `player:${id}`]))

    // Con una nómina, la BD impide borrarlo y todo queda como estaba (incluidas sus inscripciones).
    const [season] = await db.select().from(seasons).where(eq(seasons.name, 'Temporada 2026'))
    const [honor] = await db.select().from(series).where(eq(series.slug, 'honor'))
    const [own] = await db
      .insert(teams)
      .values([
        { name: 'Club de prueba', shortName: 'Club', slug: 'club-de-prueba', isOwnClub: true },
        { name: 'Rival de prueba', shortName: 'Rival', slug: 'rival-de-prueba' },
      ])
      .returning({ id: teams.id })
    const [rival] = await db.select().from(teams).where(eq(teams.slug, 'rival-de-prueba'))
    const [competition] = await db
      .insert(schema.competitions)
      .values({ seasonId: season?.id ?? '', name: 'Campeonato de prueba' })
      .returning({ id: schema.competitions.id })
    const matchId = await createMatch(
      admin,
      {
        seasonId: season?.id ?? '',
        seriesId: honor?.id ?? '',
        competitionId: competition?.id ?? '',
        ownTeamId: own?.id ?? '',
        rivalTeamId: rival?.id ?? '',
      },
      'partido-con-nomina',
    )
    await admin`insert into match_lineups (match_id, player_id, played) values (${matchId}, ${again}, true)`
    await idOf(
      playerActions.inscribirJugador(again, {
        seasonId: season?.id,
        seriesId: honor?.id,
        shirtNumber: '21',
        isCaptain: false,
        status: 'activo',
      }),
    )
    const blocked = await playerActions.eliminarJugador(again)
    expect(blocked.ok).toBe(false)
    expect(
      await db.select().from(squadRegistrations).where(eq(squadRegistrations.playerId, again)),
    ).toHaveLength(1)
    expect((await playerActions.eliminarJugador(id)).ok).toBe(true)
  })
})

describe('rivales y canchas', () => {
  it('el club propio se edita pero no se elimina; un rival con partidos tampoco', async () => {
    const [own] = await db.select().from(teams).where(eq(teams.isOwnClub, true))
    const [rival] = await db.select().from(teams).where(eq(teams.slug, 'rival-de-prueba'))
    expect(await teamActions.eliminarRival(own?.id ?? '')).toEqual({
      ok: false,
      message: 'El club propio no se puede eliminar.',
    })
    expect((await teamActions.eliminarRival(rival?.id ?? '')).ok).toBe(false)

    const fresh = await idOf(
      teamActions.crearRival({
        name: 'Unión El Boldo',
        shortName: 'El Boldo',
        commune: 'Sagrada Familia',
        crestMediaId: '',
      }),
    )
    const [created] = await db.select().from(teams).where(eq(teams.id, fresh))
    expect(created).toMatchObject({ slug: 'union-el-boldo', isOwnClub: false, crestMediaId: null })
    expect((await teamActions.eliminarRival(fresh)).ok).toBe(true)
  })

  it('una cancha guarda las coordenadas del enlace pegado y rechaza uno sin coordenadas', async () => {
    const input = { name: 'Estadio de prueba', address: '', commune: '', isHome: true, notes: '' }
    const bad = await teamActions.crearCancha({ ...input, location: 'https://maps.app.goo.gl/AbCd' })
    expect(bad).toMatchObject({ ok: false })
    if (!bad.ok) expect(bad.fieldErrors?.location?.[0]).toMatch(/No encontramos las coordenadas/)

    const id = await idOf(
      teamActions.crearCancha({ ...input, location: 'https://www.google.com/maps/@-35.0123,-71.4567,17z' }),
    )
    const [row] = await db.select().from(venues).where(eq(venues.id, id))
    expect(row).toMatchObject({ geoLat: -35.0123, geoLng: -71.4567, isHome: true })

    expect((await teamActions.actualizarCancha(id, { ...input, location: '' })).ok).toBe(true)
    const [cleared] = await db.select().from(venues).where(eq(venues.id, id))
    expect(cleared).toMatchObject({ geoLat: null, geoLng: null })
  })
})
