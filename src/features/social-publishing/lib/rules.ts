import type { matchStatus, publicationKind } from '@/db/schema/enums'

// Reglas de la publicación en redes (ADR 0009). Lógica pura.

export type PublicationKind = (typeof publicationKind.enumValues)[number]
type MatchStatus = (typeof matchStatus.enumValues)[number]

/** Después de esto se deja de reintentar: queda «Con error» en el panel. */
export const MAX_PUBLISH_ATTEMPTS = 5
/** Espera antes de cada reintento (tras el intento 1, 2, 3 y 4). */
const BACKOFF_MINUTES = [5, 15, 45, 120] as const
/**
 * Un pendiente más viejo que esto ya no sirve (la previa o la programación quedaron atrás). Una programada
 * cuenta desde su hora, no desde que se programó.
 */
export const STALE_PENDING_MS = 48 * 60 * 60 * 1000
/** Un «publicando» más viejo que esto se cortó a medias: no se sabe si llegó a Facebook. */
export const STUCK_PUBLISHING_MS = 10 * 60 * 1000
/** Los resultados esperan esto desde que el partido se finalizó, por si se corrige el marcador. */
export const RESULT_DELAY_MS = 10 * 60 * 1000
/** Solo se publican resultados recientes. */
export const RESULT_WINDOW_MS = 6 * 60 * 60 * 1000

/** Qué publicación corresponde a un partido según su estado (`null` si ninguna). */
export function publicationKindFor(
  status: MatchStatus,
): Extract<PublicationKind, 'proximo' | 'resultado'> | null {
  if (status === 'programado' || status === 'postergado') return 'proximo'
  if (status === 'finalizado') return 'resultado'
  return null
}

type PublicationState = {
  status: 'pendiente' | 'publicando' | 'publicado' | 'error' | 'incierto' | 'descartado' | 'programada'
  attempts: number
  nextAttemptAt: Date | null
  scheduledAt?: Date | null
}

/**
 * ¿Se puede intentar publicar esta fila ahora? Lo publicado, lo que está en curso y lo incierto nunca se
 * vuelve a enviar solo (así no hay posts duplicados); un error se reintenta a su hora y hasta el máximo, y
 * una programada sale desde su hora. Junto con el índice único `(canal, tipo, sujeto)`, es la regla de
 * idempotencia.
 */
export function isPublishable(row: PublicationState, now: Date): boolean {
  if (row.status === 'pendiente') return true
  if (row.status === 'programada') return Boolean(row.scheduledAt && row.scheduledAt <= now)
  if (row.status !== 'error') return false
  return row.attempts < MAX_PUBLISH_ATTEMPTS && row.nextAttemptAt !== null && row.nextAttemptAt <= now
}

export type PublishAvailability =
  | { ok: true }
  | {
      ok: false
      reason: 'sin_configurar' | 'configuracion_incompleta' | 'entorno' | 'desactivada'
      message: string
    }

/**
 * ¿Se puede publicar? Necesita el id y el token de la página, un entorno que lo permita (producción, o
 * `FACEBOOK_ALLOW_NON_PRODUCTION`) y la publicación activada en Configuración.
 */
export function publishAvailability(input: {
  pageId: string | undefined
  token: string | undefined
  siteEnv: string
  allowNonProduction: boolean
  enabled: boolean
}): PublishAvailability {
  if (!input.pageId && !input.token) {
    return {
      ok: false,
      reason: 'sin_configurar',
      message:
        'Falta conectar la página: hay que cargar FACEBOOK_PAGE_ID y FACEBOOK_PAGE_TOKEN en el servidor (guía en docs/integraciones/facebook.md).',
    }
  }
  if (!input.pageId || !input.token) {
    return {
      ok: false,
      reason: 'configuracion_incompleta',
      message: `Falta ${input.pageId ? 'FACEBOOK_PAGE_TOKEN' : 'FACEBOOK_PAGE_ID'} en el servidor: sin las dos no se puede publicar.`,
    }
  }
  if (input.siteEnv !== 'production' && !input.allowNonProduction) {
    return {
      ok: false,
      reason: 'entorno',
      message:
        'Este sitio no es el de producción: no publica en Facebook salvo con FACEBOOK_ALLOW_NON_PRODUCTION=true en el servidor.',
    }
  }
  if (!input.enabled) {
    return {
      ok: false,
      reason: 'desactivada',
      message: 'La publicación en Facebook está desactivada en Facebook → Ajustes.',
    }
  }
  return { ok: true }
}

export type GraphFailure =
  /** Facebook respondió que no se publicó y conviene reintentar (límite de uso, falla temporal). */
  | { kind: 'transitorio'; message: string }
  /** Facebook rechazó la publicación (token vencido, permisos, datos): reintentar no sirve. */
  | { kind: 'definitivo'; message: string }
  /** No hubo respuesta clara: el post pudo quedar publicado. No se reintenta solo. */
  | { kind: 'incierto'; message: string }

/** Códigos de la Graph API que indican una falla temporal o un límite de uso. */
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613])
/** Errores de red que ocurren antes de enviar nada (no hubo conexión). */
const NOT_SENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'])

/** Clasifica una respuesta de error de la Graph API (`status` HTTP y su cuerpo JSON, si lo hubo). */
export function classifyGraphResponse(status: number, body: unknown): GraphFailure {
  const error = (body as { error?: { message?: unknown; code?: unknown } } | null)?.error
  const code = typeof error?.code === 'number' ? error.code : null
  const detail = typeof error?.message === 'string' ? error.message.slice(0, 240) : null
  const message = detail ? `Facebook respondió: ${detail}${code !== null ? ` (código ${code})` : ''}` : null
  if (code !== null && TRANSIENT_CODES.has(code)) {
    return { kind: 'transitorio', message: message ?? 'Facebook pidió esperar un poco.' }
  }
  if (code === 190) {
    return {
      kind: 'definitivo',
      message: 'El token de la página venció o fue revocado: hay que generar uno nuevo (ver la guía).',
    }
  }
  if (status >= 500 && code === null) {
    return { kind: 'incierto', message: `Facebook respondió con un error ${status} sin detalle.` }
  }
  if (status === 429) return { kind: 'transitorio', message: message ?? 'Facebook pidió esperar un poco.' }
  return { kind: 'definitivo', message: message ?? `Facebook rechazó la publicación (HTTP ${status}).` }
}

/** Clasifica un error de `fetch`: sin conexión es seguro reintentar; un corte a medias, no. */
export function classifyNetworkError(error: unknown): GraphFailure {
  const name = (error as { name?: unknown } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') {
    return {
      kind: 'incierto',
      message: 'Facebook no respondió a tiempo: revisa la página antes de reintentar.',
    }
  }
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code
  if (typeof code === 'string' && NOT_SENT_CODES.has(code)) {
    return { kind: 'transitorio', message: 'No hubo conexión con Facebook.' }
  }
  return {
    kind: 'incierto',
    message: 'Se cortó la conexión con Facebook: revisa la página antes de reintentar.',
  }
}

/** Cuándo reintentar después del intento número `attempts`; `null` si ya no corresponde. */
export function nextAttemptAt(attempts: number, now: Date, failure: GraphFailure): Date | null {
  if (failure.kind !== 'transitorio' || attempts >= MAX_PUBLISH_ATTEMPTS) return null
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] ?? BACKOFF_MINUTES[0]
  return new Date(now.getTime() + minutes * 60_000)
}

/** Estado en que queda una publicación después de una falla. */
export function statusAfterFailure(failure: GraphFailure): 'error' | 'incierto' {
  return failure.kind === 'incierto' ? 'incierto' : 'error'
}

/** Quita el token de un texto antes de guardarlo o registrarlo. */
export function redactSecret(text: string, secret: string | undefined): string {
  return secret ? text.split(secret).join('***') : text
}
