'use client' // Cliente: carga el reproductor de YouTube solo cuando la persona toca el video.

import { Play } from 'lucide-react'
import { useState } from 'react'
import type { ImageDTO } from '@/lib/images/dto'
import { ClubImage } from './club-image'

/**
 * Fachada de un video de YouTube: nada de terceros se carga hasta el clic (especificación 2.9 y 10).
 * Sin JavaScript es un enlace al video. La miniatura, si la hay, es una imagen propia de la biblioteca.
 */
export function YoutubeFacade({
  videoId,
  url,
  title = 'Video de YouTube',
  poster,
}: {
  videoId: string
  url: string
  title?: string
  poster?: ImageDTO | null
}) {
  const [active, setActive] = useState(false)

  if (active) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={title}
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
      aria-label={`Ver el video: ${title}`}
      className="theme-dark relative grid aspect-video w-full place-content-center justify-items-center gap-2 overflow-hidden rounded-lg text-center no-underline"
    >
      {poster && (
        <ClubImage
          image={poster}
          alt=""
          sizes="(min-width: 768px) 50vw, 100vw"
          className="absolute inset-0 size-full object-cover opacity-50"
        />
      )}
      <span className="relative grid size-16 place-items-center rounded-full bg-accent text-ink">
        <Play aria-hidden="true" className="size-8" />
      </span>
      <span className="relative text-lg font-bold text-(--fg)">Ver el video</span>
      <span className="relative text-meta text-(--muted)">Se carga desde YouTube al tocar</span>
    </a>
  )
}
