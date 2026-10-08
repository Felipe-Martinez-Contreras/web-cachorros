'use client' // Cliente: abre la biblioteca en un <dialog>, busca y permite subir una imagen nueva.

import { ImagePlus, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { MediaListItemDTO, MediaThumbDTO } from '../dto'
import { Uploader } from './uploader'

type MediaPickerProps = {
  label: string
  help?: string
  error?: string
  value: MediaThumbDTO | null
  onChange: (media: MediaThumbDTO | null) => void
  /** `logo` conserva la transparencia al subir (escudos). */
  kind?: 'photo' | 'logo'
  required?: boolean
}

type ListResponse =
  | { ok: true; data: { items: MediaListItemDTO[]; page: number; totalPages: number } }
  | { ok: false; message: string }

function Thumb({ media, className }: { media: MediaThumbDTO; className?: string }) {
  if (!media.thumb) return <span className={className} />
  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (especificación 2.7)
  return <img src={media.thumb} alt={media.alt} loading="lazy" className={className} />
}

/** Campo de formulario para elegir una imagen de la biblioteca (o subir una nueva). */
export function MediaPicker({
  label,
  help,
  error,
  value,
  onChange,
  kind = 'photo',
  required,
}: MediaPickerProps) {
  const uid = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<MediaListItemDTO[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  const load = useCallback(async (q: string, nextPage: number) => {
    setLoading(true)
    setLoadError(undefined)
    try {
      const params = new URLSearchParams({ q, pagina: String(nextPage) })
      const response = await fetch(`/api/admin/media?${params}`)
      const result = (await response.json()) as ListResponse
      if (!result.ok) throw new Error(result.message)
      setItems((current) => (nextPage === 1 ? result.data.items : [...current, ...result.data.items]))
      setPage(result.data.page)
      setTotalPages(result.data.totalPages)
    } catch {
      setLoadError('No se pudo cargar la biblioteca. Revisa tu conexión.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Búsqueda con una pausa breve para no consultar en cada tecla.
  useEffect(() => {
    if (!dialogRef.current?.open) return
    const timer = window.setTimeout(() => load(query, 1), 300)
    return () => window.clearTimeout(timer)
  }, [query, load])

  function open() {
    dialogRef.current?.showModal()
    load(query, 1)
  }

  function choose(media: MediaThumbDTO) {
    onChange(media)
    dialogRef.current?.close()
  }

  return (
    <div className="grid gap-1">
      <p id={`${uid}-label`} className="font-medium">
        {label}
        {required === false && <span className="font-normal text-neutral-600"> (opcional)</span>}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <Thumb
            media={value}
            className="size-20 rounded-md border border-neutral-300 bg-neutral-100 object-contain"
          />
        ) : (
          <span className="grid size-20 place-items-center rounded-md border border-dashed border-neutral-500 text-neutral-500">
            <ImagePlus aria-hidden="true" className="size-6" />
          </span>
        )}
        <Button variant="outline" size="lg" onClick={open} aria-describedby={`${uid}-label`}>
          {value ? 'Cambiar imagen' : 'Elegir imagen'}
        </Button>
        {value && (
          <Button variant="ghost" size="lg" onClick={() => onChange(null)} aria-describedby={`${uid}-label`}>
            Quitar
          </Button>
        )}
      </div>
      {help && <p className="text-sm text-neutral-600">{help}</p>}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-title`}
        className="m-auto h-[min(44rem,calc(100svh-2rem))] w-[min(56rem,calc(100vw-1rem))] rounded-lg bg-paper p-4 text-ink shadow-2xl backdrop:bg-ink/60"
      >
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id={`${uid}-title`} className="text-h3">
              Elegir imagen
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar la biblioteca"
              onClick={() => dialogRef.current?.close()}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <details className="rounded-md border border-neutral-300 p-3">
            <summary className="flex min-h-12 cursor-pointer items-center font-medium">
              Subir una imagen nueva
            </summary>
            <div className="pt-3">
              <Uploader kind={kind} multiple={false} onUploaded={choose} />
            </div>
          </details>

          <label className="grid gap-1">
            <span className="font-medium">Buscar en la biblioteca</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Por descripción o nombre de archivo"
              className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadError && <p className="text-danger">{loadError}</p>}
            {!loadError && !loading && items.length === 0 && (
              <p className="text-neutral-600">
                No hay imágenes{query ? ' con esa búsqueda' : ' todavía'}. Sube una con la opción de arriba.
              </p>
            )}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {items.map((media) => (
                <li key={media.id}>
                  <button
                    type="button"
                    disabled={media.containsMinors}
                    onClick={() => choose(media)}
                    title={
                      media.containsMinors ? 'Contiene menores: todavía no se puede publicar' : media.alt
                    }
                    aria-pressed={value?.id === media.id}
                    className="group relative block aspect-square w-full overflow-hidden rounded-md border-2 border-transparent bg-neutral-100 aria-pressed:border-ink disabled:opacity-40"
                  >
                    <Thumb media={media} className="size-full object-cover" />
                    {media.containsMinors && (
                      <span className="absolute inset-x-0 bottom-0 bg-ink/80 px-1 py-0.5 text-xs text-paper">
                        Menores
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {page < totalPages && (
              <div className="mt-3 grid justify-items-center">
                <Button variant="outline" size="lg" loading={loading} onClick={() => load(query, page + 1)}>
                  Ver más
                </Button>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </div>
  )
}
