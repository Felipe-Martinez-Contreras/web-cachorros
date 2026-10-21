'use client' // Cliente: Web Share API con archivos (solo existe en el navegador y se detecta después de montar).

import { Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/admin/toast'
import { Button } from '@/components/ui/button'

type Props = { url: string; filename: string; title: string; label: string }

/**
 * «Compartir» una tarjeta como archivo, directo a WhatsApp o Instagram desde el celular. Solo aparece si
 * el navegador puede compartir imágenes; si no, queda el enlace «Descargar» que está al lado.
 */
export function ShareFileButton({ url, filename, title, label }: Props) {
  const toast = useToast()
  const [supported, setSupported] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const probe = new File([new Uint8Array(1)], filename, { type: 'image/png' })
      setSupported(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }))
    } catch {
      setSupported(false)
    }
  }, [filename])

  if (!supported) return null

  async function share() {
    setBusy(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], filename, { type: blob.type })
      await navigator.share({ files: [file], title })
    } catch (error) {
      // Cerrar la hoja de compartir no es un error.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast({
          variant: 'danger',
          message: 'No se pudo compartir la imagen. Usa «Descargar» y súbela a mano.',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="dark" size="sm" onClick={share} disabled={busy} aria-label={label}>
      <Share2 aria-hidden="true" />
      {busy ? 'Preparando…' : 'Compartir'}
    </Button>
  )
}
