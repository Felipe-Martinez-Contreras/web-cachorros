'use client' // Cliente: cola de la consola guardada en el celular, enviada al haber conexión.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '@/lib/action-result'
import {
  applyOutcome,
  discard,
  enqueue,
  loadQueue,
  nextPending,
  type QueuedAction,
  type QueuedKind,
  type QueueStorage,
  retryFailed,
  type SendOutcome,
  saveQueue,
} from '../lib/offline-queue'

export type Senders = Record<QueuedKind, (input: unknown) => Promise<ActionResult<unknown>>>

/** Cada cuánto se reintenta mientras quedan pendientes (además del evento `online`). */
const RETRY_MS = 10_000

function browserStorage(): QueueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Cola de la consola en vivo (especificación 7.3). Las acciones se guardan antes de enviarse, así que
 * sobreviven a una recarga; se envían en orden al haber conexión y, al confirmarse, la consola relee su
 * estado. Las rechazadas quedan visibles hasta que la persona decida.
 */
export function useConsoleQueue(matchId: string, senders: Senders, onConfirmed: () => void) {
  const [queue, setQueue] = useState<QueuedAction[]>([])
  const [online, setOnline] = useState(true)
  const [persisted, setPersisted] = useState(true)
  const queueRef = useRef<QueuedAction[]>([])
  const sendersRef = useRef(senders)
  sendersRef.current = senders
  const confirmedRef = useRef(onConfirmed)
  confirmedRef.current = onConfirmed
  const flushing = useRef(false)

  const update = useCallback(
    (change: (current: QueuedAction[]) => QueuedAction[]) => {
      queueRef.current = change(queueRef.current)
      setQueue(queueRef.current)
      setPersisted(saveQueue(browserStorage(), matchId, queueRef.current))
    },
    [matchId],
  )

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    let confirmed = false
    try {
      for (;;) {
        const next = nextPending(queueRef.current)
        if (!next) break
        let outcome: SendOutcome
        try {
          const result = await sendersRef.current[next.kind](next.input)
          outcome = result.ok ? { kind: 'done' } : { kind: 'rejected', message: result.message }
        } catch {
          // No llegó al servidor (sin señal): queda pendiente para el próximo intento.
          outcome = { kind: 'retry' }
        }
        update((current) => applyOutcome(current, next.id, outcome))
        if (outcome.kind === 'retry') {
          setOnline(false)
          break
        }
        setOnline(true)
        if (outcome.kind === 'done') confirmed = true
      }
    } finally {
      flushing.current = false
      if (confirmed) confirmedRef.current()
    }
  }, [update])

  // Al abrir la consola: lo que quedó guardado (también tras una recarga) se envía.
  useEffect(() => {
    queueRef.current = loadQueue(browserStorage(), matchId)
    setQueue(queueRef.current)
    setOnline(navigator.onLine)
    void flush()
  }, [matchId, flush])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void flush()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = setInterval(() => {
      if (nextPending(queueRef.current)) void flush()
    }, RETRY_MS)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timer)
    }
  }, [flush])

  return {
    queue,
    online,
    /** `false` si el celular no deja guardar: las pendientes no sobrevivirían una recarga. */
    persisted,
    add: (action: Omit<QueuedAction, 'createdAt' | 'attempts' | 'status'>) => {
      update((current) =>
        enqueue(current, { ...action, createdAt: Date.now(), attempts: 0, status: 'pending' }),
      )
      void flush()
    },
    retry: (id: string) => {
      update((current) => retryFailed(current, id))
      void flush()
    },
    discard: (id: string) => update((current) => discard(current, id)),
  }
}
