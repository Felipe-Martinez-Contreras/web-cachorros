import type {
  clubSide,
  matchEventType,
  matchPeriod,
  matchResolution,
  matchStatus,
  standingsMode,
} from '@/db/schema/enums'
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

/** Jugador en una página pública: el nombre ya viene resuelto para menores; sin ficha no hay enlace. */
export type PlayerRefDTO = { name: string; slug: string | null }

export type LineupPlayerDTO = PlayerRefDTO & { shirtNumber: number | null }

export type MatchDetailDTO = {
  match: MatchDTO
  /** Motivo de una postergación o nota del partido. */
  notes: string | null
  venue: {
    name: string
    address: string | null
    notes: string | null
    directions: { google: string; waze: string; apple: string } | null
  } | null
  events: MatchEventDTO[]
  /** Nómina del club: titulares y suplentes (entraron o no). */
  lineup: { starters: LineupPlayerDTO[]; substitutes: (LineupPlayerDTO & { played: boolean })[] }
  /** Instante ISO de la última modificación (para `dateModified` y el calendario). */
  updatedAt: string
  shareVersion: number
}

export type StandingsGroupDTO = StandingsDTO & {
  groupLabel: string
  mode: (typeof standingsMode.enumValues)[number]
}

export type ScorerDTO = {
  /** Los empates comparten posición. */
  rank: number
  player: PlayerRefDTO
  goals: number
  appearances: number
}

export type SportsNavDTO = {
  series: { id: string; slug: string; name: string }[]
  seasons: { id: string; name: string; year: number; isCurrent: boolean }[]
  featuredSeriesSlug: string | null
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
