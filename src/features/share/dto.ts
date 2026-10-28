import type { matchResolution, matchStatus } from '@/db/schema/enums'
import type { ShareTemplate } from './lib/cards'

// Datos ya resueltos de una tarjeta para redes: textos públicos (menores con nombre e inicial) y escudos
// como *data URI* PNG, que es lo que acepta Satori (trampa 8). Solo viven en el servidor.

/**
 * Escudo de 512 px (contenido en el cuadrado) y su escala óptica dentro del disco blanco (`crestScale`).
 * `bare`: el mismo tratado para el matchday, sin disco (`crest-card.ts`); solo en esas plantillas.
 */
export type CardCrest = {
  src: string
  scale: number
  bare?: { src: string; scale: number } | null
  /**
   * Lo que falta para `bare`: el PNG y el estilo. Lo trata `images.ts` dentro de la cola de sharp, después de
   * leer los datos (así ninguna consulta espera la cola ni corre dentro de ella).
   */
  bareSource?: { png: Buffer; style: 'color' | 'blanco' | 'grises' } | null
}

export type CardTeam = { name: string; crest: CardCrest | null }

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

/** Archivo de una foto de la biblioteca (relativo a `UPLOADS_DIR`), su punto focal y su acercamiento. */
export type MatchdayPhotoSource = { file: string; focalX: number; focalY: number; focalZoom: number }

/**
 * Línea pequeña sobre «MATCHDAY» (Facebook → Ajustes): un texto («POWERED BY …» o el que se escriba) o
 * un logo en blanco (`src` lo llena `images.ts`, dentro de la cola). `null`: no se dibuja.
 */
export type MatchdayTopLine =
  | { kind: 'texto'; text: string }
  | { kind: 'logo'; file: string; src: string | null }

export type MatchdayData = {
  topLine: MatchdayTopLine | null
  /** Las 3 fotos (o `null`: el panel usa el fondo del club). Ninguna marcada «contiene menores». */
  photoSources: (MatchdayPhotoSource | null)[]
  /** Las mismas, ya recortadas y tratadas como *data URI* JPEG (las llena `images.ts`, dentro de la cola). */
  photos: (string | null)[]
}

export type WeekendCardData = {
  kind: 'weekend'
  template: Extract<ShareTemplate, 'programacion' | 'resultados'>
  clubName: string
  clubCrest: CardCrest | null
  /** Sábado `YYYY-MM-DD`. */
  saturday: string
  matches: CardMatch[]
  /** Solo en «Programación»: la línea superior del matchday (la misma de Facebook → Ajustes). */
  topLine: MatchdayTopLine | null
}

/**
 * «Jornada»: varias series contra el mismo rival el mismo día, con la composición matchday. `match` es la
 * jornada vista como un partido: equipos, cancha y lado del primero de los marcados, `kickoffAt` con la hora
 * de inicio (la del primer partido) y `competitionName` solo si todos son de la misma (si no, vacío).
 */
export type JornadaCardData = {
  kind: 'jornada'
  template: 'jornada'
  clubName: string
  match: CardMatch
  /** Nombres de las series marcadas, en orden de juego (hasta `MAX_JORNADA_SERIES`). */
  series: string[]
  matchday: MatchdayData
}

export type NewsCardData = {
  kind: 'news'
  template: 'noticia'
  clubName: string
  clubCrest: CardCrest | null
  title: string
  categoryName: string | null
  publishedAt: string
  /** Foto de la noticia como *data URI* JPEG (ya reducida, la llena `images.ts` en la cola), o `null`. */
  photo: string | null
  /** Archivo de la foto (relativo a `UPLOADS_DIR`), sin menores. */
  photoFile: string | null
}

export type ShareCardData = MatchCardData | WeekendCardData | JornadaCardData | NewsCardData
