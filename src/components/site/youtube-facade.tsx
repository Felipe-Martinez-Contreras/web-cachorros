'use client' // Cliente: carga el reproductor de YouTube solo cuando la persona toca el video.

import { Play } from 'lucide-react'
import { useState } from 'react'

/**
 * Fachada de un video de YouTube: nada de terceros se carga hasta el clic (especificación 2.9 y 10).
 * Sin JavaScript es un enlace al video.
 */
export function YoutubeFacade({ videoId, url }: { videoId: string; url: string }) {
  const [active, setActive] = useState(false)

  if (active) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title="Video de YouTube"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="aspect-video w-full rounded-lg"
      />
    )
  }
  return (
    <a
      href={url}
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault()
        setActive(true)
      }}
      className="theme-dark grid aspect-video w-full place-content-center justify-items-center gap-2 rounded-lg text-center no-underline"
    >
      <span className="grid size-16 place-items-center rounded-full bg-accent text-ink">
        <Play aria-hidden="true" className="size-8" />
      </span>
      <span className="text-lg font-bold text-(--fg)">Ver el video</span>
      <span className="text-meta text-(--muted)">Se carga desde YouTube al tocar</span>
    </a>
  )
}
