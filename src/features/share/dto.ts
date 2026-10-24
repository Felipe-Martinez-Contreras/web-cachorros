import type { matchResolution, matchStatus } from '@/db/schema/enums'
import type { ShareTemplate } from './lib/cards'

// Datos ya resueltos de una tarjeta para redes: textos públicos (menores con nombre e inicial) y escudos
// como *data URI* PNG, que es lo que acepta Satori (trampa 8). Solo viven en el servidor.

export type CardTeam = { name: string; crest: string | null }

export type CardMatch = {
  /** Las tarjetas son solo de partidos del club: de qué lado juega. */
  clubSide: 'local' | 'visita'
  home: CardTeam
  away: CardTeam
  seriesName: string
  competitionName: string
  roundLabel: string | null
  kickoffAt: string
  venueName: string | null
  status: (typeof matchStatus.enumValues)[number]
  resolution: (typeof matchResolution.enumValues)[number]
  homeScore: number
  awayScore: number
  homePenalties: number | null
  awayPenalties: number | null
}

export type MatchCardData = {
  kind: 'match'
  template: Extract<ShareTemplate, 'resultado' | 'proximo' | 'gol'>
  clubName: string
  match: CardMatch
  scorers: { home: string[]; away: string[] }
  /** Solo en «¡Gol!»: quién y en qué minuto. */
  goal: { scorer: string; minute: string } | null
}

export type WeekendCardData = {
  kind: 'weekend'
  template: Extract<ShareTemplate, 'programacion' | 'resultados'>
  clubName: string
  clubCrest: string | null
  /** Sábado `YYYY-MM-DD`. */
  saturday: string
  matches: CardMatch[]
}

export type NewsCardData = {
  kind: 'news'
  template: 'noticia'
  clubName: string
  clubCrest: string | null
  title: string
  categoryName: string | null
  publishedAt: string
  /** Foto de la noticia como *data URI* JPEG (ya reducida), o `null`. */
  photo: string | null
}

export type ShareCardData = MatchCardData | WeekendCardData | NewsCardData
