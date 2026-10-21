import 'server-only'
import { and, asc, eq, gte, lte, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { matches, series } from '@/db/schema'
import { loadMinorIds } from '@/features/players/public'
import { env } from '@/lib/env'
import type { LiveMatchDTO, LiveMatchStateDTO } from './dto'
import { LATE_START_MS, LIVE_POLL_MS, SOON_WINDOW_MS, toLiveEvent } from './lib/live-poll'
import { namedPlayerIds, selectEventRows, toEventDTOs } from './public-events'
import { isClubMatch } from './queries'

// Lecturas de `/api/live/*` (especificación 2.6): sin `use cache` de Next, porque la caché es la del borde
// (`s-maxage=10`) y el origen debe responder el estado actual. Una consulta indexada por llamada.

const stateColumns = {
  id: matches.id,
  slug: matches.slug,
  status: matches.status,
  period: matches.period,
  periodStartedAt: matches.periodStartedAt,
  kickoffAt: matches.kickoffAt,
  halfLengthMinutes: series.halfLengthMinutes,
  homeScore: matches.homeScore,
  awayScore: matches.awayScore,
  homePenalties: matches.homePenalties,
  awayPenalties: matches.awayPenalties,
  version: matches.shareVersion,
}

type StateRow = {
  id: string
  slug: string
  status: LiveMatchStateDTO['status']
  period: LiveMatchStateDTO['period']
  periodStartedAt: Date | null
  kickoffAt: Date
  halfLengthMinutes: number
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
  version: number
}

function toState(row: StateRow): LiveMatchStateDTO {
  return {
    ...row,
    periodStartedAt: row.periodStartedAt?.toISOString() ?? null,
    kickoffAt: row.kickoffAt.toISOString(),
  }
}

/** Partidos del club en vivo o por comenzar (≤ 30 min, o atrasados hasta 3 h), en el orden de las series. */
export async function getLiveCurrent(now = new Date()): Promise<LiveMatchStateDTO[]> {
  const rows = await db
    .select(stateColumns)
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .where(
      and(
        isClubMatch,
        or(
          eq(matches.status, 'en_vivo'),
          and(
            eq(matches.status, 'programado'),
            lte(matches.kickoffAt, new Date(now.getTime() + SOON_WINDOW_MS)),
            gte(matches.kickoffAt, new Date(now.getTime() - LATE_START_MS)),
          ),
        ),
      ),
    )
    .orderBy(asc(series.sortOrder), asc(matches.kickoffAt))
  return rows.map(toState)
}

/** Estado y cronología de un partido del club; `null` si no existe o es entre rivales. */
export async function getLiveMatch(id: string): Promise<LiveMatchDTO | null> {
  const [row] = await db
    .select({ ...stateColumns, homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .where(and(isClubMatch, eq(matches.id, id)))
    .limit(1)
  if (!row) return null
  const { homeTeamId, awayTeamId, ...state } = row
  const eventRows = await selectEventRows(row.id)
  const minors = await loadMinorIds(namedPlayerIds(eventRows))
  const events = toEventDTOs(eventRows, { homeTeamId, awayTeamId }, minors).map(toLiveEvent)
  return { match: toState(state), events }
}

/** Intervalo base del polling: el de la especificación, salvo en desarrollo si `LIVE_POLL_MS` lo acorta. */
export function livePollBaseMs(): number {
  return env.SITE_ENV === 'development' && env.LIVE_POLL_MS ? env.LIVE_POLL_MS : LIVE_POLL_MS
}
