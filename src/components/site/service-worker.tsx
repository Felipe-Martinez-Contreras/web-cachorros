'use client' // Cliente: registra el service worker y avisa cuando hay una versión nueva del sitio.

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Registra `/sw.js?v=<versión>` (especificación 6.16). La versión en la dirección hace que cada despliegue
 * instale un SW nuevo; este espera hasta que la persona acepta «Actualizar» (actualización controlada).
 */
export function ServiceWorker({ version }: { version: string }) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const accepted = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Solo se recarga si la persona aceptó la versión nueva: en la primera visita, `clients.claim()`
    // también cambia el controlador y no hay nada que recargar.
    const onControllerChange = () => {
      if (accepted.current) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: '/' })
      .then((registration) => {
        // Una versión nueva solo se ofrece si ya había otra controlando la página (no en la primera visita).
        const offer = (worker: ServiceWorker | null) => {
          if (worker && navigator.serviceWorker.controller) setWaiting(worker)
        }
        offer(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') offer(installing)
          })
        })
      })
      .catch(() => {
        // Sin service worker el sitio funciona igual (solo sin página offline).
      })
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [version])

  if (!waiting) return null
  return (
    <div
      role="status"
      className="theme-dark fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-lg bg-ink p-4 text-paper shadow-lg lg:bottom-6"
    >
      <p>Hay una versión nueva del sitio.</p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => {
          accepted.current = true
          waiting.postMessage('activar')
        }}
      >
        Actualizar
      </Button>
    </div>
  )
}
