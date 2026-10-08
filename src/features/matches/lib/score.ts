import type { matchEventType, matchPeriod } from '@/db/schema/enums'

type EventType = (typeof matchEventType.enumValues)[number]
type Period = (typeof matchPeriod.enumValues)[number]

export type ScoringEvent = { type: EventType; teamId: string | null; period?: Period }
export type Score = { home: number; away: number }

type Sides = { homeTeamId: string; awayTeamId: string }

/**
 * Marcador derivado de los eventos (especificación 8.6): `gol` y `gol_penal` suman al equipo del autor y
 * `autogol` al equipo contrario. Los lanzamientos de la definición por penales no cuentan en el marcador.
 */
export function deriveScore(events: readonly ScoringEvent[], { homeTeamId, awayTeamId }: Sides): Score {
  const score: Score = { home: 0, away: 0 }
  for (const event of events) {
    if (event.period === 'penales') continue
    const side = sideOf(event.teamId, homeTeamId, awayTeamId)
    if (!side) continue
    if (event.type === 'gol' || event.type === 'gol_penal') score[side] += 1
    else if (event.type === 'autogol') score[side === 'home' ? 'away' : 'home'] += 1
  }
  return score
}

/** Resultado de la definición por penales: solo los `gol_penal` registrados en el período `penales`. */
export function derivePenaltyShootout(
  events: readonly ScoringEvent[],
  { homeTeamId, awayTeamId }: Sides,
): Score {
  const score: Score = { home: 0, away: 0 }
  for (const event of events) {
    if (event.period !== 'penales' || event.type !== 'gol_penal') continue
    const side = sideOf(event.teamId, homeTeamId, awayTeamId)
    if (side) score[side] += 1
  }
  return score
}

function sideOf(teamId: string | null, homeTeamId: string, awayTeamId: string): keyof Score | null {
  if (teamId === homeTeamId) return 'home'
  if (teamId === awayTeamId) return 'away'
  return null
}

export type MatchOutcome = 'ganado' | 'empatado' | 'perdido'

/** Resultado desde el punto de vista del club; `null` si el club no juega ese partido. */
export function clubOutcome(score: Score, clubSide: 'local' | 'visita' | 'ninguno'): MatchOutcome | null {
  if (clubSide === 'ninguno') return null
  const own = clubSide === 'local' ? score.home : score.away
  const rival = clubSide === 'local' ? score.away : score.home
  if (own > rival) return 'ganado'
  return own === rival ? 'empatado' : 'perdido'
}
