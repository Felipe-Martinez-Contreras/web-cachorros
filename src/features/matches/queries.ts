import 'server-only'
import { and, asc, desc, eq, gt, gte, inArray, lt, ne } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import {
  competitions,
  matches,
  mediaAssets,
  series,
  siteSettings,
  standingsTables,
  teams,
  venues,
} from '@/db/schema'
import { rankTable } from '@/features/standings/compute'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import { directionsUrls } from '@/lib/links'
import type { MatchDTO, MatchdayDTO, StandingsDTO, TeamDTO } from './dto'
import { startOfSantiagoDay } from './lib/countdown'
import { compactStandings } from './lib/standings'

const homeTeam = alias(teams, 'home_team')
const awayTeam = alias(teams, 'away_team')
const homeCrest = alias(mediaAssets, 'home_crest')
const awayCrest = alias(mediaAssets, 'away_crest')

// Drizzle solo anida un nivel en `select`: equipo y escudo van como grupos separados.
const homeSelect = { name: homeTeam.name, shortName: homeTeam.shortName, isOwnClub: homeTeam.isOwnClub }
const awaySelect = { name: awayTeam.name, shortName: awayTeam.shortName, isOwnClub: awayTeam.isOwnClub }
const homeCrestSelect = {
  variants: homeCrest.variants,
  width: homeCrest.width,
  height: homeCrest.height,
  altText: homeCrest.altText,
  lqip: homeCrest.lqip,
  credit: homeCrest.credit,
  focalX: homeCrest.focalX,
  focalY: homeCrest.focalY,
}
const awayCrestSelect = {
  variants: awayCrest.variants,
  width: awayCrest.width,
  height: awayCrest.height,
  altText: awayCrest.altText,
  lqip: awayCrest.lqip,
  credit: awayCrest.credit,
  focalX: awayCrest.focalX,
  focalY: awayCrest.focalY,
}

/** Una sola consulta por lista de partidos: equipos, escudos, serie, competencia y cancha con joins. */
function selectMatches() {
  return db
    .select({
      id: matches.id,
      slug: matches.slug,
      seriesId: matches.seriesId,
      seriesName: series.name,
      seriesSlug: series.slug,
      seriesOrder: series.sortOrder,
      halfLengthMinutes: series.halfLengthMinutes,
      competitionName: competitions.name,
      roundLabel: matches.roundLabel,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      period: matches.period,
      periodStartedAt: matches.periodStartedAt,
      resolution: matches.resolution,
      clubSide: matches.clubSide,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
      home: homeSelect,
      homeCrest: homeCrestSelect,
      away: awaySelect,
      awayCrest: awayCrestSelect,
      venueName: venues.name,
      venueLat: venues.geoLat,
      venueLng: venues.geoLng,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .leftJoin(homeCrest, eq(homeCrest.id, homeTeam.crestMediaId))
    .leftJoin(awayCrest, eq(awayCrest.id, awayTeam.crestMediaId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
}

type MatchRow = Awaited<ReturnType<typeof selectMatches>>[number]

function toTeamDTO(team: MatchRow['home'], crest: MatchRow['homeCrest']): TeamDTO {
  return {
    name: team.name,
    shortName: team.shortName,
    isOwnClub: team.isOwnClub,
    crest: toImageDTO(crest),
  }
}

function toMatchDTO(row: MatchRow): MatchDTO {
  return {
    id: row.id,
    slug: row.slug,
    seriesName: row.seriesName,
    seriesSlug: row.seriesSlug,
    competitionName: row.competitionName,
    roundLabel: row.roundLabel,
    kickoffAt: row.kickoffAt.toISOString(),
    status: row.status,
    period: row.period,
    periodStartedAt: row.periodStartedAt?.toISOString() ?? null,
    halfLengthMinutes: row.halfLengthMinutes,
    resolution: row.resolution,
    clubSide: row.clubSide,
    home: toTeamDTO(row.home, row.homeCrest),
    away: toTeamDTO(row.away, row.awayCrest),
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homePenalties: row.homePenalties,
    awayPenalties: row.awayPenalties,
    venue: row.venueName
      ? {
          name: row.venueName,
          directionsUrl:
            row.venueLat !== null && row.venueLng !== null
              ? directionsUrls(row.venueLat, row.venueLng).google
              : null,
        }
      : null,
  }
}

const isClubMatch = ne(matches.clubSide, 'ninguno')
const NEXT_MATCH_WINDOW_DAYS = 7

async function featuredSeriesId(): Promise<string | null> {
  const [row] = await db
    .select({ id: siteSettings.featuredSeriesId })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  return row?.id ?? null
}

/**
 * Franja matchday de la portada (especificación 5.3):
 * 1. partidos del club en vivo, en el orden de las series;
 * 2. próximo partido de la serie destacada (o el más próximo dentro de 7 días), con los demás partidos
 *    del club ese mismo día;
 * 3. último resultado.
 */
export async function getMatchday(): Promise<MatchdayDTO | null> {
  'use cache'
  cacheTag(tags.matches(), tags.live(), tags.settings())
  // El estado en vivo cambia rápido: caché corta hasta que llegue el polling (Fase 4).
  cacheLife({ stale: 30, revalidate: 30, expire: 300 })

  const live = await selectMatches()
    .where(and(isClubMatch, eq(matches.status, 'en_vivo')))
    .orderBy(asc(series.sortOrder), asc(matches.kickoffAt))
  if (live.length > 0) return { kind: 'live', matches: live.map(toMatchDTO) }

  const now = new Date()
  const upcoming = and(isClubMatch, eq(matches.status, 'programado'), gt(matches.kickoffAt, now))
  const featuredId = await featuredSeriesId()
  let [next] = featuredId
    ? await selectMatches()
        .where(and(upcoming, eq(matches.seriesId, featuredId)))
        .orderBy(asc(matches.kickoffAt))
        .limit(1)
    : []
  if (!next) {
    const windowEnd = new Date(now.getTime() + NEXT_MATCH_WINDOW_DAYS * 86_400_000)
    ;[next] = await selectMatches()
      .where(and(upcoming, lt(matches.kickoffAt, windowEnd)))
      .orderBy(asc(matches.kickoffAt))
      .limit(1)
  }
  if (next) {
    const dayStart = startOfSantiagoDay(next.kickoffAt)
    const dayEnd = startOfSantiagoDay(next.kickoffAt, 1)
    const sameDay = await selectMatches()
      .where(
        and(
          isClubMatch,
          ne(matches.id, next.id),
          gte(matches.kickoffAt, dayStart),
          lt(matches.kickoffAt, dayEnd),
          inArray(matches.status, ['programado', 'en_vivo', 'finalizado']),
        ),
      )
      .orderBy(asc(matches.kickoffAt))
    return { kind: 'next', match: toMatchDTO(next), alsoToday: sameDay.map(toMatchDTO) }
  }

  const [last] = await selectMatches()
    .where(and(isClubMatch, eq(matches.status, 'finalizado')))
    .orderBy(desc(matches.kickoffAt))
    .limit(1)
  return last ? { kind: 'last', match: toMatchDTO(last) } : null
}

const RECENT_RESULTS_DAYS = 10

/** Último partido finalizado de cada serie activa en los últimos 10 días, en el orden de las series. */
export async function getLatestResults(): Promise<MatchDTO[]> {
  'use cache'
  cacheTag(tags.matches())
  cacheLife('minutes')

  const since = new Date(Date.now() - RECENT_RESULTS_DAYS * 86_400_000)
  const rows = await selectMatches()
    .where(
      and(
        isClubMatch,
        eq(matches.status, 'finalizado'),
        gte(matches.kickoffAt, since),
        eq(series.isActive, true),
      ),
    )
    .orderBy(asc(series.sortOrder), desc(matches.kickoffAt))
  // Viene ordenado por serie y fecha descendente: el primero de cada serie es su último partido.
  const latest = new Map<string, MatchRow>()
  for (const row of rows) if (!latest.has(row.seriesId)) latest.set(row.seriesId, row)
  return [...latest.values()].map(toMatchDTO)
}

/**
 * Mini-tabla de la portada: top 5 de la serie destacada más la fila del club.
 * [DECIDIR: mini-tabla en la portada. Default: sí]
 */
export async function getFeaturedStandings(): Promise<StandingsDTO | null> {
  'use cache'
  cacheTag(tags.matches(), tags.settings())
  cacheLife('minutes')

  const featuredId = await featuredSeriesId()
  if (!featuredId) return null

  const [table] = await db
    .select({
      id: standingsTables.id,
      mode: standingsTables.mode,
      asOf: standingsTables.asOf,
      sourceNote: standingsTables.sourceNote,
      competitionId: standingsTables.competitionId,
      competitionName: competitions.name,
      pointsWin: competitions.pointsWin,
      pointsDraw: competitions.pointsDraw,
      seriesName: series.name,
      seriesSlug: series.slug,
    })
    .from(standingsTables)
    .innerJoin(competitions, eq(competitions.id, standingsTables.competitionId))
    .innerJoin(series, eq(series.id, standingsTables.seriesId))
    .where(eq(standingsTables.seriesId, featuredId))
    .orderBy(desc(standingsTables.asOf))
    .limit(1)
  if (!table) return null

  // La tabla se invalida sola al guardar su grilla o al cargar un resultado de esa competencia y serie.
  cacheTag(tags.standings(table.competitionId, featuredId))
  const ranked = await rankTable({ ...table, seriesId: featuredId })
  if (ranked.length === 0) return null

  const teamRows = await db
    .select({ id: homeTeam.id, team: homeSelect, crest: homeCrestSelect })
    .from(homeTeam)
    .leftJoin(homeCrest, eq(homeCrest.id, homeTeam.crestMediaId))
    .where(
      inArray(
        homeTeam.id,
        ranked.map((row) => row.teamId),
      ),
    )
  const teamById = new Map(teamRows.map((row) => [row.id, toTeamDTO(row.team, row.crest)]))
  const clubId = teamRows.find((row) => row.team.isOwnClub)?.id

  const visible = clubId ? compactStandings(ranked, clubId) : ranked.slice(0, 5)
  return {
    seriesName: table.seriesName,
    seriesSlug: table.seriesSlug,
    competitionName: table.competitionName,
    asOf: table.asOf,
    sourceNote: table.sourceNote,
    rows: visible.flatMap((row) => {
      const team = teamById.get(row.teamId)
      if (!team) return []
      return [
        {
          position: row.position,
          team,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDiff: row.goalDiff,
          points: row.points,
        },
      ]
    }),
  }
}
