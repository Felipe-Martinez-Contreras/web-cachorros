import 'server-only'
import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matchEvents, matches, series, teams } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { toIsoDate } from '@/lib/format'
import {
  addDays,
  matchCardVersion,
  matchTemplatesFor,
  SHARE_TEMPLATE_LABELS,
  type ShareTemplate,
  weekendOf,
  weekendTitle,
} from './lib/cards'
import { matchdayRevision } from './matchday'
import { shareVersionOf } from './queries'

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
