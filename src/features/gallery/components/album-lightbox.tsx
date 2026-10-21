'use client' // Cliente: visor de fotos en <dialog> con teclado y gestos; sin JavaScript queda la grilla de enlaces.

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ClubImage } from '@/components/site/club-image'
import { buttonVariants } from '@/components/ui/button'
import type { AlbumPhotoDTO } from '../dto'

/** Distancia mínima (px) de un deslizamiento horizontal para pasar de foto. */
const SWIPE_MIN = 50

/**
 * Grilla del álbum + visor propio (especificación 6.5), sin librerías. Cada miniatura es un enlace a la
 * foto grande: sin JavaScript se abre la foto; con JavaScript se abre el visor en esa foto, con ← y →,
 * Escape para cerrar y deslizamiento en el celular. Al cerrar, el foco vuelve a la miniatura.
 */
export function AlbumLightbox({ title, photos }: { title: string; photos: AlbumPhotoDTO[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const thumbs = useRef<(HTMLAnchorElement | null)[]>([])
  const touchStart = useRef<number | null>(null)
  const [index, setIndex] = useState(0)

  const total = photos.length
  const go = useCallback((delta: number) => setIndex((current) => (current + delta + total) % total), [total])

  function open(at: number) {
    setIndex(at)
    dialogRef.current?.showModal()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }
    const onClose = () => thumbs.current[index]?.focus()
    dialog.addEventListener('keydown', onKey)
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('keydown', onKey)
      dialog.removeEventListener('close', onClose)
    }
  }, [go, index])

  const photo = photos[index]

  return (
    <>
      <ul aria-label={`Fotos de ${title}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((item, at) => (
          <li key={item.id}>
            <a
              ref={(element) => {
                thumbs.current[at] = element
              }}
              href={item.image.src}
              onClick={(event) => {
                event.preventDefault()
                open(at)
              }}
              aria-label={`Ver foto ${at + 1} de ${total}${item.image.alt ? `: ${item.image.alt}` : ''}`}
              className="group block aspect-square overflow-hidden rounded-md bg-(--surface)"
            >
              <ClubImage
                image={item.image}
                alt=""
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              />
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={`${title}: visor de fotos`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink p-0 text-paper backdrop:bg-ink"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          const end = event.changedTouches[0]?.clientX
          touchStart.current = null
          if (start === null || end === undefined || Math.abs(end - start) < SWIPE_MIN) return
          go(end < start ? 1 : -1)
        }}
      >
        {photo && (
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
            <div className="flex items-center justify-between gap-2 p-2">
              <p aria-live="polite" className="px-2 text-meta">
                Foto {index + 1} de {total}
              </p>
              <button
                type="button"
                className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-paper' })}
                aria-label="Cerrar el visor"
                onClick={() => dialogRef.current?.close()}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <figure className="grid min-h-0 place-items-center px-2">
              <ClubImage
                key={photo.id}
                image={photo.image}
                sizes="100vw"
                className="max-h-full w-auto max-w-full object-contain"
                style={{ backgroundImage: 'none' }}
              />
            </figure>
            <div className="flex items-center justify-between gap-2 p-2">
              <button
                type="button"
                className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-paper' })}
                aria-label="Foto anterior"
                onClick={() => go(-1)}
                disabled={total < 2}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <p className="min-w-0 flex-1 text-center text-meta">{photo.caption ?? photo.image.alt}</p>
              <button
                type="button"
                className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-paper' })}
                aria-label="Foto siguiente"
                onClick={() => go(1)}
                disabled={total < 2}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
