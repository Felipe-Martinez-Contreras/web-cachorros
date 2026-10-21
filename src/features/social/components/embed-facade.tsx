'use client' // Cliente: carga el embed de Instagram o Facebook solo cuando la persona lo pide.

import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * «Ver aquí» de una publicación curada (especificación 2.9): abre un `<dialog>` y recién entonces crea el
 * iframe del embed oficial. Antes del toque no sale ninguna petición a la red social. Sin JavaScript,
 * el botón no aparece y queda el enlace a la publicación original.
 */
export function EmbedFacade({ embedUrl, platform }: { embedUrl: string; platform: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="light"
        className="absolute top-2 right-2 z-10 shadow"
        aria-label={`Ver aquí la publicación de ${platform}`}
        onClick={() => {
          setOpen(true)
          dialog.current?.showModal()
        }}
      >
        Ver aquí
      </Button>
      <dialog
        ref={dialog}
        aria-label={`Publicación de ${platform}`}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(92vw,540px)] rounded-lg bg-paper p-0 text-ink backdrop:bg-ink/70"
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 p-2 pl-4">
          <p className="text-sm text-neutral-600">Contenido cargado desde {platform}</p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cerrar"
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        {open && (
          <iframe
            src={embedUrl}
            title={`Publicación de ${platform}`}
            className="h-[min(80vh,720px)] w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </dialog>
    </>
  )
}
