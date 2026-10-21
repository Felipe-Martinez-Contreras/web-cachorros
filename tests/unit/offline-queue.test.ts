import { describe, expect, it } from 'vitest'
import {
  applyOutcome,
  discard,
  enqueue,
  loadQueue,
  nextPending,
  type QueuedAction,
  type QueueStorage,
  queueKey,
  queueStatusText,
  retryFailed,
  saveQueue,
} from '@/features/matches/lib/offline-queue'

const MATCH = '018f0000-0000-7000-8000-00000000abcd'

function memoryStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const action = (id: string, extra: Partial<QueuedAction> = {}): QueuedAction => ({
  id,
  kind: 'event',
  input: { type: 'gol' },
  label: `Gol ${id}`,
  createdAt: 1,
  attempts: 0,
  status: 'pending',
  ...extra,
})

describe('cola de la consola en vivo', () => {
  it('sobrevive a una recarga: se guarda y se vuelve a leer por partido', () => {
    const storage = memoryStorage()
    const queue = enqueue(enqueue([], action('a')), action('b'))
    expect(saveQueue(storage, MATCH, queue)).toBe(true)
    expect(loadQueue(storage, MATCH)).toEqual(queue)
    expect(loadQueue(storage, 'otro-partido')).toEqual([])
    // Vacía, se borra la clave.
    saveQueue(storage, MATCH, [])
    expect(storage.data.has(queueKey(MATCH))).toBe(false)
  })

  it('el mismo toque dos veces no se encola dos veces', () => {
    expect(enqueue(enqueue([], action('a')), action('a'))).toHaveLength(1)
  })

  it('sin red queda pendiente y suma intentos; al llegar, sale de la cola', () => {
    let queue = [action('a'), action('b')]
    queue = applyOutcome(queue, 'a', { kind: 'retry' })
    expect(queue[0]).toMatchObject({ id: 'a', status: 'pending', attempts: 1 })
    expect(nextPending(queue)?.id).toBe('a')
    queue = applyOutcome(queue, 'a', { kind: 'done' })
    expect(queue.map((item) => item.id)).toEqual(['b'])
  })

  it('un rechazo del servidor no se descarta: queda fallida con su mensaje hasta que alguien decida', () => {
    let queue = applyOutcome([action('a'), action('b')], 'a', {
      kind: 'rejected',
      message: 'El partido ya está finalizado.',
    })
    expect(queue[0]).toMatchObject({ status: 'failed', error: 'El partido ya está finalizado.' })
    // La siguiente sigue su curso; la fallida espera.
    expect(nextPending(queue)?.id).toBe('b')
    expect(queueStatusText(queue, true)).toBe('1 acción pendiente · 1 acción no se pudo guardar')

    queue = retryFailed(queue, 'a')
    expect(queue[0]).toMatchObject({ status: 'pending', error: undefined })
    queue = discard(queue, 'a')
    expect(queue.map((item) => item.id)).toEqual(['b'])
  })

  it('el indicador avisa sin conexión y cuántas faltan', () => {
    expect(queueStatusText([action('a'), action('b')], false)).toBe('Sin conexión · 2 acciones pendientes')
    expect(queueStatusText([], false)).toBe('Sin conexión')
    expect(queueStatusText([], true)).toBeNull()
  })

  it('si el almacenamiento falla o está dañado, la consola sigue con la cola vacía', () => {
    const broken: QueueStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    expect(loadQueue(broken, MATCH)).toEqual([])
    expect(saveQueue(broken, MATCH, [action('a')])).toBe(false)
    expect(loadQueue(null, MATCH)).toEqual([])

    const storage = memoryStorage()
    storage.setItem(queueKey(MATCH), '{no es json')
    expect(loadQueue(storage, MATCH)).toEqual([])
    storage.setItem(queueKey(MATCH), JSON.stringify([action('a'), { id: 'b', kind: 'otra' }]))
    expect(loadQueue(storage, MATCH).map((item) => item.id)).toEqual(['a'])
  })
})
