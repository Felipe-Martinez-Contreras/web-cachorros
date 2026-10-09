import { TZDate } from '@date-fns/tz'
import { eq, inArray } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import {
  competitions,
  matchEvents,
  matches,
  matchLineups,
  playerStatAdjustments,
  players,
  seasons,
  series,
  squadRegistrations,
  staffAssignments,
  staffMembers,
  standingsRows,
  standingsTables,
  teams,
  trainingSchedules,
  venues,
} from '@/db/schema'
import { santiagoDateTime } from '@/features/matches/lib/countdown'
import { deriveScore, type ScoringEvent } from '@/features/matches/lib/score'
import { computeStandings, type FinishedMatch } from '@/features/matches/lib/standings'
import { TIME_ZONE } from '@/lib/clock'
import { toIsoDate } from '@/lib/format'
import { slugify, uniqueSlug } from '@/lib/slug'
import { CLUB, FIRST_NAMES, LAST_NAMES, NICKNAMES, RIVALS, SERIES, SQUAD_SHAPE } from './data'
import type { SeedMedia } from './media'
import { createRandom, must, type Random, seedId, upsert } from './util'

const ROUNDS = 11
const PLAYED_ROUNDS = 7
const POINTS = { pointsWin: 3, pointsDraw: 1 }
/** Números de camiseta en el mismo orden que `SQUAD_SHAPE`. */
const SHIRT_NUMBERS = [1, 12, 2, 3, 4, 6, 13, 5, 8, 10, 14, 15, 9, 7, 11]
/** Titulares (4-4-2) y suplentes, como índices dentro del plantel de 15. */
const STARTERS = [0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13]
const SUBSTITUTES = [1, 6, 11, 14]

type MatchRow = typeof matches.$inferInsert
type EventRow = typeof matchEvents.$inferInsert
type LineupRow = typeof matchLineups.$inferInsert
type PlayerRow = typeof players.$inferInsert

export type MatchSummary = {
  id: string
  slug: string
  seriesSlug: string
  seriesName: string
  rivalName: string
  round: number
  ownScore: number
  rivalScore: number
  isHome: boolean
  kickoffAt: Date
  /** Nombres públicos de los goleadores del club, en orden. */
  scorers: string[]
}

export type SportSeed = {
  year: number
  seasonId: string
  ownTeamId: string
  homeVenueId: string
  seriesId: (slug: string) => string
  /** Último partido jugado de cada serie (para las noticias de ejemplo). */
  lastPlayed: (seriesSlug: string) => MatchSummary
  counts: { players: number; matches: number; events: number }
}

type Options = { tx: Tx; now: Date; live: boolean; media: SeedMedia }

/** Calendario todos contra todos (método del círculo). El equipo 0 alterna localía en cada fecha. */
function roundRobin(teamCount: number): [number, number][][] {
  const order = Array.from({ length: teamCount }, (_, index) => index)
  const rounds: [number, number][][] = []
  for (let round = 0; round < teamCount - 1; round++) {
    const pairs: [number, number][] = []
    for (let i = 0; i < teamCount / 2; i++) {
      const a = must(order[i], 'equipo')
      const b = must(order[teamCount - 1 - i], 'equipo')
      pairs.push((round + i) % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    order.splice(1, 0, must(order.pop(), 'equipo'))
  }
  return rounds
}

/** Goles de un equipo en un partido: distribución parecida a la del fútbol amateur. */
function rollGoals(random: Random): number {
  return random.weighted([18, 30, 26, 15, 8, 3])
}

function birthDate(random: Random, now: Date, age: number): string {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() - age)
  date.setUTCDate(date.getUTCDate() - random.int(20, 320))
  return date.toISOString().slice(0, 10)
}

export async function seedSport({ tx, now, live, media }: Options): Promise<SportSeed> {
  const year = Number(toIsoDate(now).slice(0, 4))
  const today = new TZDate(now.getTime(), TIME_ZONE)

  // ── Temporadas, competencia, series ──────────────────────────────────────────────────────────
  const seasonId = seedId(`season:${year}`)
  const previousSeasonId = seedId(`season:${year - 1}`)
  await tx.update(seasons).set({ isCurrent: false })
  await upsert(tx, seasons, [
    {
      id: previousSeasonId,
      name: `Temporada ${year - 1}`,
      year: year - 1,
      startsOn: `${year - 1}-03-01`,
      endsOn: `${year - 1}-12-15`,
    },
    {
      id: seasonId,
      name: `Temporada ${year}`,
      year,
      startsOn: `${year}-03-01`,
      endsOn: `${year}-12-15`,
      isCurrent: true,
    },
  ])

  const seriesId = (slug: string) => seedId(`series:${slug}`)
  await upsert(
    tx,
    series,
    SERIES.map((serie, index) => ({
      id: seriesId(serie.slug),
      name: serie.name,
      slug: serie.slug,
      shortName: serie.shortName,
      kind: serie.kind,
      sortOrder: index + 1,
      containsMinors: serie.containsMinors,
      // [COMPLETAR: duración de los tiempos por serie] Mientras tanto, 45 minutos.
      halfLengthMinutes: 45,
    })),
  )

  const competitionId = seedId(`competition:${year}`)
  const competitionName = 'Campeonato Oficial [COMPLETAR: nombre de la asociación]'
  await upsert(tx, competitions, [
    {
      id: seedId(`competition:${year - 1}`),
      seasonId: previousSeasonId,
      name: competitionName,
      organizer: '[COMPLETAR: nombre de la asociación]',
    },
    { id: competitionId, seasonId, name: competitionName, organizer: '[COMPLETAR: nombre de la asociación]' },
  ])

  // ── Club, rivales y canchas ──────────────────────────────────────────────────────────────────
  const [existingOwn] = await tx
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.isOwnClub, true))
    .limit(1)
  const ownTeamId = existingOwn?.id ?? seedId('team:own')
  const teamId = (slug: string) => seedId(`team:${slug}`)
  await upsert(tx, teams, [
    {
      id: ownTeamId,
      name: CLUB.name,
      shortName: CLUB.shortName,
      slug: CLUB.slug,
      crestMediaId: media.id('escudo'),
      commune: CLUB.commune,
      isOwnClub: true,
    },
    ...RIVALS.map((rival) => ({
      id: teamId(rival.slug),
      name: rival.name,
      shortName: rival.shortName,
      slug: rival.slug,
      crestMediaId: media.id(`rival:${rival.slug}`),
    })),
  ])

  const homeVenueId = seedId('venue:home')
  const venueId = (slug: string) => seedId(`venue:${slug}`)
  await upsert(tx, venues, [
    {
      id: homeVenueId,
      name: 'Cancha del club',
      address: '[COMPLETAR: dirección de la cancha]',
      commune: CLUB.commune,
      // Coordenadas de ejemplo: centro de la comuna, no la cancha.
      geoLat: -34.995,
      geoLng: -71.38,
      isHome: true,
      notes: '[COMPLETAR: nombre y coordenadas exactas de la cancha]',
    },
    ...RIVALS.map((rival) => ({ id: venueId(rival.slug), name: `Cancha ${rival.shortName}` })),
  ])

  // ── Jugadores e inscripciones ────────────────────────────────────────────────────────────────
  const competitive = SERIES.filter((serie) => serie.matchDay !== null)
  const takenSlugs = new Set<string>()
  const playerRows: PlayerRow[] = []
  const registrationRows: (typeof squadRegistrations.$inferInsert)[] = []
  const squads = new Map<string, PlayerRow[]>()

  for (const serie of competitive) {
    const random = createRandom(`players:${serie.slug}`)
    const squad: PlayerRow[] = []
    let index = 0
    for (const group of SQUAD_SHAPE) {
      for (let n = 0; n < group.count; n++) {
        const firstName = random.pick(FIRST_NAMES)
        const lastName = `${random.pick(LAST_NAMES)} ${random.pick(LAST_NAMES)}`
        const slug = uniqueSlug(`${firstName} ${lastName.split(' ')[0]}`, (candidate) =>
          takenSlugs.has(candidate),
        )
        takenSlugs.add(slug)
        // Tres juveniles sin fecha registrada: se tratan como menores por la serie (regla 6.3).
        const withoutBirthDate = serie.containsMinors && index % 5 === 4
        const player: PlayerRow = {
          id: seedId(`player:${serie.slug}:${index}`),
          firstName,
          lastName,
          nickname: !serie.containsMinors && random.chance(0.25) ? random.pick(NICKNAMES) : null,
          slug,
          birthDate: withoutBirthDate
            ? null
            : birthDate(random, now, random.int(serie.ages[0], serie.ages[1])),
          primaryPosition: group.position,
          positionDetail: group.details[n] ?? null,
        }
        squad.push(player)
        registrationRows.push({
          id: seedId(`registration:${serie.slug}:${index}`),
          playerId: must(player.id, 'jugador'),
          seasonId,
          seriesId: seriesId(serie.slug),
          shirtNumber: SHIRT_NUMBERS[index] ?? null,
          isCaptain: index === 2,
        })
        index++
      }
    }
    squads.set(serie.slug, squad)
    playerRows.push(...squad)
  }

  // Algunos jugadores inscritos en dos series; el último es un juvenil (menor) que también juega en Tercera.
  const double = (from: string, playerIndex: number, to: string, shirtNumber: number) => {
    const player = must(squads.get(from)?.[playerIndex], 'jugador con doble inscripción')
    registrationRows.push({
      id: seedId(`registration:${from}:${playerIndex}:${to}`),
      playerId: must(player.id, 'jugador'),
      seasonId,
      seriesId: seriesId(to),
      shirtNumber,
    })
  }
  double('tercera', 12, 'segunda', 16)
  double('tercera', 13, 'segunda', 17)
  double('segunda', 9, 'honor', 16)
  double('senior-45', 7, 'senior-35', 16)
  double('juvenil', 12, 'tercera', 18)

  await upsert(tx, players, playerRows)
  await upsert(tx, squadRegistrations, registrationRows)

  // ── Cuerpo técnico y entrenamientos ──────────────────────────────────────────────────────────
  const staffRandom = createRandom('staff')
  const staffRows: (typeof staffMembers.$inferInsert)[] = []
  const assignmentRows: (typeof staffAssignments.$inferInsert)[] = []
  for (const serie of SERIES) {
    const roles =
      serie.kind === 'formativa'
        ? (['coordinador_formativas', 'delegado'] as const)
        : serie.slug === 'honor'
          ? (['director_tecnico', 'preparador_fisico', 'delegado'] as const)
          : (['director_tecnico', 'delegado'] as const)
    roles.forEach((role, order) => {
      const id = seedId(`staff:${serie.slug}:${role}`)
      staffRows.push({
        id,
        fullName: `${staffRandom.pick(FIRST_NAMES)} ${staffRandom.pick(LAST_NAMES)} (ejemplo)`,
      })
      assignmentRows.push({
        id: seedId(`staff-assignment:${serie.slug}:${role}`),
        staffId: id,
        seasonId,
        seriesId: seriesId(serie.slug),
        role,
        sortOrder: order,
      })
    })
  }
  await upsert(tx, staffMembers, staffRows)
  await upsert(tx, staffAssignments, assignmentRows)

  await upsert(
    tx,
    trainingSchedules,
    SERIES.flatMap((serie) =>
      serie.training.map((slot, index) => ({
        id: seedId(`training:${serie.slug}:${index}`),
        seriesId: seriesId(serie.slug),
        weekday: slot.weekday,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        venueId: homeVenueId,
        notes: '[COMPLETAR: horario real de entrenamiento]',
      })),
    ),
  )

  // ── Partidos ─────────────────────────────────────────────────────────────────────────────────
  const schedule = roundRobin(RIVALS.length + 1)
  const matchRows: MatchRow[] = []
  const eventRows: EventRow[] = []
  const lineupRows: LineupRow[] = []
  const tableRows: (typeof standingsRows.$inferInsert)[] = []
  const tableDefs: (typeof standingsTables.$inferInsert)[] = []
  const lastPlayed = new Map<string, MatchSummary>()

  /** Días desde hoy hasta la fecha `round` (0-based) de una serie que juega el día `weekday`. */
  const dayOffset = (weekday: number, round: number): number => {
    const next = (weekday - today.getDay() + 7) % 7 || 7
    const last = -((today.getDay() - weekday + 7) % 7 || 7)
    return round < PLAYED_ROUNDS ? last - 7 * (PLAYED_ROUNDS - 1 - round) : next + 7 * (round - PLAYED_ROUNDS)
  }

  // Con `--en-vivo`, la jornada siguiente de las series adultas se juega hoy: dos partidos ya terminados
  // y el de Honor en curso.
  const LIVE_ROUND = PLAYED_ROUNDS
  const liveKickoffMinutesAgo: Record<string, number> = { tercera: 250, segunda: 140, honor: 27 }

  for (const serie of competitive) {
    const day = must(serie.matchDay, 'día de partido')
    // Las series senior enfrentan a los rivales en otro orden: su jornada del sábado es contra otro club.
    const rotation = serie.kind === 'senior' ? 4 : 0
    const teamAt = (index: number) => {
      if (index === 0) return { id: ownTeamId, slug: 'cachorros', name: CLUB.name, venueId: homeVenueId }
      const rival = must(RIVALS[(index - 1 + rotation) % RIVALS.length], 'rival')
      return {
        id: teamId(rival.slug),
        slug: slugify(rival.shortName),
        name: rival.name,
        venueId: venueId(rival.slug),
      }
    }
    const squad = must(squads.get(serie.slug), `plantel de ${serie.name}`)
    const finished: FinishedMatch[] = []
    let lastFinishedAt: Date | null = null

    for (let round = 0; round < ROUNDS; round++) {
      const liveToday = live && round === LIVE_ROUND && serie.slug in liveKickoffMinutesAgo
      const minutesAgo = liveKickoffMinutesAgo[serie.slug] ?? 0
      const kickoffAt = liveToday
        ? new Date(now.getTime() - minutesAgo * 60_000)
        : santiagoDateTime(now, dayOffset(day.weekday, round), day.hour, day.minute)
      const isLive = liveToday && serie.slug === 'honor'
      const isPlayed = round < PLAYED_ROUNDS || (liveToday && !isLive)

      for (const [homeIndex, awayIndex] of must(schedule[round], 'fecha')) {
        const home = teamAt(homeIndex)
        const away = teamAt(awayIndex)
        const involvesClub = homeIndex === 0 || awayIndex === 0
        const random = createRandom(`match:${serie.slug}:${round}:${home.slug}:${away.slug}`)

        if (!involvesClub) {
          // Partidos entre rivales: solo cuentan para las tablas. En Honor se guardan (tabla calculada);
          // en las demás series se simulan para armar una tabla manual coherente.
          if (!isPlayed) continue
          const result = { homeScore: rollGoals(random), awayScore: rollGoals(random) }
          finished.push({ homeTeamId: home.id, awayTeamId: away.id, ...result })
          if (serie.slug === 'honor') {
            matchRows.push({
              id: seedId(`match:${serie.slug}:${round}:${home.slug}:${away.slug}`),
              seasonId,
              competitionId,
              seriesId: seriesId(serie.slug),
              roundNumber: round + 1,
              roundLabel: `Fecha ${round + 1}`,
              homeTeamId: home.id,
              awayTeamId: away.id,
              venueId: home.venueId,
              kickoffAt,
              status: 'finalizado',
              period: 'terminado',
              ...result,
              // Sin eventos cargados: el marcador se ingresa a mano y no se recalcula.
              scoreLocked: true,
              clubSide: 'ninguno',
              slug: `${serie.slug}-${year}-fecha-${round + 1}-${home.slug}-vs-${away.slug}`,
              finishedAt: new Date(kickoffAt.getTime() + 105 * 60_000),
            })
          }
          continue
        }

        const isHome = homeIndex === 0
        const rival = isHome ? away : home
        const matchKey = `match:${serie.slug}:${round}:${home.slug}:${away.slug}`
        const matchId = seedId(matchKey)
        const slug = `${serie.slug}-${year}-fecha-${round + 1}-${home.slug}-vs-${away.slug}`
        const base: MatchRow = {
          id: matchId,
          seasonId,
          competitionId,
          seriesId: seriesId(serie.slug),
          roundNumber: round + 1,
          roundLabel: `Fecha ${round + 1}`,
          homeTeamId: home.id,
          awayTeamId: away.id,
          venueId: home.venueId,
          kickoffAt,
          clubSide: isHome ? 'local' : 'visita',
          slug,
        }

        if (!isPlayed && !isLive) {
          matchRows.push(base)
          continue
        }

        // Nómina: 11 titulares y 4 suplentes; entran dos desde la banca.
        const entering = isLive ? [] : random.shuffle(SUBSTITUTES).slice(0, 2)
        const played = [...STARTERS, ...entering]
        const rosterIndexes = [...STARTERS, ...SUBSTITUTES]
        rosterIndexes.forEach((playerIndex) => {
          const player = must(squad[playerIndex], 'jugador de la nómina')
          lineupRows.push({
            id: seedId(`lineup:${matchKey}:${playerIndex}`),
            matchId,
            playerId: must(player.id, 'jugador'),
            role: STARTERS.includes(playerIndex) ? 'titular' : 'suplente',
            shirtNumber: SHIRT_NUMBERS[playerIndex] ?? null,
            played: played.includes(playerIndex),
          })
        })

        // Goles: el club llega un poco mejor a Honor y Senior 45, y gana su último partido jugado
        // (las noticias de ejemplo son la crónica y el triunfo de esas series).
        let ownGoals = rollGoals(random)
        let rivalGoals = rollGoals(random)
        const mustWin = (serie.slug === 'honor' || serie.slug === 'senior-45') && round === PLAYED_ROUNDS - 1
        if (mustWin && ownGoals <= rivalGoals) ownGoals = rivalGoals + random.int(1, 2)
        if (isLive) {
          ownGoals = 1
          rivalGoals = 0
        }

        const maxMinute = isLive ? Math.max(1, minutesAgo - 4) : 90
        const minute = () => random.int(1, maxMinute)
        const periodOf = (m: number) => (m <= 45 ? 'primer_tiempo' : 'segundo_tiempo') as EventRow['period']
        const pending: Omit<EventRow, 'id' | 'clientEventId' | 'matchId'>[] = []
        const scorers: string[] = []
        // Los arqueros (índices 0 y 1) no convierten.
        const scorerPool = played.filter((index) => index >= 2)
        const scorerWeights = scorerPool.map((index) => (index >= 12 ? 5 : index >= 7 ? 3 : 1))

        for (let goal = 0; goal < ownGoals; goal++) {
          const m = isLive ? 12 : minute()
          const scorer = must(squad[must(scorerPool[random.weighted(scorerWeights)], 'goleador')], 'goleador')
          pending.push({
            type: !isLive && random.chance(0.12) ? 'gol_penal' : 'gol',
            period: periodOf(m),
            minute: m,
            teamId: ownTeamId,
            playerId: scorer.id,
          })
          scorers.push(`${scorer.firstName} ${scorer.lastName.split(' ')[0]}`)
        }
        for (let goal = 0; goal < rivalGoals; goal++) {
          const m = minute()
          pending.push({ type: 'gol', period: periodOf(m), minute: m, teamId: rival.id })
        }
        const ownCards = random.shuffle(played).slice(0, isLive ? 0 : random.weighted([3, 4, 3, 1]))
        for (const playerIndex of ownCards) {
          const m = minute()
          pending.push({
            type: 'tarjeta_amarilla',
            period: periodOf(m),
            minute: m,
            teamId: ownTeamId,
            playerId: must(squad[playerIndex], 'jugador amonestado').id,
          })
        }
        for (let card = 0; card < (isLive ? 1 : random.weighted([4, 4, 2])); card++) {
          const m = isLive ? 19 : minute()
          pending.push({ type: 'tarjeta_amarilla', period: periodOf(m), minute: m, teamId: rival.id })
        }
        if (!isLive && random.chance(0.06)) {
          const m = random.int(55, 90)
          pending.push({
            type: 'tarjeta_roja',
            period: 'segundo_tiempo',
            minute: m,
            teamId: ownTeamId,
            playerId: must(squad[must(random.pick(STARTERS.slice(1)), 'titular')], 'jugador expulsado').id,
          })
        }

        pending.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
        pending.forEach((event, index) => {
          eventRows.push({
            ...event,
            id: seedId(`event:${matchKey}:${index}`),
            clientEventId: seedId(`client-event:${matchKey}:${index}`),
            matchId,
            createdAt: new Date(kickoffAt.getTime() + (event.minute ?? 0) * 60_000),
          })
        })

        // El marcador nunca se escribe a mano: se deriva de los eventos, igual que en la app (8.6).
        const scoring: ScoringEvent[] = pending.map((event) => ({
          type: event.type,
          teamId: event.teamId ?? null,
          period: event.period,
        }))
        const score = deriveScore(scoring, { homeTeamId: home.id, awayTeamId: away.id })
        matchRows.push({
          ...base,
          status: isLive ? 'en_vivo' : 'finalizado',
          period: isLive ? 'primer_tiempo' : 'terminado',
          periodStartedAt: isLive ? new Date(kickoffAt.getTime() + 2 * 60_000) : null,
          homeScore: score.home,
          awayScore: score.away,
          finishedAt: isLive ? null : new Date(kickoffAt.getTime() + 105 * 60_000),
        })

        if (!isLive) {
          finished.push({
            homeTeamId: home.id,
            awayTeamId: away.id,
            homeScore: score.home,
            awayScore: score.away,
          })
          lastFinishedAt = kickoffAt
          lastPlayed.set(serie.slug, {
            id: matchId,
            slug,
            seriesSlug: serie.slug,
            seriesName: serie.name,
            rivalName: rival.name,
            round: round + 1,
            ownScore: isHome ? score.home : score.away,
            rivalScore: isHome ? score.away : score.home,
            isHome,
            kickoffAt,
            scorers,
          })
        }
      }
    }

    // Tabla: Honor en modo calculado (sale de los partidos guardados); el resto manual, con las filas
    // calculadas desde los mismos resultados para que sea coherente.
    const tableId = seedId(`standings:${serie.slug}`)
    const calculated = serie.slug === 'honor'
    tableDefs.push({
      id: tableId,
      competitionId,
      seriesId: seriesId(serie.slug),
      mode: calculated ? 'calculada' : 'manual',
      asOf: lastFinishedAt ? toIsoDate(lastFinishedAt) : null,
      sourceNote: calculated
        ? 'Calculada con los resultados cargados (datos de ejemplo).'
        : 'Datos de ejemplo. [COMPLETAR: fuente oficial de la tabla]',
    })
    if (!calculated) {
      for (const row of computeStandings(finished, POINTS)) {
        tableRows.push({
          id: seedId(`standings-row:${serie.slug}:${row.teamId}`),
          tableId,
          teamId: row.teamId,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
        })
      }
    }
  }

  await upsert(tx, matches, matchRows)
  // Eventos y nóminas se reemplazan completos: así el seed deja lo mismo con o sin `--en-vivo`.
  const seededMatchIds = matchRows.map((row) => must(row.id, 'partido'))
  await tx.delete(matchEvents).where(inArray(matchEvents.matchId, seededMatchIds))
  await tx.delete(matchLineups).where(inArray(matchLineups.matchId, seededMatchIds))
  await upsert(tx, matchLineups, lineupRows)
  await upsert(tx, matchEvents, eventRows)
  await upsert(tx, standingsTables, tableDefs)
  // Las filas también se reemplazan: si alguien guardó la tabla desde el panel, sus filas tienen otros ids
  // y chocarían con la unicidad (tabla, equipo).
  await tx.delete(standingsRows).where(
    inArray(
      standingsRows.tableId,
      tableDefs.map((table) => must(table.id, 'tabla')),
    ),
  )
  await upsert(tx, standingsRows, tableRows)

  // ── Temporada anterior: solo estadísticas históricas, sin partidos ficticios ─────────────────
  const history = createRandom('history')
  await upsert(
    tx,
    playerStatAdjustments,
    must(squads.get('honor'), 'plantel de Honor')
      .slice(7, 15)
      .map((player, index) => ({
        id: seedId(`adjustment:${year - 1}:${index}`),
        playerId: must(player.id, 'jugador'),
        seasonId: previousSeasonId,
        seriesId: seriesId('honor'),
        appearances: history.int(8, 18),
        goals: index >= 5 ? history.int(4, 12) : history.int(0, 4),
        yellowCards: history.int(0, 5),
        redCards: history.chance(0.2) ? 1 : 0,
        note: 'Estadística histórica de ejemplo.',
      })),
  )

  return {
    year,
    seasonId,
    ownTeamId,
    homeVenueId,
    seriesId,
    lastPlayed: (seriesSlug) => must(lastPlayed.get(seriesSlug), `último partido de ${seriesSlug}`),
    counts: { players: playerRows.length, matches: matchRows.length, events: eventRows.length },
  }
}
