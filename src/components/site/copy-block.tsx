'use client' // Cliente: copia el bloque al portapapeles del navegador.

import { Check, Copy } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'

/**
 * Texto listo para pegar (por ejemplo, los datos de transferencia) con un botón «Copiar». Sin JavaScript
 * el bloque se ve igual y se puede seleccionar a mano; el botón aparece solo después de montar.
 */
export function CopyBlock({ text, buttonLabel }: { text: string; buttonLabel: string }) {
  const uid = useId()
  const [enhanced, setEnhanced] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => setEnhanced(true), [])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <div className="grid gap-3">
      <pre
        id={uid}
        className="overflow-x-auto rounded-lg border border-(--border) bg-(--surface) p-4 font-sans text-base whitespace-pre-wrap select-all"
      >
        {text}
      </pre>
      <div className="flex flex-wrap items-center gap-3">
        {enhanced && (
          <button
            type="button"
            aria-controls={uid}
            className={buttonVariants({ size: 'lg' })}
            onClick={() =>
              navigator.clipboard
                .writeText(text)
                .then(() => setCopied(true))
                .catch(() => {})
            }
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {buttonLabel}
          </button>
        )}
        <span role="status" className="text-meta">
          {copied ? 'Datos copiados: pégalos en la app de tu banco.' : ''}
        </span>
      </div>
    </div>
  )
}
