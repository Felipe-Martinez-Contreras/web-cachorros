import type { MatchEventDTO } from '@/features/matches/dto'
import { formatMinute } from '@/features/matches/lib/match-clock'
import { formatLongDate, fromIsoDate } from '@/lib/format'

// Tarjetas para redes (especificación 2.8): plantillas, formatos y piezas puras. El render y la caché en
// disco viven en `../render.tsx` y `../cache.ts`.

export const SHARE_FORMATS = {
  cuadrado: { width: 1080, height: 1080, label: '1:1', ext: 'png' },
  vertical: { width: 1080, height: 1350, label: '4:5', ext: 'png' },
  historia: { width: 1080, height: 1920, label: '9:16', ext: 'png' },
  // WhatsApp descarta las imágenes pesadas: la OG va en JPEG ≤ 300 KB (trampa 19).
  og: { width: 1200, height: 630, label: 'Open Graph', ext: 'jpg' },
} as const

export type ShareFormat = keyof typeof SHARE_FORMATS

/** Los tres formatos para redes que se descargan y comparten desde el panel. */
export const SOCIAL_FORMATS = ['cuadrado', 'vertical', 'historia'] as const satisfies readonly ShareFormat[]

/** Plantillas y a qué se refiere su id: un partido, un fin de semana (su sábado) o una noticia. */
export const SHARE_TEMPLATES = {
  resultado: 'match',
  proximo: 'match',
  gol: 'match',
  programacion: 'weekend',
  resultados: 'weekend',
  noticia: 'news',
} as const

export type ShareTemplate = keyof typeof SHARE_TEMPLATES

export const SHARE_TEMPLATE_LABELS: Record<ShareTemplate, string> = {
  resultado: 'Resultado final',
  proximo: 'Próximo partido',
  gol: '¡Gol!',
  programacion: 'Programación del fin de semana',
  resultados: 'Resultados del fin de semana',
  noticia: 'Noticia',
}

export type MatchTemplate = 'resultado' | 'proximo' | 'gol'

/** Estados en los que tiene sentido cada plantilla de partido. */
const MATCH_TEMPLATE_STATUSES: Record<MatchTemplate, readonly string[]> = {
  resultado: ['finalizado', 'en_vivo', 'suspendido'],
  proximo: ['programado', 'postergado'],
  gol: ['en_vivo', 'finalizado'],
}

export function templateFitsStatus(template: MatchTemplate, status: string): boolean {
  return MATCH_TEMPLATE_STATUSES[template].includes(status)
}

/** Plantilla Open Graph de un partido: con marcador si ya se jugó, si no la previa; ninguna si se canceló. */
export function matchOgTemplate(status: string): 'resultado' | 'proximo' | null {
  if (templateFitsStatus('resultado', status)) return 'resultado'
  return templateFitsStatus('proximo', status) ? 'proximo' : null
}

/** Plantillas de partido que se pueden descargar hoy desde el panel. */
export function matchTemplatesFor(status: string, hasClubGoal: boolean): MatchTemplate[] {
  return (['resultado', 'proximo', 'gol'] as const).filter(
    (template) => templateFitsStatus(template, status) && (template !== 'gol' || hasClubGoal),
  )
}

export type ShareRequest = {
  template: ShareTemplate
  id: string
  format: ShareFormat
  /**
   * Solo «Próximo partido» desde el panel: fotos elegidas para una publicación en lugar de las de
   * Configuración. Nunca llega desde la URL pública.
   */
  photos?: readonly (string | null)[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Valida los segmentos de `/api/share/[plantilla]/[id]/[formato]`; `null` si algo no corresponde. */
export function parseShareRequest(template: string, id: string, format: string): ShareRequest | null {
  if (!Object.hasOwn(SHARE_TEMPLATES, template) || !Object.hasOwn(SHARE_FORMATS, format)) return null
  const kind = SHARE_TEMPLATES[template as ShareTemplate]
  if (kind === 'weekend' ? !isValidIsoDate(id) : !UUID.test(id)) return null
  // La noticia es solo la imagen Open Graph.
  if (kind === 'news' && format !== 'og') return null
  return { template: template as ShareTemplate, id: id.toLowerCase(), format: format as ShareFormat }
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Dirección versionada de una tarjeta: con la versión en la URL, se sirve como inmutable. */
export function shareUrl(template: ShareTemplate, id: string, format: ShareFormat, version: string | number) {
  return `/api/share/${template}/${id}/${format}?v=${encodeURIComponent(String(version))}`
}

/** Archivo de la caché en disco, relativo a `SHARE_CACHE_DIR`. */
export function shareCachePath({ template, id, format }: ShareRequest, version: string | number): string {
  return `${template}/${id}-v${version}-${format}.${SHARE_FORMATS[format].ext}`
}

/** Nombre del archivo al descargar: «resultado-2026-10-24-cuadrado.png». */
export function shareFilename({ template, format }: ShareRequest, slug: string): string {
  return `${template}-${slug}-${format}.${SHARE_FORMATS[format].ext}`.slice(0, 120)
}

/**
 * Revisión del diseño de cada plantilla: se suma a su versión para que un rediseño cambie la URL (las
 * tarjetas se sirven como inmutables y Cloudflare las guarda) y la caché en disco se regenere sola.
 */
const DESIGN_REVISION: Partial<Record<ShareTemplate, string>> = {
  // e1: escudos recortados por el disco y con tamaño óptico parejo.
  resultado: 'e1',
  gol: 'e1',
  resultados: 'e1',
  noticia: 'e1',
  proximo: 'd4',
  programacion: 'd4',
}

/** Versión pública de una tarjeta: la de sus datos más la revisión del diseño de la plantilla. */
export function withDesignRevision(template: ShareTemplate, version: string | number): string {
  return `${version}${DESIGN_REVISION[template] ?? ''}`
}

/**
 * Versión de la tarjeta de un partido: la del partido (`share_version`) y la revisión del diseño. «Próximo
 * partido» suma la del matchday (fotos y auspiciador de Configuración, o las elegidas para una publicación).
 */
export function matchCardVersion(
  template: MatchTemplate,
  shareVersion: number | string,
  matchdayRevision: string,
): string {
  return withDesignRevision(
    template,
    template === 'proximo' ? `${shareVersion}${matchdayRevision}` : shareVersion,
  )
}

/** Una versión es un entero (partido) o un hash corto (fin de semana, noticia), más la revisión del diseño. */
export function isValidVersion(value: string | null): value is string {
  return value !== null && /^[0-9a-z]{1,16}$/.test(value)
}

/**
 * Sábado del fin de semana de una fecha `YYYY-MM-DD`: de lunes a sábado, el sábado de esa semana; el
 * domingo, el día anterior. Así cada fin de semana tiene un solo id.
 */
export function weekendOf(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const weekday = date.getUTCDay() // 0 = domingo
  const offset = weekday === 0 ? -1 : 6 - weekday
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

/** Fecha `YYYY-MM-DD` desplazada en días de calendario. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** «Sábado 24 y domingo 25 de octubre» (o con los dos meses si el fin de semana los cruza). */
export function weekendTitle(saturday: string): string {
  const withoutYear = (iso: string) => formatLongDate(fromIsoDate(iso)).replace(/ de \d{4}$/, '')
  const sat = withoutYear(saturday)
  const sun = withoutYear(addDays(saturday, 1))
  const satMonth = sat.split(' de ')[1]
  const sunMonth = sun.split(' de ')[1]
  const first = satMonth === sunMonth ? sat.split(' de ')[0] : sat
  return `${first} y ${sun}`.replace(/^./, (letter) => letter.toUpperCase())
}

/** Hash corto y estable (FNV-1a de 32 bits) para versionar una tarjeta hecha de varias piezas. */
export function shortHash(parts: readonly (string | number)[]): string {
  const key = parts.join('|')
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

type GoalEvent = Pick<MatchEventDTO, 'type' | 'period' | 'minute' | 'stoppageMinute' | 'side' | 'playerName'>

const GOAL_TYPES = new Set(['gol', 'gol_penal', 'autogol'])
/** Goles sin autor registrado (típico del rival): «Gol 65'» o «Goles 65', 72'». */
const UNNAMED = 'Gol'

/** ¿Este evento suma un gol para `side`? (`autogol` suma al contrario; la definición por penales no cuenta). */
export function isGoalFor(event: GoalEvent, side: 'home' | 'away'): boolean {
  if (event.period === 'penales' || !GOAL_TYPES.has(event.type) || !event.side) return false
  return event.type === 'autogol' ? event.side !== side : event.side === side
}

/**
 * Goleadores de un equipo con sus minutos, agrupados por jugador en orden de aparición:
 * «J. Pérez 12', 45+2' (p)», «Autogol de M. Soto 30'». Sin nombre registrado, «Gol» a secas.
 */
export function scorerLines(events: readonly GoalEvent[], side: 'home' | 'away'): string[] {
  const lines = new Map<string, string[]>()
  for (const event of events) {
    if (!isGoalFor(event, side)) continue
    const name =
      event.type === 'autogol'
        ? event.playerName
          ? `Autogol de ${event.playerName}`
          : 'Autogol'
        : (event.playerName ?? UNNAMED)
    const minute = formatMinute(event.minute, event.stoppageMinute)
    const mark = [minute, event.type === 'gol_penal' ? '(p)' : ''].filter(Boolean).join(' ')
    const list = lines.get(name) ?? []
    if (mark) list.push(mark)
    lines.set(name, list)
  }
  return [...lines].map(([name, minutes]) => {
    const label = name === UNNAMED && minutes.length > 1 ? 'Goles' : name
    return minutes.length > 0 ? `${label} ${minutes.join(', ')}` : label
  })
}

/** El último gol del club (para la tarjeta «¡Gol!»), o `null` si el club no ha marcado. */
export function lastClubGoal<T extends GoalEvent>(events: readonly T[], clubSide: 'home' | 'away'): T | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event && isGoalFor(event, clubSide)) return event
  }
  return null
}

const CONTENT_MARKER = /\s*\[(COMPLETAR|DECIDIR|VERIFICAR)[^\]]*\]/g

/**
 * Texto de una tarjeta ajustado a un máximo de caracteres, con «…» si se corta. Los marcadores de contenido
 * pendiente (`[COMPLETAR: …]`) no se dibujan: la imagen es pública y circula fuera del sitio.
 */
export function clampText(text: string, max: number): string {
  const clean = text.replace(CONTENT_MARKER, '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  // Si el corte cae justo al final de una palabra, se conserva entera.
  if (clean[max - 1] === ' ') return `${cut.trimEnd()}…`
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Ancho medio de una mayúscula, en em, de cada fuente display de las tarjetas (medido sobre nombres de
 * clubes): Archivo Condensed ExtraBold y Bebas Neue.
 */
export const CHAR_EM = { archivo: 0.56, bebas: 0.42 } as const

/**
 * Tamaño de letra (display, en mayúsculas) para que un nombre quepa entero en `maxLines` líneas de `width`
 * px, sin cortarlo con «…»: parte de `size` y achica hasta `min`. Satori parte las líneas en los espacios.
 */
export function fitDisplaySize(
  text: string,
  width: number,
  size: number,
  maxLines = 2,
  min = size * 0.5,
  charEm: number = CHAR_EM.archivo,
) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  for (let current = size; current > min; current *= 0.94) {
    if (lineCount(words, width / (current * charEm)) <= maxLines) return Math.floor(current)
  }
  return Math.floor(min)
}

/** Líneas que ocupa un nombre en display (mayúsculas) con ese ancho y tamaño de letra. */
export function displayLines(text: string, width: number, size: number, charEm: number = CHAR_EM.archivo) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  return Math.max(1, Math.min(lineCount(words, width / (size * charEm)), 3))
}

/** Líneas que ocupan las palabras con `perLine` caracteres por línea (`Infinity` si una no cabe). */
function lineCount(words: readonly string[], perLine: number): number {
  let lines = 0
  let used = 0
  for (const word of words) {
    if (word.length > perLine) return Number.POSITIVE_INFINITY
    if (lines === 0 || used + 1 + word.length > perLine) {
      lines++
      used = word.length
    } else {
      used += 1 + word.length
    }
  }
  return lines
}

type OgCard = { url: string; width: number; height: number; alt: string }

/** `og:image` de un partido: la tarjeta versionada (resultado o previa); `null` si no corresponde. */
export function matchOgImage(
  match: { id: string; status: string },
  version: number,
  alt: string,
  matchdayRevision: string,
): OgCard | null {
  const template = matchOgTemplate(match.status)
  if (!template) return null
  const { width, height } = SHARE_FORMATS.og
  return {
    url: shareUrl(template, match.id, 'og', matchCardVersion(template, version, matchdayRevision)),
    width,
    height,
    alt,
  }
}

/** `og:image` de una noticia: su versión es la fecha de la última edición. */
export function newsOgImage(news: { id: string; updatedAt: string }, alt: string): OgCard {
  const version = shortHash([Date.parse(news.updatedAt)])
  const { width, height } = SHARE_FORMATS.og
  return { url: shareUrl('noticia', news.id, 'og', version), width, height, alt }
}
