'use client' // Cliente: sondea /api/live/* con temporizadores y escucha la visibilidad de la pestaña.

import { useEffect, useRef } from 'react'
import { backoffDelay } from '../lib/live-poll'

type Options<T> = {
  /** Lo que ya renderizó el servidor: decide si hay que empezar a sondear. */
  initial: T
  /** Cada cuánto consultar según lo último recibido; `null` = sin polling. */
  intervalFor: (data: T, now: number) => number | null
  /** Cuándo volver a evaluar si hoy no corresponde sondear (un partido que entra en la ventana de 30 min). */
  wakeAt?: (data: T) => number | null
  /** Datos nuevos (respuesta 200) y el desfase del reloj del dispositivo respecto del servidor. */
  onData: (data: T, serverOffsetMs: number) => void
}

/**
 * Polling de las islas en vivo (especificación 2.6): sin peticiones si no hay nada en vivo ni por comenzar,
 * pausa con la pestaña oculta, `If-None-Match` (un 304 no trae cuerpo) y *backoff* exponencial ante
 * errores. Se detiene solo cuando `intervalFor` devuelve `null` (por ejemplo, al finalizar el partido).
 */
export function useLivePolling<T extends { serverNow: string }>(url: string, options: Options<T>) {
  const latest = useRef(options.initial)
  const callbacks = useRef(options)
  callbacks.current = options

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let etag: string | null = null
    let failures = 0
    let stopped = false
    let inFlight = false

    const schedule = () => {
      clearTimeout(timer)
      if (stopped || document.visibilityState === 'hidden') return
      const interval = callbacks.current.intervalFor(latest.current, Date.now())
      if (interval === null) {
        const wake = callbacks.current.wakeAt?.(latest.current)
        if (wake != null) timer = setTimeout(schedule, Math.max(1000, wake - Date.now()))
        return
      }
      timer = setTimeout(tick, failures > 0 ? backoffDelay(interval, failures) : interval)
    }

    const tick = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const response = await fetch(url, {
          headers: etag ? { 'If-None-Match': etag } : {},
          cache: 'no-store',
        })
        if (response.status === 304) {
          failures = 0
        } else if (response.ok) {
          etag = response.headers.get('etag')
          const data = (await response.json()) as T
          failures = 0
          latest.current = data
          if (!stopped) callbacks.current.onData(data, Date.parse(data.serverNow) - Date.now())
        } else {
          failures += 1
        }
      } catch {
        failures += 1
      } finally {
        inFlight = false
      }
      schedule()
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        clearTimeout(timer)
        return
      }
      // Al volver a la pestaña se consulta de inmediato, si corresponde sondear.
      if (callbacks.current.intervalFor(latest.current, Date.now()) !== null) void tick()
      else schedule()
    }

    document.addEventListener('visibilitychange', onVisibility)
    schedule()
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [url])
}
