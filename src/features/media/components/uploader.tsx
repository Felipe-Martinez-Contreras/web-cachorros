'use client' // Cliente: reduce las fotos en el navegador y las sube de a una, mostrando el avance.

import { ImageUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import type { MediaThumbDTO } from '../dto'
import { prepareImage, UnreadableImageError } from './prepare-image'

type Item = { key: number; file: File; status: 'pendiente' | 'subiendo' | 'lista' | 'error'; error?: string }

type UploaderProps = {
  kind?: 'photo' | 'logo'
  /** Varias fotos de una vez (biblioteca) o una sola (selector de un formulario). */
  multiple?: boolean
  onUploaded?: (media: MediaThumbDTO) => void
}

type UploadResponse = { ok: true; data: MediaThumbDTO } | { ok: false; message: string }

const UNREADABLE =
  'Tu navegador no puede leer este formato (¿foto HEIC de iPhone?). Súbela desde el iPhone o cámbiala a JPG.'

/**
 * Subida de imágenes del panel (especificación 7.5): secuencial («Subiendo 12 de 60»), con texto
 * alternativo obligatorio y reintento de las que fallen por mala señal.
 */
export function Uploader({ kind = 'photo', multiple = true, onUploaded }: UploaderProps) {
  const router = useRouter()
  const toast = useToast()
  const uid = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const nextKey = useRef(1)
  const [altText, setAltText] = useState('')
  const [credit, setCredit] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const [altError, setAltError] = useState<string>()

  const done = items.filter((item) => item.status === 'lista').length
  const failed = items.filter((item) => item.status === 'error')
  const current = items.findIndex((item) => item.status === 'subiendo')

  function update(key: number, patch: Partial<Item>) {
    setItems((all) => all.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function uploadOne(item: Item): Promise<boolean> {
    update(item.key, { status: 'subiendo', error: undefined })
    try {
      const blob = await prepareImage(item.file, kind)
      const body = new FormData()
      body.set('file', blob, item.file.name)
      body.set('altText', altText.trim())
      body.set('credit', credit.trim())
      body.set('kind', kind)
      const response = await fetch('/api/admin/media', { method: 'POST', body })
      const result = (await response.json().catch(() => null)) as UploadResponse | null
      if (!result?.ok) {
        update(item.key, {
          status: 'error',
          error: result?.message ?? 'No se pudo subir. Inténtalo de nuevo.',
        })
        return false
      }
      update(item.key, { status: 'lista' })
      onUploaded?.(result.data)
      return true
    } catch (error) {
      update(item.key, {
        status: 'error',
        error:
          error instanceof UnreadableImageError ? UNREADABLE : 'Se cortó la conexión. Inténtalo de nuevo.',
      })
      return false
    }
  }

  async function run(queue: Item[]) {
    if (running || queue.length === 0) return
    if (altText.trim() === '') {
      setAltError('Describe las fotos antes de subirlas.')
      document.getElementById(`${uid}-alt`)?.focus()
      return
    }
    setAltError(undefined)
    setRunning(true)
    let uploaded = 0
    // De a una: la señal de la cancha y la memoria del servidor no dan para más.
    for (const item of queue) if (await uploadOne(item)) uploaded += 1
    setRunning(false)
    if (uploaded > 0) {
      toast({ message: uploaded === 1 ? 'Se subió 1 imagen.' : `Se subieron ${uploaded} imágenes.` })
      router.refresh()
    }
  }

  function onPick(files: FileList | null) {
    if (!files?.length) return
    const picked = [...files].map((file) => ({ key: nextKey.current++, file, status: 'pendiente' as const }))
    setItems((all) => [...all.filter((item) => item.status !== 'lista'), ...picked])
    if (inputRef.current) inputRef.current.value = ''
  }

  const pending = items.filter((item) => item.status === 'pendiente')
  const total = items.length

  return (
    <FormBody className="grid gap-4">
      <Field
        name={`${uid}-alt`}
        label={multiple ? 'Descripción de las fotos' : 'Descripción de la imagen'}
        help="Qué se ve en la imagen. Lo leen los lectores de pantalla y los buscadores; después puedes ajustarla foto por foto."
        value={altText}
        onChange={(event) => setAltText(event.target.value)}
        error={altError}
        maxLength={300}
        required
      />
      <Field
        name={`${uid}-credit`}
        label="Crédito"
        help="Quién tomó la foto."
        value={credit}
        onChange={(event) => setCredit(event.target.value)}
        maxLength={120}
        required={false}
      />
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={`${uid}-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,image/heic,image/heif"
          multiple={multiple}
          className="sr-only"
          onChange={(event) => onPick(event.target.files)}
        />
        <Button variant="outline" size="lg" disabled={running} onClick={() => inputRef.current?.click()}>
          <ImageUp aria-hidden="true" />
          {multiple ? 'Elegir fotos' : 'Elegir imagen'}
        </Button>
        {pending.length > 0 && (
          <Button variant="dark" size="lg" loading={running} onClick={() => run(pending)}>
            {pending.length === 1 ? 'Subir 1 imagen' : `Subir ${pending.length} imágenes`}
          </Button>
        )}
        {!running && failed.length > 0 && (
          <Button variant="outline" size="lg" onClick={() => run(failed)}>
            Reintentar las que fallaron ({failed.length})
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="grid gap-2">
          <p role="status" className="font-medium">
            {running
              ? `Subiendo ${Math.max(current, 0) + 1} de ${total}…`
              : `${done} de ${total} ${total === 1 ? 'imagen lista' : 'imágenes listas'}.`}
          </p>
          <progress
            value={done}
            max={total}
            aria-label="Avance de la subida"
            className="h-3 w-full overflow-hidden rounded-full accent-ink"
          />
          {failed.length > 0 && (
            <Alert variant="danger" title="Algunas imágenes no se subieron">
              <ul className="grid gap-1">
                {failed.map((item) => (
                  <li key={item.key}>
                    <span className="font-medium">{item.file.name}:</span> {item.error}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}
    </FormBody>
  )
}
