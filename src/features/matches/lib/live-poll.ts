import type { matchStatus } from '@/db/schema/enums'
import type { LiveMatchStateDTO, MatchDTO, MatchEventDTO } from '../dto'

type Status = (typeof matchStatus.enumValues)[number]
type Period = MatchEventDTO['period']

/** Intervalos del polling público (especificación 2.6). */
export const LIVE_POLL_MS = 20_000
export const SOON_POLL_MS = 60_000
/** Un partido «por comenzar» empieza en 30 minutos o menos. */
export const SOON_WINDOW_MS = 30 * 60_000
/** Un partido programado que ya debió empezar se sigue vigilando un rato (la consola puede iniciarse tarde). */
export const LATE_START_MS = 3 * 60 * 60_000
/** El borde (Cloudflare) guarda la respuesta 10 s; el navegador siempre vuelve a preguntar (2.6). */
export const LIVE_CACHE_CONTROL = 'public, max-age=0, s-maxage=10'
/** Tope del *backoff* ante errores. */
export const MAX_BACKOFF_MS = 5 * 60_000

type Watched = { status: Status; kickoffAt: string }

/** ¿Hay que vigilar este partido? En vivo, o programado y por comenzar (o atrasado). */
export function isWatchable(match: Watched, now: number): boolean {
  if (match.status === 'en_vivo') return true
  if (match.status !== 'programado') return false
  const kickoff = new Date(match.kickoffAt).getTime()
  return kickoff - now <= SOON_WINDOW_MS && now - kickoff <= LATE_START_MS
}

/**
 * Cada cuánto consultar (2.6): 20 s con un partido en vivo, 60 s si alguno empieza en 30 minutos o menos y
 * `null` (sin polling) en otro caso. `baseMs` permite acortarlo en las e2e de desarrollo.
 */
export function pollInterval(matches: readonly Watched[], now: number, baseMs = LIVE_POLL_MS): number | null {
  if (matches.some((match) => match.status === 'en_vivo')) return baseMs
  if (matches.some((match) => isWatchable(match, now)))
    return Math.round((baseMs * SOON_POLL_MS) / LIVE_POLL_MS)
  return null
}

/** Espera tras `failures` errores seguidos: el doble cada vez, con tope. */
export function backoffDelay(intervalMs: number, failures: number): number {
  return Math.min(intervalMs * 2 ** Math.max(0, failures), MAX_BACKOFF_MS)
}

/**
 * ETag débil de una respuesta en vivo: cambia con la versión del partido (`share_version` sube con cada
 * evento, paso o cambio de estado), así un sondeo sin cambios recibe un 304.
 */
export function liveEtag(parts: readonly { id: string; version: number; status: string }[]): string {
  const key = parts.map((part) => `${part.id}.${part.version}.${part.status}`).join('|')
  // FNV-1a de 32 bits: corto y suficiente para distinguir versiones (no es una firma de seguridad).
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `W/"${parts.length}-${hash.toString(36)}"`
}

/** ¿El `If-None-Match` de la petición coincide con el ETag actual? */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  return ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === etag || value === '*')
}

/** Períodos en el orden del enum `match_period` (lo verifica una prueba): en la respuesta van por índice. */
export const PERIOD_CODES: readonly Period[] = [
  'previa',
  'primer_tiempo',
  'entretiempo',
  'segundo_tiempo',
  'alargue',
  'penales',
  'terminado',
]

/**
 * Evento en `/api/live/[matchId]`: claves cortas y sin los campos vacíos, para que la respuesta quepa en
 * 2 KB (2.6) aun con 20 eventos. El cliente lo vuelve a expandir con `fromLiveEvent`.
 */
export type LiveEvent = {
  t: MatchEventDTO['type']
  p: number
  m?: number
  s?: number
  d?: 'h' | 'a'
  n?: string
  r?: string
  c?: string
}

export function toLiveEvent(event: MatchEventDTO): LiveEvent {
  const live: LiveEvent = { t: event.type, p: PERIOD_CODES.indexOf(event.period) }
  if (event.minute !== null) live.m = event.minute
  if (event.stoppageMinute) live.s = event.stoppageMinute
  if (event.side) live.d = event.side === 'home' ? 'h' : 'a'
  if (event.playerName) live.n = event.playerName
  if (event.relatedPlayerName) live.r = event.relatedPlayerName
  if (event.comment) live.c = event.comment
  return live
}

/** El evento compacto, otra vez como `MatchEventDTO` (el id es su posición: la lista llega completa). */
export function fromLiveEvent(event: LiveEvent, index: number): MatchEventDTO {
  return {
    id: `en-vivo-${index}`,
    type: event.t,
    period: PERIOD_CODES[event.p] ?? 'primer_tiempo',
    minute: event.m ?? null,
    stoppageMinute: event.s ?? null,
    side: event.d === 'h' ? 'home' : event.d === 'a' ? 'away' : null,
    playerName: event.n ?? null,
    relatedPlayerName: event.r ?? null,
    comment: event.c ?? null,
  }
}

/** Copia en el partido lo que cambia durante el juego. */
export function patchMatch(match: MatchDTO, state: LiveMatchStateDTO): MatchDTO {
  return {
    ...match,
    status: state.status,
    period: state.period,
    periodStartedAt: state.periodStartedAt,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homePenalties: state.homePenalties,
    awayPenalties: state.awayPenalties,
  }
}
