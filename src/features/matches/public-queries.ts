import 'server-only'
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import {
  competitions,
  matchEvents,
  matches,
  matchLineups,
  mediaAssets,
  playerSeasonStats,
  players,
  seasons,
  series,
  slugRedirects,
  standingsTables,
  teams,
  venues,
} from '@/db/schema'
import { loadMinorIds, toPublicPlayerRef } from '@/features/players/public'
import { rankTable } from '@/features/standings/compute'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import { directionsUrls } from '@/lib/links'
import type { SlugEntity } from '@/lib/slug-redirects'
import type {
  MatchDetailDTO,
  MatchDTO,
  MatchEventDTO,
  ScorerDTO,
  SportsNavDTO,
  StandingsGroupDTO,
  TeamDTO,
} from './dto'
import { compareEvents } from './lib/match-clock'
import { featuredSeriesId, isClubMatch, selectMatches, toMatchDTO } from './queries'

// Lecturas públicas de la sección Partidos: cacheadas por tags (especificación 3.4). Toda mutación del
// panel invalida el conjunto mínimo, así que un cambio se ve en la carga siguiente.

/** Series activas, temporadas y serie destacada: lo que necesitan los filtros de Partidos y Plantel. */
export async function getSportsNav(): Promise<SportsNavDTO> {
  'use cache'
  cacheTag(tags.matches(), tags.players(), tags.settings())
  cacheLife('hours')

  const [seriesRows, seasonRows, featuredId] = await Promise.all([
    db
      .select({ id: series.id, slug: series.slug, name: series.name })
      .from(series)
      .where(eq(series.isActive, true))
      .orderBy(asc(series.sortOrder), asc(series.name)),
    db
      .select({ id: seasons.id, name: seasons.name, year: seasons.year, isCurrent: seasons.isCurrent })
      .from(seasons)
      .orderBy(desc(seasons.year)),
    featuredSeriesId(),
  ])
  return {
    series: seriesRows,
    seasons: seasonRows,
    featuredSeriesSlug: seriesRows.find((row) => row.id === featuredId)?.slug ?? null,
  }
}

/** Fixture y resultados del club en una serie y temporada, en orden cronológico. */
export async function getFixture(seriesId: string, seasonId: string): Promise<MatchDTO[]> {
  'use cache'
  cacheTag(tags.matches())
  cacheLife('minutes')

  const rows = await selectMatches()
    .where(and(isClubMatch, eq(matches.seriesId, seriesId), eq(matches.seasonId, seasonId)))
    .orderBy(asc(matches.kickoffAt))
  return rows.map(toMatchDTO)
}

/** Detalle público de un partido del club por su slug; `null` si no existe. */
export async function getMatchDetail(slug: string): Promise<MatchDetailDTO | null> {
  'use cache'
  cacheTag(tags.matches(), tags.players())
  cacheLife('minutes')

  const [row] = await selectMatches()
    .where(and(isClubMatch, eq(matches.slug, slug)))
    .limit(1)
  if (!row) return null
  cacheTag(tags.match(row.id))

  const eventPlayer = alias(players, 'event_player')
  const relatedPlayer = alias(players, 'related_player')
  const [[extra], eventRows, lineupRows] = await Promise.all([
    db
      .select({
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        notes: matches.notes,
        updatedAt: matches.updatedAt,
        shareVersion: matches.shareVersion,
        venueAddress: venues.address,
        venueNotes: venues.notes,
      })
      .from(matches)
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .where(eq(matches.id, row.id)),
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
        player: {
          id: eventPlayer.id,
          firstName: eventPlayer.firstName,
          lastName: eventPlayer.lastName,
          slug: eventPlayer.slug,
        },
        related: {
          id: relatedPlayer.id,
          firstName: relatedPlayer.firstName,
          lastName: relatedPlayer.lastName,
          slug: relatedPlayer.slug,
        },
      })
      .from(matchEvents)
      .leftJoin(eventPlayer, eq(eventPlayer.id, matchEvents.playerId))
      .leftJoin(relatedPlayer, eq(relatedPlayer.id, matchEvents.relatedPlayerId))
      .where(eq(matchEvents.matchId, row.id)),
    db
      .select({
        role: matchLineups.role,
        shirtNumber: matchLineups.shirtNumber,
        played: matchLineups.played,
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        slug: players.slug,
        position: players.primaryPosition,
      })
      .from(matchLineups)
      .innerJoin(players, eq(players.id, matchLineups.playerId))
      .where(eq(matchLineups.matchId, row.id)),
  ])
  if (!extra) return null

  // Una sola consulta decide quiénes son menores entre todos los nombrados en el partido.
  const minors = await loadMinorIds([
    ...lineupRows.map((player) => player.id),
    ...eventRows.flatMap((event) => [event.player?.id, event.related?.id]).filter((id) => id != null),
  ])
  const nameOf = (player: (typeof eventRows)[number]['player']) =>
    player?.id ? toPublicPlayerRef(player, minors).name : null

  const events: MatchEventDTO[] = eventRows.sort(compareEvents).map((event) => ({
    id: event.id,
    type: event.type,
    period: event.period,
    minute: event.minute,
    stoppageMinute: event.stoppageMinute,
    side: event.teamId === extra.homeTeamId ? 'home' : event.teamId === extra.awayTeamId ? 'away' : null,
    playerName: nameOf(event.player) ?? event.freeTextName,
    relatedPlayerName: nameOf(event.related),
    comment: event.comment,
  }))

  const POSITION = { arquero: 0, defensa: 1, mediocampista: 2, delantero: 3 } as const
  const lineup = lineupRows
    .sort(
      (a, b) =>
        POSITION[a.position] - POSITION[b.position] || (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100),
    )
    .map((player) => ({
      ...toPublicPlayerRef(player, minors),
      shirtNumber: player.shirtNumber,
      role: player.role,
      played: player.played,
    }))

  const match = toMatchDTO(row)
  return {
    match,
    notes: extra.notes,
    venue: row.venueName
      ? {
          name: row.venueName,
          address: extra.venueAddress,
          notes: extra.venueNotes,
          directions:
            row.venueLat !== null && row.venueLng !== null
              ? directionsUrls(row.venueLat, row.venueLng)
              : null,
        }
      : null,
    events,
    lineup: {
      starters: lineup
        .filter((player) => player.role === 'titular')
        .map(({ name, slug: playerSlug, shirtNumber }) => ({ name, slug: playerSlug, shirtNumber })),
      substitutes: lineup
        .filter((player) => player.role === 'suplente')
        .map(({ name, slug: playerSlug, shirtNumber, played }) => ({
          name,
          slug: playerSlug,
          shirtNumber,
          played,
        })),
    },
    updatedAt: extra.updatedAt.toISOString(),
    shareVersion: extra.shareVersion,
  }
}

/** Tablas de posiciones de una serie en una temporada (una por competencia y grupo). */
export async function getStandings(seriesId: string, seasonId: string): Promise<StandingsGroupDTO[]> {
  'use cache'
  // `matches`: nombres y escudos de los equipos. Cada tabla agrega su propio tag más abajo.
  cacheTag(tags.matches())
  cacheLife('minutes')

  const tables = await db
    .select({
      id: standingsTables.id,
      mode: standingsTables.mode,
      asOf: standingsTables.asOf,
      sourceNote: standingsTables.sourceNote,
      groupLabel: standingsTables.groupLabel,
      competitionId: standingsTables.competitionId,
      seriesId: standingsTables.seriesId,
      competitionName: competitions.name,
      pointsWin: competitions.pointsWin,
      pointsDraw: competitions.pointsDraw,
      seriesName: series.name,
      seriesSlug: series.slug,
    })
    .from(standingsTables)
    .innerJoin(competitions, eq(competitions.id, standingsTables.competitionId))
    .innerJoin(series, eq(series.id, standingsTables.seriesId))
    .where(and(eq(standingsTables.seriesId, seriesId), eq(competitions.seasonId, seasonId)))
    .orderBy(asc(competitions.name), asc(standingsTables.groupLabel))
  if (tables.length === 0) return []
  for (const table of tables) cacheTag(tags.standings(table.competitionId, table.seriesId))

  const ranked = await Promise.all(tables.map((table) => rankTable(table)))
  const teamIds = [...new Set(ranked.flatMap((rows) => rows.map((row) => row.teamId)))]
  const teamRows =
    teamIds.length > 0
      ? await db
          .select({
            id: teams.id,
            name: teams.name,
            shortName: teams.shortName,
            isOwnClub: teams.isOwnClub,
            crest: {
              variants: mediaAssets.variants,
              width: mediaAssets.width,
              height: mediaAssets.height,
              altText: mediaAssets.altText,
              lqip: mediaAssets.lqip,
              credit: mediaAssets.credit,
              focalX: mediaAssets.focalX,
              focalY: mediaAssets.focalY,
            },
          })
          .from(teams)
          .leftJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
          .where(inArray(teams.id, teamIds))
      : []
  const teamById = new Map<string, TeamDTO>(
    teamRows.map((team) => [
      team.id,
      {
        name: team.name,
        shortName: team.shortName,
        isOwnClub: team.isOwnClub,
        crest: toImageDTO(team.crest),
      },
    ]),
  )

  return tables.map((table, index) => ({
    seriesName: table.seriesName,
    seriesSlug: table.seriesSlug,
    competitionName: table.competitionName,
    asOf: table.asOf,
    sourceNote: table.sourceNote,
    groupLabel: table.groupLabel,
    mode: table.mode,
    rows: (ranked[index] ?? []).flatMap((row) => {
      const team = teamById.get(row.teamId)
      if (!team) return []
      const { position, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points } = row
      return [{ position, team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points }]
    }),
  }))
}

/** Goleadores de una serie y temporada, desde la vista de estadísticas. Los empates comparten posición. */
export async function getTopScorers(seriesId: string, seasonId: string): Promise<ScorerDTO[]> {
  'use cache'
  cacheTag(tags.stats(), tags.players())
  cacheLife('minutes')

  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      slug: players.slug,
      goals: playerSeasonStats.goals,
      appearances: playerSeasonStats.appearances,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(players.id, playerSeasonStats.playerId))
    .where(
      and(
        eq(playerSeasonStats.seriesId, seriesId),
        eq(playerSeasonStats.seasonId, seasonId),
        gt(playerSeasonStats.goals, 0),
      ),
    )
    // A igual cantidad de goles, primero quien los hizo en menos partidos; después por apellido.
    .orderBy(desc(playerSeasonStats.goals), asc(playerSeasonStats.appearances), asc(players.lastName))
  const minors = await loadMinorIds(rows.map((row) => row.id))

  let rank = 0
  let previousGoals = -1
  return rows.map((row, index) => {
    if (row.goals !== previousGoals) rank = index + 1
    previousGoals = row.goals
    return { rank, player: toPublicPlayerRef(row, minors), goals: row.goals, appearances: row.appearances }
  })
}

/** Si `slug` es una dirección antigua de esa entidad, devuelve el slug vigente (para la redirección). */
export async function resolveSlugRedirect(entityType: SlugEntity, slug: string): Promise<string | null> {
  'use cache'
  cacheTag(tags.matches(), tags.players())
  cacheLife('minutes')

  const [redirect] = await db
    .select({ entityId: slugRedirects.entityId })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.oldSlug, slug)))
    .limit(1)
  if (!redirect) return null
  const table = { match: matches, player: players, series, team: teams, news: null }[entityType]
  if (!table) return null
  const [current] = await db.select({ slug: table.slug }).from(table).where(eq(table.id, redirect.entityId))
  return current?.slug ?? null
}
