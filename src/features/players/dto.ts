import type { playerPosition, positionDetail, staffRole } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

// DTOs públicos del plantel. Nunca llevan la fecha de nacimiento; los menores de edad van sin apellido
// completo, sin apodo, sin foto y sin enlace a ficha (especificación 6.3).

type Position = (typeof playerPosition.enumValues)[number]

export type SquadPlayerDTO = {
  /** «Juan Pérez», o «Juan P.» si es menor de edad. */
  name: string
  /** Slug de la ficha; `null` si no tiene. */
  slug: string | null
  nickname: string | null
  shirtNumber: number | null
  position: Position
  isCaptain: boolean
  photo: ImageDTO | null
}

export type StaffDTO = {
  name: string
  role: (typeof staffRole.enumValues)[number]
  photo: ImageDTO | null
}

export type SquadDTO = {
  series: { name: string; slug: string; description: string | null }
  seasonName: string
  players: SquadPlayerDTO[]
  staff: StaffDTO[]
}

export type PlayerSeasonStatsDTO = {
  seasonName: string
  seriesName: string
  appearances: number
  goals: number
  yellowCards: number
  redCards: number
}

export type PlayerProfileDTO = {
  name: string
  slug: string
  nickname: string | null
  position: Position
  positionDetail: (typeof positionDetail.enumValues)[number] | null
  photo: ImageDTO | null
  /** Series en las que juega esta temporada. */
  current: { seriesName: string; seriesSlug: string; shirtNumber: number | null; isCaptain: boolean }[]
  stats: PlayerSeasonStatsDTO[]
  totals: { appearances: number; goals: number; yellowCards: number; redCards: number }
}
