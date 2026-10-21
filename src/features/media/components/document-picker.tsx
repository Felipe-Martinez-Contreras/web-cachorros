'use client' // Cliente: sube un PDF a la biblioteca y entrega su id al formulario.

import { FileText } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { MediaThumbDTO } from '../dto'

type UploadResponse = { ok: true; data: MediaThumbDTO } | { ok: false; message: string }

type DocumentPickerProps = {
  label: string
  help?: string
  error?: string
  /** El PDF ya elegido (en `alt` va su nombre de archivo). */
  value: MediaThumbDTO | null
  onChange: (media: MediaThumbDTO | null) => void
  required?: boolean
}

/**
 * Campo de formulario para el PDF de un documento (especificación 6.12): se sube al elegirlo y el servidor
 * valida su firma; reemplazarlo es subir otro.
 */
export function DocumentPicker({ label, help, error, value, onChange, required }: DocumentPickerProps) {
  const uid = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>()

  async function upload(file: File) {
    setUploading(true)
    setUploadError(undefined)
    try {
      const body = new FormData()
      body.set('file', file, file.name)
      body.set('kind', 'document')
      const response = await fetch('/api/admin/media', { method: 'POST', body })
      const result = (await response.json().catch(() => null)) as UploadResponse | null
      if (!result?.ok) {
        setUploadError(result?.message ?? 'No se pudo subir el PDF. Inténtalo de nuevo.')
        return
      }
      onChange(result.data)
    } catch {
      setUploadError('Se cortó la conexión. Inténtalo de nuevo.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const message = uploadError ?? error
  return (
    <div className="grid gap-1">
      <label htmlFor={`${uid}-file`} className="font-medium">
        {label}
        {required === false && <span className="font-normal text-neutral-600"> (opcional)</span>}
      </label>
      {value && (
        <p className="flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-100 p-3">
          <FileText aria-hidden="true" className="size-5 shrink-0" />
          <span className="min-w-0 break-words">{value.alt}</span>
        </p>
      )}
      <input
        ref={inputRef}
        id={`${uid}-file`}
        type="file"
        accept="application/pdf,.pdf"
        disabled={uploading}
        aria-invalid={message ? true : undefined}
        aria-describedby={
          [message ? `${uid}-error` : null, help ? `${uid}-help` : null].filter(Boolean).join(' ') ||
          undefined
        }
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
        className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper p-2 text-base file:mr-3 file:min-h-10 file:rounded-md file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-paper"
      />
      {uploading && (
        <p role="status" className="text-sm text-neutral-600">
          Subiendo el PDF…
        </p>
      )}
      {value && !uploading && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Quitar el PDF
          </Button>
        </div>
      )}
      {help && (
        <p id={`${uid}-help`} className="text-sm text-neutral-600">
          {help}
        </p>
      )}
      {message && (
        <p id={`${uid}-error`} className="text-sm font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
