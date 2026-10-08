import type { clubSide, matchEventType, matchPeriod, matchResolution, matchStatus } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

// DTOs públicos de partidos: lo mínimo y serializable. Nunca filas de la BD (especificación 3.2).

export type TeamDTO = {
  name: string
  shortName: string
  crest: ImageDTO | null
  isOwnClub: boolean
}

export type MatchVenueDTO = {
  name: string
  /** Enlace «Cómo llegar» (Google Maps), si la cancha tiene coordenadas. */
  directionsUrl: string | null
}

export type MatchDTO = {
  id: string
  slug: string
  seriesName: string
  seriesSlug: string
  competitionName: string
  roundLabel: string | null
  /** Instante ISO 8601 (UTC). Se formatea siempre en America/Santiago. */
  kickoffAt: string
  status: (typeof matchStatus.enumValues)[number]
  period: (typeof matchPeriod.enumValues)[number]
  periodStartedAt: string | null
  halfLengthMinutes: number
  resolution: (typeof matchResolution.enumValues)[number]
  clubSide: (typeof clubSide.enumValues)[number]
  home: TeamDTO
  away: TeamDTO
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
  venue: MatchVenueDTO | null
}

export type MatchEventDTO = {
  id: string
  type: (typeof matchEventType.enumValues)[number]
  period: (typeof matchPeriod.enumValues)[number]
  minute: number | null
  stoppageMinute: number | null
  side: 'home' | 'away' | null
  /** Nombre público (los menores van como nombre + inicial). */
  playerName: string | null
  relatedPlayerName: string | null
  comment: string | null
}

export type StandingsRowDTO = {
  position: number
  team: TeamDTO
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

export type StandingsDTO = {
  seriesName: string
  seriesSlug: string
  competitionName: string
  /** Fecha `YYYY-MM-DD` de la última actualización. */
  asOf: string | null
  sourceNote: string | null
  rows: StandingsRowDTO[]
}

/** Franja matchday de la portada (5.3), en orden de prioridad. */
export type MatchdayDTO =
  | { kind: 'live'; matches: MatchDTO[] }
  | { kind: 'next'; match: MatchDTO; alsoToday: MatchDTO[] }
  | { kind: 'last'; match: MatchDTO }

/** «Cachorros 1, Los Litres 0»: texto del marcador para lectores de pantalla. */
export function scoreText(match: MatchDTO): string {
  return `${match.home.shortName} ${match.homeScore}, ${match.away.shortName} ${match.awayScore}`
}

/** Hay marcador que mostrar (en vivo o terminado). */
export function hasScore(match: MatchDTO): boolean {
  return match.status === 'en_vivo' || match.status === 'finalizado'
}
