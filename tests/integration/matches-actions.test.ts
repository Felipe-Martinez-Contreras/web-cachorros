import { and, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createPlayer, createSportFixture, type SportFixture } from './fixtures'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { db, sql } = await import('@/db/client')
const { auditLog, matchEvents, matches, matchLineups, playerSeasonStats } = await import('@/db/schema')
const actions = await import('@/features/matches/actions')
const { getResultSheet, listMatchesAdmin } = await import('@/features/matches/admin-queries')
const standings = await import('@/features/standings/actions')
const { getStandingsAdmin } = await import('@/features/standings/admin-queries')
const { agregarAjuste } = await import('@/features/players/actions')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture
let secondSeriesId: string
let otherRivalId: string
const squad: string[] = []

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, JSON.stringify(value)).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

const matchInput = (extra: Record<string, unknown> = {}) => ({
  competitionId: f.competitionId,
  seriesId: f.seriesId,
  homeTeamId: f.ownTeamId,
  awayTeamId: f.rivalTeamId,
  date: '2026-10-10',
  time: '16:00',
  venueId: '',
  roundNumber: '5',
  roundLabel: '',
  notes: '',
  ...extra,
})

const event = (type: string, team: 'club' | 'rival', extra: Record<string, unknown> = {}) => ({
  type,
  team,
  playerId: '',
  relatedPlayerId: '',
  freeTextName: '',
  minute: '',
  stoppageMinute: '',
  comment: '',
  clientEventId: '',
  ...extra,
})

const result = (resolution: string, extra: Record<string, unknown> = {}) => ({
  resolution,
  homeScore: '',
  awayScore: '',
  homePenalties: '',
  awayPenalties: '',
  ...extra,
})

async function readMatch(id: string) {
  const [row] = await db.select().from(matches).where(eq(matches.id, id))
  if (!row) throw new Error('El partido no existe.')
  return row
}

async function newMatch(round: number, extra: Record<string, unknown> = {}) {
  return idOf(actions.crearPartido(matchInput({ roundNumber: String(round), ...extra })))
}

beforeAll(async () => {
  await cleanSport(admin)
  f = await createSportFixture(admin)
  const [second] = await admin<{ id: string }[]>`
    insert into series (name, slug, short_name, kind, sort_order, half_length_minutes)
    values ('Senior 50', 'senior-50', 'Senior 50', 'senior', 20, 30) returning id`
  const [other] = await admin<{ id: string }[]>`
    insert into teams (name, short_name, slug) values ('Otro rival', 'Otro', 'otro-rival') returning id`
  secondSeriesId = second?.id ?? ''
  otherRivalId = other?.id ?? ''
  for (const [index, slug] of ['nueve', 'diez', 'arquero', 'suplente'].entries()) {
    const id = await createPlayer(admin, slug)
    squad.push(id)
    await admin`insert into squad_registrations (player_id, season_id, series_id, shirt_number)
      values (${id}, ${f.seasonId}, ${f.seriesId}, ${index + 1})`
  }
  await ensureTestUsers()
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await cleanSport(admin)
  await admin.end()
  await sql.end()
})

describe('programar partidos', () => {
  it('rechaza sin sesión y sin permiso', async () => {
    await actAs('nadie')
    expect((await actions.crearPartido(matchInput())).ok).toBe(false)
    await actAs('prensa')
    expect(await actions.crearPartido(matchInput())).toEqual({
      ok: false,
      message: 'No tienes permiso para hacer esto.',
    })
    expect(await db.select().from(matches)).toEqual([])
  })

  it('crea el partido con la hora de Santiago, el lado del club, el rótulo y el slug', async () => {
    const same = await actions.crearPartido(matchInput({ awayTeamId: f.ownTeamId }))
    expect(same).toMatchObject({
      ok: false,
      fieldErrors: { awayTeamId: ['El local y la visita no pueden ser el mismo equipo.'] },
    })

    const id = await newMatch(5)
    expect(await readMatch(id)).toMatchObject({
      seasonId: f.seasonId,
      clubSide: 'local',
      roundLabel: 'Fecha 5',
      slug: 'honor-2026-fecha-5-prueba-vs-rival',
      status: 'programado',
    })
    expect((await readMatch(id)).kickoffAt.toISOString()).toBe('2026-10-10T19:00:00.000Z')
    expect(invalidatedTags()).toEqual(
      expect.arrayContaining([
        `match:${id}`,
        'matches',
        'live',
        `standings:${f.competitionId}:${f.seriesId}`,
      ]),
    )

    // De visita y entre rivales.
    const away = await newMatch(6, { homeTeamId: f.rivalTeamId, awayTeamId: f.ownTeamId })
    expect((await readMatch(away)).clubSide).toBe('visita')
    const neutral = await newMatch(6, { homeTeamId: f.rivalTeamId, awayTeamId: otherRivalId })
    expect(await readMatch(neutral)).toMatchObject({
      clubSide: 'ninguno',
      slug: 'honor-2026-fecha-6-rival-vs-otro',
    })
  })

  it('«Programar jornada» crea un partido por serie marcada, o ninguno si algo falla', async () => {
    const base = {
      competitionId: f.competitionId,
      rivalId: otherRivalId,
      condition: 'visita',
      date: '2026-10-17',
      venueId: '',
    }
    const none = await actions.programarJornada({
      ...base,
      rows: [{ seriesId: f.seriesId, include: false, time: '', roundNumber: '' }],
    })
    expect(none).toMatchObject({
      ok: false,
      fieldErrors: { rows: ['Marca al menos una serie que juegue ese día.'] },
    })

    const before = (await db.select().from(matches)).length
    // La segunda fila apunta a una serie que no existe: no debe quedar la primera a medias.
    const broken = await actions.programarJornada({
      ...base,
      rows: [
        { seriesId: f.seriesId, include: true, time: '15:00', roundNumber: '7' },
        { seriesId: '018f0000-0000-7000-8000-000000000000', include: true, time: '17:00', roundNumber: '7' },
      ],
    })
    expect(broken.ok).toBe(false)
    expect((await db.select().from(matches)).length).toBe(before)

    await idOf(
      actions.programarJornada({
        ...base,
        rows: [
          { seriesId: f.seriesId, include: true, time: '15:00', roundNumber: '7' },
          { seriesId: secondSeriesId, include: true, time: '17:00', roundNumber: '3' },
        ],
      }),
    )
    const created = await db.select().from(matches).where(eq(matches.homeTeamId, otherRivalId))
    expect(created.map((row) => [row.clubSide, row.roundLabel, row.kickoffAt.toISOString()]).sort()).toEqual([
      ['visita', 'Fecha 3', '2026-10-17T20:00:00.000Z'],
      ['visita', 'Fecha 7', '2026-10-17T18:00:00.000Z'],
    ])
    const list = await listMatchesAdmin({ seriesId: secondSeriesId, view: 'proximos' })
    expect(list.items.map((item) => item.seriesName)).toEqual(['Senior 50'])
  })

  it('postergar exige el motivo, guarda el historial y no aplica a un partido finalizado', async () => {
    const id = await newMatch(8)
    const missing = await actions.cambiarEstadoPartido(id, {
      status: 'postergado',
      date: '',
      time: '',
      notes: '',
    })
    expect(missing).toMatchObject({
      ok: false,
      fieldErrors: { notes: ['Cuenta brevemente el motivo: se muestra en el sitio.'] },
    })
    await idOf(
      actions.cambiarEstadoPartido(id, {
        status: 'postergado',
        date: '',
        time: '',
        notes: 'Cancha inundada',
      }),
    )
    expect(await readMatch(id)).toMatchObject({ status: 'postergado', notes: 'Cancha inundada' })
    await idOf(
      actions.cambiarEstadoPartido(id, {
        status: 'programado',
        date: '2026-10-24',
        time: '11:30',
        notes: '',
      }),
    )
    expect((await readMatch(id)).kickoffAt.toISOString()).toBe('2026-10-24T14:30:00.000Z')

    const entries = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'match.status.update')))
    expect(entries.map((entry) => (entry.meta as { to: { status: string } }).to.status).sort()).toEqual([
      'postergado',
      'programado',
    ])

    await idOf(actions.finalizarPartido(id, result('normal')))
    const late = await actions.cambiarEstadoPartido(id, {
      status: 'suspendido',
      date: '',
      time: '',
      notes: 'Tarde',
    })
    expect(late.ok).toBe(false)
    expect((await actions.eliminarPartido(id)).ok).toBe(false)
  })
})

describe('resultado: marcador derivado, nómina y cierre', () => {
  it('el marcador siempre es la suma de los goles, con altas y bajas al azar', async () => {
    const id = await newMatch(9)
    const [nine = '', ten = ''] = squad
    let club = 0
    let rival = 0
    const created: { id: string; goalFor: 'club' | 'rival' | null }[] = []
    // Generador determinista: la prueba falla siempre igual si falla.
    let seed = 20261010
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % max
    }
    const kinds = [
      { input: () => event('gol', 'club', { playerId: nine, minute: 1 + random(90) }), goalFor: 'club' },
      { input: () => event('gol_penal', 'club', { playerId: ten, minute: 1 + random(90) }), goalFor: 'club' },
      { input: () => event('gol', 'rival', { freeTextName: 'Delantero rival' }), goalFor: 'rival' },
      { input: () => event('autogol', 'club', { playerId: ten }), goalFor: 'rival' },
      { input: () => event('autogol', 'rival'), goalFor: 'club' },
      { input: () => event('tarjeta_amarilla', 'club', { playerId: nine, minute: 30 }), goalFor: null },
      { input: () => event('penal_errado', 'club', { playerId: nine }), goalFor: null },
      {
        input: () => event('comentario', 'club', { comment: 'Se suspende 5 minutos por lluvia.' }),
        goalFor: null,
      },
    ] as const

    for (let step = 0; step < 40; step++) {
      if (created.length > 3 && random(4) === 0) {
        const [removed] = created.splice(random(created.length), 1)
        await idOf(actions.eliminarEvento(removed?.id ?? ''))
        if (removed?.goalFor === 'club') club -= 1
        if (removed?.goalFor === 'rival') rival -= 1
      } else {
        const kind = kinds[random(kinds.length)] ?? kinds[0]
        created.push({ id: await idOf(actions.agregarEvento(id, kind.input())), goalFor: kind.goalFor })
        if (kind.goalFor === 'club') club += 1
        if (kind.goalFor === 'rival') rival += 1
      }
      const row = await readMatch(id)
      expect([row.homeScore, row.awayScore], `paso ${step}`).toEqual([club, rival])
    }
    expect(club + rival).toBeGreaterThan(0)
    expect((await db.select().from(matchEvents).where(eq(matchEvents.matchId, id))).length).toBe(
      created.length,
    )
  })

  it('el mismo toque enviado dos veces crea un solo gol', async () => {
    const id = await newMatch(10)
    const clientEventId = '018f1111-2222-7333-8444-555566667777'
    const goal = event('gol', 'club', { playerId: squad[0], minute: 12, clientEventId })
    const first = await idOf(actions.agregarEvento(id, goal))
    const second = await idOf(actions.agregarEvento(id, goal))
    expect(second).toBe(first)
    expect(await readMatch(id)).toMatchObject({ homeScore: 1, awayScore: 0 })
  })

  it('valida los eventos y deduce el período según la duración del tiempo de la serie', async () => {
    const id = await newMatch(11)
    expect(await actions.agregarEvento(id, event('gol', 'club'))).toMatchObject({
      ok: false,
      fieldErrors: { playerId: ['Elige al jugador.'] },
    })
    expect(await actions.agregarEvento(id, event('comentario', 'club'))).toMatchObject({
      ok: false,
      fieldErrors: { comment: ['Escribe el comentario.'] },
    })
    const change = event('cambio', 'club', { playerId: squad[0], relatedPlayerId: squad[0], minute: 60 })
    expect(await actions.agregarEvento(id, change)).toMatchObject({
      ok: false,
      fieldErrors: { relatedPlayerId: ['Entra y sale el mismo jugador.'] },
    })

    await idOf(
      actions.agregarEvento(id, event('gol', 'club', { playerId: squad[0], minute: 45, stoppageMinute: 2 })),
    )
    await idOf(
      actions.agregarEvento(
        id,
        event('cambio', 'club', { playerId: squad[0], relatedPlayerId: squad[3], minute: 46 }),
      ),
    )
    const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, id))
    expect(events.map((row) => [row.type, row.period, row.minute, row.stoppageMinute]).sort()).toEqual([
      ['cambio', 'segundo_tiempo', 46, null],
      ['gol', 'primer_tiempo', 45, 2],
    ])

    // Quien participa en un evento queda en la nómina como «jugó» (el que entra, como suplente).
    const lineup = await db.select().from(matchLineups).where(eq(matchLineups.matchId, id))
    expect(lineup.map((row) => [row.playerId, row.role, row.played]).sort()).toEqual(
      [
        [squad[0], 'titular', true],
        [squad[3], 'suplente', true],
      ].sort(),
    )

    // Un partido entre rivales no lleva eventos.
    const neutral = await newMatch(11, { homeTeamId: f.rivalTeamId, awayTeamId: otherRivalId })
    expect(await actions.agregarEvento(neutral, event('gol', 'rival'))).toEqual({
      ok: false,
      message: 'En un partido entre rivales solo se carga el marcador final.',
    })
  })

  it('guarda la nómina completa, no deja fuera a quien tiene eventos y copia la del partido anterior', async () => {
    const first = await newMatch(12, { date: '2026-11-01' })
    const players = squad.map((playerId, index) => ({
      playerId,
      role: index < 3 ? 'titular' : 'suplente',
      shirtNumber: String(index + 1),
      played: index < 3,
    }))
    await idOf(actions.guardarNomina(first, { players }))
    await idOf(
      actions.agregarEvento(first, event('tarjeta_roja', 'club', { playerId: squad[2], minute: 80 })),
    )

    const without = await actions.guardarNomina(first, {
      players: players.filter((p) => p.playerId !== squad[2]),
    })
    expect(without.ok).toBe(false)
    const twice = await actions.guardarNomina(first, { players: [...players, players[0]] })
    expect(twice).toMatchObject({
      ok: false,
      fieldErrors: { players: ['Un jugador aparece dos veces en la nómina.'] },
    })
    expect(await db.select().from(matchLineups).where(eq(matchLineups.matchId, first))).toHaveLength(4)

    // El partido siguiente parte con la misma nómina, salvo quien fue dado de baja.
    await admin`update squad_registrations set status = 'baja' where player_id = ${squad[3] ?? ''}`
    const next = await newMatch(13, { date: '2026-11-08' })
    const sheet = await getResultSheet(next)
    expect(sheet?.previousMatchId).toBe(first)
    await idOf(actions.copiarNominaAnterior(next))
    const copied = await db.select().from(matchLineups).where(eq(matchLineups.matchId, next))
    expect(copied.map((row) => row.shirtNumber).sort()).toEqual([1, 2, 3])
    expect((await actions.copiarNominaAnterior(next)).ok).toBe(false)
    await admin`update squad_registrations set status = 'activo' where player_id = ${squad[3] ?? ''}`
  })

  it('W.O. y «por secretaría» llevan marcador manual; al volver a normal manda la suma de goles', async () => {
    const id = await newMatch(14)
    await idOf(actions.agregarEvento(id, event('gol', 'club', { playerId: squad[0], minute: 10 })))

    expect(await actions.finalizarPartido(id, result('walkover'))).toMatchObject({
      ok: false,
      fieldErrors: { homeScore: ['Escribe los goles del local.'] },
    })
    await idOf(actions.finalizarPartido(id, result('walkover', { homeScore: '3', awayScore: '0' })))
    expect(await readMatch(id)).toMatchObject({
      status: 'finalizado',
      period: 'terminado',
      resolution: 'walkover',
      scoreLocked: true,
      homeScore: 3,
      awayScore: 0,
    })
    // Con el marcador bloqueado, un evento nuevo no lo cambia.
    await idOf(actions.agregarEvento(id, event('gol', 'rival')))
    expect(await readMatch(id)).toMatchObject({ homeScore: 3, awayScore: 0 })

    await idOf(actions.finalizarPartido(id, result('secretaria', { homeScore: '0', awayScore: '2' })))
    expect(await readMatch(id)).toMatchObject({ resolution: 'secretaria', homeScore: 0, awayScore: 2 })

    await idOf(actions.finalizarPartido(id, result('normal', { homeScore: '9', awayScore: '9' })))
    expect(await readMatch(id)).toMatchObject({
      resolution: 'normal',
      scoreLocked: false,
      homeScore: 1,
      awayScore: 1,
    })

    expect(
      await actions.finalizarPartido(id, result('penales', { homePenalties: '4', awayPenalties: '4' })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { awayPenalties: ['Una definición por penales no puede terminar empatada.'] },
    })
    await idOf(actions.finalizarPartido(id, result('penales', { homePenalties: '5', awayPenalties: '4' })))
    expect(await readMatch(id)).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      homePenalties: 5,
      awayPenalties: 4,
    })
  })

  it('las estadísticas salen exactas: solo partidos finalizados, más los ajustes históricos', async () => {
    const scorer = await createPlayer(admin, 'goleador-conocido')
    await admin`insert into squad_registrations (player_id, season_id, series_id) values (${scorer}, ${f.seasonId}, ${f.seriesId})`
    const lineup = { players: [{ playerId: scorer, role: 'titular', shirtNumber: '', played: true }] }

    // Partido 1 (finalizado): 2 goles (uno de penal), 1 amarilla.
    const one = await newMatch(20)
    await idOf(actions.guardarNomina(one, lineup))
    await idOf(actions.agregarEvento(one, event('gol', 'club', { playerId: scorer, minute: 5 })))
    await idOf(actions.agregarEvento(one, event('gol_penal', 'club', { playerId: scorer, minute: 50 })))
    await idOf(
      actions.agregarEvento(one, event('tarjeta_amarilla', 'club', { playerId: scorer, minute: 70 })),
    )
    await idOf(actions.finalizarPartido(one, result('normal')))
    // Partido 2 (finalizado): 1 gol y expulsión por doble amarilla (cuenta 1 amarilla y 1 roja).
    const two = await newMatch(21)
    await idOf(actions.guardarNomina(two, lineup))
    await idOf(actions.agregarEvento(two, event('gol', 'club', { playerId: scorer, minute: 15 })))
    await idOf(
      actions.agregarEvento(two, event('segunda_amarilla', 'club', { playerId: scorer, minute: 88 })),
    )
    await idOf(actions.finalizarPartido(two, result('normal')))
    // Partido 3 (sin finalizar): sus goles no cuentan todavía.
    const three = await newMatch(22)
    await idOf(actions.guardarNomina(three, lineup))
    await idOf(actions.agregarEvento(three, event('gol', 'club', { playerId: scorer, minute: 1 })))

    const stats = async () => {
      const [row] = await db
        .select()
        .from(playerSeasonStats)
        .where(and(eq(playerSeasonStats.playerId, scorer), eq(playerSeasonStats.seriesId, f.seriesId)))
      return row
    }
    expect(await stats()).toMatchObject({ appearances: 2, goals: 3, yellowCards: 2, redCards: 1 })

    await idOf(
      agregarAjuste(scorer, {
        seasonId: f.seasonId,
        seriesId: f.seriesId,
        appearances: '10',
        goals: '7',
        yellowCards: '1',
        redCards: '0',
        note: 'Planilla antigua',
      }),
    )
    expect(await stats()).toMatchObject({ appearances: 12, goals: 10, yellowCards: 3, redCards: 1 })

    await idOf(actions.finalizarPartido(three, result('normal')))
    expect(await stats()).toMatchObject({ appearances: 13, goals: 11 })
    expect(invalidatedTags()).toContain('stats')
  })
})

describe('tabla de posiciones', () => {
  const row = (
    teamId: string,
    won: number,
    drawn: number,
    lost: number,
    gf: number,
    ga: number,
    extra = {},
  ) => ({
    teamId,
    won,
    drawn,
    lost,
    goalsFor: gf,
    goalsAgainst: ga,
    pointsAdjustment: '',
    position: '',
    note: '',
    ...extra,
  })

  it('manual: calcula PJ, DIF y PTS, ordena y respeta el ajuste de puntos y de posición', async () => {
    const header = { mode: 'manual', asOf: '2026-10-05', sourceNote: 'Asociación local' }
    const id = await idOf(
      standings.crearTabla({
        competitionId: f.competitionId,
        seriesId: secondSeriesId,
        groupLabel: '',
        ...header,
      }),
    )
    expect(
      await standings.crearTabla({
        competitionId: f.competitionId,
        seriesId: secondSeriesId,
        groupLabel: '',
        ...header,
      }),
    ).toMatchObject({ ok: false, fieldErrors: { seriesId: [expect.stringMatching(/ya tiene una tabla/)] } })

    await idOf(
      standings.guardarTabla(id, {
        ...header,
        rows: [
          row(f.ownTeamId, 3, 1, 0, 9, 2),
          row(f.rivalTeamId, 4, 0, 0, 8, 1, { pointsAdjustment: '-3' }),
          row(otherRivalId, 3, 0, 1, 8, 1, { position: '2' }),
        ],
      }),
    )
    expect(new Set(invalidatedTags())).toEqual(new Set([`standings:${f.competitionId}:${secondSeriesId}`]))
    const detail = await getStandingsAdmin(id)
    expect(detail?.preview.map((r) => [r.teamName, r.played, r.goalDiff, r.points, r.position])).toEqual([
      ['Club de prueba', 4, 7, 10, 1],
      // Empatados en puntos, diferencia y goles a favor: decide la posición manual.
      ['Otro rival', 4, 7, 9, 2],
      ['Rival de prueba', 4, 7, 9, 3],
    ])

    const twice = await standings.guardarTabla(id, {
      ...header,
      rows: [row(f.ownTeamId, 1, 0, 0, 1, 0), row(f.ownTeamId, 1, 0, 0, 1, 0)],
    })
    expect(twice).toMatchObject({
      ok: false,
      fieldErrors: { rows: ['Un equipo aparece dos veces en la tabla.'] },
    })
    expect((await getStandingsAdmin(id))?.rows).toHaveLength(3)
  })

  it('calculada: sale de los resultados, incluidos los partidos entre rivales con marcador manual', async () => {
    const [third] = await admin<{ id: string }[]>`
      insert into series (name, slug, short_name, kind, sort_order) values ('Tercera', 'tercera', 'Tercera', 'adulta', 30) returning id`
    const seriesId = third?.id ?? ''
    const id = await idOf(
      standings.crearTabla({
        competitionId: f.competitionId,
        seriesId,
        groupLabel: '',
        mode: 'calculada',
        asOf: '',
        sourceNote: '',
      }),
    )
    const player = await createPlayer(admin, 'tercera-nueve')
    const clubMatch = await newMatch(1, { seriesId })
    await idOf(actions.agregarEvento(clubMatch, event('gol', 'club', { playerId: player, minute: 20 })))
    await idOf(actions.finalizarPartido(clubMatch, result('normal')))
    const neutral = await newMatch(1, { seriesId, homeTeamId: f.rivalTeamId, awayTeamId: otherRivalId })
    expect(await actions.finalizarPartido(neutral, result('normal'))).toMatchObject({ ok: false })
    await idOf(actions.finalizarPartido(neutral, result('normal', { homeScore: '2', awayScore: '2' })))
    expect(invalidatedTags()).toContain(`standings:${f.competitionId}:${seriesId}`)

    const detail = await getStandingsAdmin(id)
    expect(detail?.preview.map((r) => [r.teamName, r.played, r.points])).toEqual([
      ['Club de prueba', 1, 3],
      // Empató su único partido; el otro rival además perdió con el club.
      ['Otro rival', 1, 1],
      ['Rival de prueba', 2, 1],
    ])

    // Descuento de puntos por secretaría sobre una tabla calculada.
    await idOf(
      standings.guardarTabla(id, {
        mode: 'calculada',
        asOf: '',
        sourceNote: '',
        rows: [row(f.ownTeamId, 9, 9, 9, 9, 9, { pointsAdjustment: '-3', note: 'Sanción' })],
      }),
    )
    const adjusted = await getStandingsAdmin(id)
    expect(adjusted?.preview.find((r) => r.teamName === 'Club de prueba')).toMatchObject({
      played: 1,
      points: 0,
    })
  })
})
