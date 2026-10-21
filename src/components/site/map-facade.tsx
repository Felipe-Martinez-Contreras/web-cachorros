'use client' // Cliente: carga el mapa de OpenStreetMap solo cuando la persona lo pide.

import { MapPinned } from 'lucide-react'
import { useState } from 'react'

/**
 * Fachada del mapa (especificación 6.13): nada de terceros se carga hasta el clic. Sin JavaScript es un
 * enlace al mapa en OpenStreetMap.
 */
export function MapFacade({
  embedUrl,
  pageUrl,
  label,
}: {
  embedUrl: string
  pageUrl: string
  label: string
}) {
  const [active, setActive] = useState(false)

  if (active) {
    return (
      <iframe
        src={embedUrl}
        title={`Mapa: ${label}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="aspect-[4/3] w-full rounded-lg border border-(--border) md:aspect-video"
      />
    )
  }
  return (
    <a
      href={pageUrl}
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault()
        setActive(true)
      }}
      className="theme-dark grid aspect-[4/3] w-full place-content-center justify-items-center gap-2 rounded-lg p-4 text-center no-underline md:aspect-video"
    >
      <span className="grid size-16 place-items-center rounded-full bg-accent text-ink">
        <MapPinned aria-hidden="true" className="size-8" />
      </span>
      <span className="text-lg font-bold text-(--fg)">Ver el mapa</span>
      <span className="text-meta text-(--muted)">Se carga desde OpenStreetMap al tocar</span>
    </a>
  )
}
