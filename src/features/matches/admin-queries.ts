import 'server-only'
import { and, asc, count, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import {
  competitions,
  matchEvents,
  matches,
  matchLineups,
  players,
  seasons,
  series,
  squadRegistrations,
  teams,
  venues,
} from '@/db/schema'
import { compareEvents } from './lib/match-clock'

// Lecturas del panel: sin caché, siempre el estado actual. Aquí se ven los nombres completos.

const homeTeam = alias(teams, 'home_team')
const awayTeam = alias(teams, 'away_team')

export const MATCHES_PAGE_SIZE = 30

export type MatchListView = 'proximos' | 'jugados' | 'todos'

function selectAdminMatches() {
  return db
    .select({
      id: matches.id,
      slug: matches.slug,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      resolution: matches.resolution,
      clubSide: matches.clubSide,
      roundLabel: matches.roundLabel,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      seriesName: series.name,
      seriesOrder: series.sortOrder,
      competitionName: competitions.name,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
      venueName: venues.name,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
}

export type MatchAdminListItem = Awaited<ReturnType<typeof selectAdminMatches>>[number]

/** Estados que todavía esperan jugarse (o resolverse). */
const PENDING = ['programado', 'en_vivo', 'postergado', 'suspendido'] as const

export async function listMatchesAdmin(options: {
  seasonId?: string | null
  seriesId?: string | null
  view?: MatchListView
  page?: number
}): Promise<{ items: MatchAdminListItem[]; page: number; totalPages: number; total: number }> {
  const view = options.view ?? 'proximos'
  const where = and(
    options.seasonId ? eq(matches.seasonId, options.seasonId) : undefined,
    options.seriesId ? eq(matches.seriesId, options.seriesId) : undefined,
    view === 'proximos' ? inArray(matches.status, PENDING) : undefined,
    view === 'jugados' ? inArray(matches.status, ['finalizado', 'cancelado']) : undefined,
  )
  const [totals] = await db.select({ total: count() }).from(matches).where(where)
  const total = totals?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / MATCHES_PAGE_SIZE))
  const page = Math.min(Math.max(1, options.page ?? 1), totalPages)

  const items = await selectAdminMatches()
    .where(where)
    // Lo pendiente, del más cercano al más lejano; lo jugado, del más reciente hacia atrás.
    .orderBy(view === 'proximos' ? asc(matches.kickoffAt) : desc(matches.kickoffAt), asc(series.sortOrder))
    .limit(MATCHES_PAGE_SIZE)
    .offset((page - 1) * MATCHES_PAGE_SIZE)
  return { items, page, totalPages, total }
}

/** Partidos del club entre dos instantes (Inicio del panel: hoy y el fin de semana). */
export function listClubMatchesBetween(from: Date, to: Date) {
  return selectAdminMatches()
    .where(and(ne(matches.clubSide, 'ninguno'), gte(matches.kickoffAt, from), lt(matches.kickoffAt, to)))
    .orderBy(asc(matches.kickoffAt), asc(series.sortOrder))
}

export type MatchAdminDetail = NonNullable<Awaited<ReturnType<typeof getMatchAdmin>>>

export async function getMatchAdmin(id: string) {
  const [row] = await db
    .select({
      id: matches.id,
      slug: matches.slug,
      seasonId: matches.seasonId,
      seasonName: seasons.name,
      competitionId: matches.competitionId,
      seriesId: matches.seriesId,
      seriesName: series.name,
      halfLengthMinutes: series.halfLengthMinutes,
      homeTeamId: matches.homeTeamId,
      homeName: homeTeam.name,
      homeShortName: homeTeam.shortName,
      awayTeamId: matches.awayTeamId,
      awayName: awayTeam.name,
      awayShortName: awayTeam.shortName,
      venueId: matches.venueId,
      kickoffAt: matches.kickoffAt,
      roundNumber: matches.roundNumber,
      roundLabel: matches.roundLabel,
      notes: matches.notes,
      status: matches.status,
      resolution: matches.resolution,
      scoreLocked: matches.scoreLocked,
      clubSide: matches.clubSide,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
    })
    .from(matches)
    .innerJoin(seasons, eq(seasons.id, matches.seasonId))
    .innerJoin(series, eq(series.id, matches.seriesId))
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(eq(matches.id, id))
    .limit(1)
  return row ?? null
}

export type SheetPlayer = {
  playerId: string
  name: string
  /** Número con el que está inscrito en la serie (se propone en la nómina). */
  shirtNumber: number | null
  position: (typeof players.$inferSelect)['primaryPosition']
}

export type SheetLineupRow = {
  playerId: string
  role: 'titular' | 'suplente'
  shirtNumber: number | null
  played: boolean
}

export type SheetEvent = {
  id: string
  type: (typeof matchEvents.$inferSelect)['type']
  period: (typeof matchEvents.$inferSelect)['period']
  minute: number | null
  stoppageMinute: number | null
  team: 'club' | 'rival' | null
  playerName: string | null
  relatedPlayerName: string | null
  comment: string | null
}

const POSITION_ORDER = { arquero: 0, defensa: 1, mediocampista: 2, delantero: 3 } as const

/** Todo lo que necesita la pantalla «Cargar resultado» de un partido, en un número fijo de consultas. */
export async function getResultSheet(id: string) {
  const match = await getMatchAdmin(id)
  if (!match) return null
  const ownTeamId =
    match.clubSide === 'local' ? match.homeTeamId : match.clubSide === 'visita' ? match.awayTeamId : null

  const eventPlayer = alias(players, 'event_player')
  const relatedPlayer = alias(players, 'related_player')
  const [registered, lineup, events, [previous]] = await Promise.all([
    db
      .select({
        playerId: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.primaryPosition,
        shirtNumber: squadRegistrations.shirtNumber,
      })
      .from(squadRegistrations)
      .innerJoin(players, eq(players.id, squadRegistrations.playerId))
      .where(
        and(
          eq(squadRegistrations.seasonId, match.seasonId),
          eq(squadRegistrations.seriesId, match.seriesId),
          ne(squadRegistrations.status, 'baja'),
          eq(players.isActive, true),
        ),
      ),
    db
      .select({
        playerId: matchLineups.playerId,
        role: matchLineups.role,
        shirtNumber: matchLineups.shirtNumber,
        played: matchLineups.played,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.primaryPosition,
      })
      .from(matchLineups)
      .innerJoin(players, eq(players.id, matchLineups.playerId))
      .where(eq(matchLineups.matchId, id)),
    db
      .select({
        id: matchEvents.id,
        type: matchEvents.type,
        period: matchEvents.period,
        minute: matchEvents.minute,
        stoppageMinute: matchEvents.stoppageMinute,
        teamId: matchEvents.teamId,
        freeTextName: matchEvents.freeTextName,
        comment: matchEvents.comment,
        createdAt: matchEvents.createdAt,
        playerFirst: eventPlayer.firstName,
        playerLast: eventPlayer.lastName,
        relatedFirst: relatedPlayer.firstName,
        relatedLast: relatedPlayer.lastName,
      })
      .from(matchEvents)
      .leftJoin(eventPlayer, eq(eventPlayer.id, matchEvents.playerId))
      .leftJoin(relatedPlayer, eq(relatedPlayer.id, matchEvents.relatedPlayerId))
      .where(eq(matchEvents.matchId, id)),
    // El partido anterior del club en la misma serie que ya tiene nómina.
    db
      .select({ id: matches.id, kickoffAt: matches.kickoffAt })
      .from(matches)
      .innerJoin(matchLineups, eq(matchLineups.matchId, matches.id))
      .where(
        and(
          eq(matches.seriesId, match.seriesId),
          ne(matches.clubSide, 'ninguno'),
          ne(matches.id, id),
          lt(matches.kickoffAt, match.kickoffAt),
        ),
      )
      .orderBy(desc(matches.kickoffAt))
      .limit(1),
  ])

  // El plantel inscrito más quien esté en la nómina sin inscripción vigente (por ejemplo, tras una baja).
  const squad = new Map<string, SheetPlayer>()
  for (const row of registered) {
    squad.set(row.playerId, {
      playerId: row.playerId,
      name: `${row.firstName} ${row.lastName}`,
      shirtNumber: row.shirtNumber,
      position: row.position,
    })
  }
  for (const row of lineup) {
    if (!squad.has(row.playerId)) {
      squad.set(row.playerId, {
        playerId: row.playerId,
        name: `${row.firstName} ${row.lastName}`,
        shirtNumber: row.shirtNumber,
        position: row.position,
      })
    }
  }

  const fullName = (first: string | null, last: string | null) => (first && last ? `${first} ${last}` : null)
  return {
    match,
    ownTeamId,
    squad: [...squad.values()].sort(
      (a, b) =>
        POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
        (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) ||
        a.name.localeCompare(b.name, 'es'),
    ),
    lineup: lineup.map(
      ({ playerId, role, shirtNumber, played }): SheetLineupRow => ({ playerId, role, shirtNumber, played }),
    ),
    events: events.sort(compareEvents).map(
      (event): SheetEvent => ({
        id: event.id,
        type: event.type,
        period: event.period,
        minute: event.minute,
        stoppageMinute: event.stoppageMinute,
        team: event.teamId === null ? null : event.teamId === ownTeamId ? 'club' : 'rival',
        playerName: fullName(event.playerFirst, event.playerLast) ?? event.freeTextName,
        relatedPlayerName: fullName(event.relatedFirst, event.relatedLast),
        comment: event.comment,
      }),
    ),
    previousMatchId: previous?.id ?? null,
  }
}

export type ResultSheet = NonNullable<Awaited<ReturnType<typeof getResultSheet>>>
