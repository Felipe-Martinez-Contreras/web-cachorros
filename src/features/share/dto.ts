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
  /** Solo en «Próximo partido» (matchday): el auspiciador y las fotos de los 3 paneles. */
  matchday: MatchdayData | null
}

/** Archivo de una foto de la biblioteca (relativo a `UPLOADS_DIR`) y su punto focal. */
export type MatchdayPhotoSource = { file: string; focalX: number; focalY: number }

export type MatchdayData = {
  /** «POWERED BY …»: el auspiciador de las tarjetas, si está vigente. */
  sponsor: string | null
  /** Las 3 fotos (o `null`: el panel usa el fondo del club). Ninguna marcada «contiene menores». */
  photoSources: (MatchdayPhotoSource | null)[]
  /** Las mismas, ya recortadas y tratadas como *data URI* JPEG (las llena `images.ts`, dentro de la cola). */
  photos: (string | null)[]
}

export type WeekendCardData = {
  kind: 'weekend'
  template: Extract<ShareTemplate, 'programacion' | 'resultados'>
  clubName: string
  clubCrest: string | null
  /** Sábado `YYYY-MM-DD`. */
  saturday: string
  matches: CardMatch[]
  /** Solo en «Programación»: «POWERED BY …» con el auspiciador de las tarjetas, si está vigente. */
  sponsor: string | null
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
