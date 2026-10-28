import 'server-only'
import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matchEvents, matches, series, teams } from '@/db/schema'
import { startOfSantiagoDay } from '@/features/matches/lib/countdown'
import { isClubMatch } from '@/features/matches/queries'
import { formatLongDate, fromIsoDate, toIsoDate } from '@/lib/format'
import {
  addDays,
  matchCardVersion,
  matchTemplatesFor,
  SHARE_TEMPLATE_LABELS,
  type ShareFormat,
  type ShareTemplate,
  weekendOf,
  weekendTitle,
} from './lib/cards'
import { groupJornadas, MAX_JORNADA_SERIES, parseJornadaKey } from './lib/jornada'
import { matchdayRevision } from './matchday'
import { jornadaAllMatches, shareVersionOf } from './queries'

// Tarjetas que el panel ofrece para descargar y compartir (especificación 7.3 y 2.8).

export type ShareCardLink = {
  template: ShareTemplate
  /** «Resultado final», «Programación del fin de semana»… */
  label: string
  /** De qué es: «Honor: Cachorros 2–1 Rival» o el fin de semana. */
  title: string
  id: string
  version: string
  /** Para nombrar el archivo descargado. */
  slug: string
  /** Formatos que se ofrecen (por defecto, los tres para redes). */
  formats?: readonly ShareFormat[]
  /** Direcciones propias por formato (la jornada con series o fotos elegidas sale de la ruta del panel). */
  urls?: Partial<Record<ShareFormat, string>>
  /**
   * `false`: la vista previa todavía no está dibujada y se ofrece un enlace para verla (así abrir la página no
   * dibuja nada). Sin el campo, se muestra la imagen como siempre.
   */
  previewCached?: boolean
}

const homeTeam = alias(teams, 'home_team')
const awayTeam = alias(teams, 'away_team')

/** Tarjetas de un partido del club según su estado (resultado, previa y «¡Gol!» si el club marcó). */
export async function matchShareCards(matchId: string): Promise<ShareCardLink[]> {
  const [match] = await db
    .select({
      id: matches.id,
      slug: matches.slug,
      status: matches.status,
      clubSide: matches.clubSide,
      version: matches.shareVersion,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeName: homeTeam.shortName,
      awayName: awayTeam.shortName,
      seriesName: series.name,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(and(eq(matches.id, matchId), isClubMatch))
    .limit(1)
  if (!match) return []

  const clubTeamId = match.clubSide === 'local' ? match.homeTeamId : match.awayTeamId
  const goals = await db
    .select({ type: matchEvents.type, teamId: matchEvents.teamId, period: matchEvents.period })
    .from(matchEvents)
    .where(eq(matchEvents.matchId, matchId))
  const hasClubGoal = goals.some(
    (event) =>
      event.period !== 'penales' &&
      (((event.type === 'gol' || event.type === 'gol_penal') && event.teamId === clubTeamId) ||
        (event.type === 'autogol' && event.teamId !== null && event.teamId !== clubTeamId)),
  )
  const templates = matchTemplatesFor(match.status, hasClubGoal)
  const matchday = templates.includes('proximo') ? await matchdayRevision() : ''
  const versus = `${match.seriesName}: ${match.homeName} vs ${match.awayName}`
  const scored = `${match.seriesName}: ${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName}`
  return templates.map((template) => ({
    template,
    label: SHARE_TEMPLATE_LABELS[template],
    title: template === 'proximo' ? versus : scored,
    id: match.id,
    version: matchCardVersion(template, match.version, matchday),
    slug: match.slug,
  }))
}

/**
 * Tarjetas recientes para el inicio del panel: la programación y los resultados del fin de semana en
 * curso (o el que viene), los del fin de semana anterior y los últimos resultados de la semana.
 */
export async function recentShareCards(now: Date): Promise<ShareCardLink[]> {
  const today = toIsoDate(now)
  const saturday = weekendOf(today)
  const previous = addDays(saturday, -7)
  const weekendCandidates: { template: 'programacion' | 'resultados'; id: string }[] = [
    { template: 'programacion', id: saturday },
    { template: 'resultados', id: saturday },
    { template: 'resultados', id: previous },
  ]
  const weekend = await Promise.all(
    weekendCandidates.map(async ({ template, id }) => {
      const current = await shareVersionOf({ template, id, format: 'cuadrado' })
      return current
        ? {
            template,
            label: SHARE_TEMPLATE_LABELS[template],
            title: weekendTitle(id),
            id,
            version: current.version,
            slug: current.slug,
          }
        : null
    }),
  )

  const recent = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        isClubMatch,
        eq(matches.status, 'finalizado'),
        gte(matches.kickoffAt, new Date(now.getTime() - 7 * 86_400_000)),
        lt(matches.kickoffAt, now),
      ),
    )
    .orderBy(desc(matches.kickoffAt))
    .limit(3)
  const results = await Promise.all(
    recent.map(
      async ({ id }) => (await matchShareCards(id)).find((card) => card.template === 'resultado') ?? null,
    ),
  )
  return [...weekend, ...results].filter((card): card is ShareCardLink => card !== null)
}

/** «Sábado 31 de octubre» (sin el año) a partir de `AAAA-MM-DD`. */
export function jornadaDayTitle(date: string): string {
  return formatLongDate(fromIsoDate(date))
    .replace(/ de \d{4}$/, '')
    .replace(/^./, (letter) => letter.toUpperCase())
}

export type UpcomingJornada = {
  key: string
  /** «Sábado 31 de octubre». */
  day: string
  rivalName: string
  /** Series en orden de juego. */
  series: string[]
}

/** Días que mira «Jornadas próximas» en Partidos. */
const UPCOMING_JORNADA_DAYS = 14

/**
 * Jornadas próximas (desde hoy y por dos semanas): partidos programados del club agrupados por día y
 * rival, solo las de 2 o más series (con una sola está la tarjeta del partido).
 */
export async function upcomingJornadas(now: Date): Promise<UpcomingJornada[]> {
  const rivalTeam = alias(teams, 'rival_team')
  const rows = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      clubSide: matches.clubSide,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      seriesId: matches.seriesId,
      seriesName: series.name,
      seriesOrder: series.sortOrder,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .where(
      and(
        isClubMatch,
        eq(matches.status, 'programado'),
        gte(matches.kickoffAt, startOfSantiagoDay(now)),
        lt(matches.kickoffAt, startOfSantiagoDay(now, UPCOMING_JORNADA_DAYS)),
      ),
    )
    .orderBy(asc(matches.kickoffAt))
    .limit(200)
  const jornadas = groupJornadas(
    rows.map((row) => ({ ...row, rivalId: row.clubSide === 'local' ? row.awayTeamId : row.homeTeamId })),
  ).filter((jornada) => jornada.matches.length >= 2)
  if (jornadas.length === 0) return []
  const rivals = await db
    .select({ id: rivalTeam.id, name: rivalTeam.shortName })
    .from(rivalTeam)
    .where(
      inArray(
        rivalTeam.id,
        jornadas.map((jornada) => jornada.rivalId),
      ),
    )
  return jornadas.map((jornada) => ({
    key: jornada.key,
    day: jornadaDayTitle(jornada.date),
    rivalName: rivals.find((rival) => rival.id === jornada.rivalId)?.name ?? 'Rival',
    series: jornada.matches.map((match) => match.seriesName),
  }))
}

export type JornadaAdmin = {
  key: string
  date: string
  day: string
  rivalName: string
  /** Partidos programados de la jornada, en orden de juego. */
  matches: { id: string; seriesId: string; seriesName: string; kickoffAt: string }[]
  /** Series marcadas por defecto: todas las que caben en la tarjeta. */
  defaultSeries: string[]
}

/** Ficha de una jornada para el panel; `null` si la clave no corresponde o ya no tiene partidos. */
export async function jornadaAdmin(key: string): Promise<JornadaAdmin | null> {
  const parsed = parseJornadaKey(key)
  if (!parsed) return null
  const rows = await jornadaAllMatches(key)
  if (rows.length === 0) return null
  const [rival] = await db
    .select({ name: teams.shortName })
    .from(teams)
    .where(eq(teams.id, parsed.rivalId))
    .limit(1)
  return {
    key,
    date: parsed.date,
    day: jornadaDayTitle(parsed.date),
    rivalName: rival?.name ?? 'Rival',
    matches: rows.map((row) => ({
      id: row.id,
      seriesId: row.seriesId,
      seriesName: row.seriesName,
      kickoffAt: row.kickoffAt.toISOString(),
    })),
    defaultSeries: rows.slice(0, MAX_JORNADA_SERIES).map((row) => row.seriesId),
  }
}
