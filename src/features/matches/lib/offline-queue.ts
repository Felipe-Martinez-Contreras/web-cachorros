/**
 * Cola de la consola en vivo (especificación 7.3): sin señal, las acciones se guardan en el celular y se
 * envían al reconectar. Lógica pura: el almacenamiento se inyecta y cada función devuelve una cola nueva.
 *
 * - Sobrevive a una recarga (se guarda en `localStorage` por partido).
 * - Se procesa en orden, una acción a la vez.
 * - Un error de red deja la acción pendiente (se reintenta); un rechazo del servidor la deja **fallida**,
 *   visible con su mensaje, hasta que alguien la reintente o la descarte a mano. Nunca se pierde en silencio.
 * - El id de cada acción es su `clientEventId`: el servidor ignora los duplicados.
 */

export type QueuedKind = 'event' | 'period' | 'undo' | 'finish' | 'suspend'

export type QueuedAction = {
  /** UUID: también es el `clientEventId` de los eventos. */
  id: string
  kind: QueuedKind
  input: Record<string, unknown>
  /** Texto para la persona: «Gol de 9 · Pérez, 23'». */
  label: string
  createdAt: number
  attempts: number
  status: 'pending' | 'failed'
  /** Mensaje del servidor cuando falló de forma definitiva. */
  error?: string
}

/** Lo mínimo de `Storage` que usa la cola (inyectable en pruebas). */
export type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KEY_PREFIX = 'cachorros:consola:'
const KINDS: ReadonlySet<string> = new Set(['event', 'period', 'undo', 'finish', 'suspend'])

export function queueKey(matchId: string): string {
  return `${KEY_PREFIX}${matchId}`
}

function isQueuedAction(value: unknown): value is QueuedAction {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.kind === 'string' &&
    KINDS.has(item.kind) &&
    typeof item.label === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.attempts === 'number' &&
    (item.status === 'pending' || item.status === 'failed') &&
    !!item.input &&
    typeof item.input === 'object'
  )
}

/**
 * Lee la cola guardada. Si el almacenamiento no está disponible (modo privado, lleno: trampa 20) o el
 * contenido está dañado, devuelve una cola vacía en vez de romper la consola.
 */
export function loadQueue(storage: QueueStorage | null, matchId: string): QueuedAction[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(queueKey(matchId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isQueuedAction) : []
  } catch {
    return []
  }
}

/** Guarda la cola; `false` si no se pudo (la consola avisa que las pendientes no sobrevivirán una recarga). */
export function saveQueue(storage: QueueStorage | null, matchId: string, queue: QueuedAction[]): boolean {
  if (!storage) return false
  try {
    if (queue.length === 0) storage.removeItem(queueKey(matchId))
    else storage.setItem(queueKey(matchId), JSON.stringify(queue))
    return true
  } catch {
    return false
  }
}

/** Agrega al final; el mismo id dos veces (doble toque) no se duplica. */
export function enqueue(queue: QueuedAction[], action: QueuedAction): QueuedAction[] {
  return queue.some((item) => item.id === action.id) ? queue : [...queue, action]
}

/** La próxima que hay que enviar: la primera pendiente (las fallidas esperan una decisión). */
export function nextPending(queue: QueuedAction[]): QueuedAction | null {
  return queue.find((item) => item.status === 'pending') ?? null
}

export type SendOutcome =
  | { kind: 'done' }
  /** No llegó (sin red, servidor caído): se reintenta más tarde. */
  | { kind: 'retry' }
  /** El servidor la rechazó: no tiene sentido reintentarla sola. */
  | { kind: 'rejected'; message: string }

/** Aplica el resultado de un envío a la cola. */
export function applyOutcome(queue: QueuedAction[], id: string, outcome: SendOutcome): QueuedAction[] {
  if (outcome.kind === 'done') return queue.filter((item) => item.id !== id)
  return queue.map((item) => {
    if (item.id !== id) return item
    if (outcome.kind === 'retry') return { ...item, attempts: item.attempts + 1 }
    return { ...item, attempts: item.attempts + 1, status: 'failed', error: outcome.message }
  })
}

/** «Reintentar» una fallida: vuelve a la cola como pendiente, en su lugar. */
export function retryFailed(queue: QueuedAction[], id: string): QueuedAction[] {
  return queue.map((item) => (item.id === id ? { ...item, status: 'pending', error: undefined } : item))
}

/** «Descartar» una fallida: solo por decisión de la persona. */
export function discard(queue: QueuedAction[], id: string): QueuedAction[] {
  return queue.filter((item) => item.id !== id)
}

/** Texto del indicador: «Sin conexión · 2 acciones pendientes». `null` si no hay nada que avisar. */
export function queueStatusText(queue: QueuedAction[], online: boolean): string | null {
  const pending = queue.filter((item) => item.status === 'pending').length
  const failed = queue.length - pending
  const parts: string[] = []
  if (!online) parts.push('Sin conexión')
  if (pending > 0) parts.push(pending === 1 ? '1 acción pendiente' : `${pending} acciones pendientes`)
  if (failed > 0)
    parts.push(failed === 1 ? '1 acción no se pudo guardar' : `${failed} acciones no se pudieron guardar`)
  return parts.length > 0 ? parts.join(' · ') : null
}
