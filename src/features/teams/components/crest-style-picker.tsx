'use client' // Cliente: guarda el estilo del escudo al elegirlo y avisa el resultado.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import type { ActionResult } from '@/lib/action-result'
import { crestCardStyleLabels } from '@/lib/labels'

type Style = keyof typeof crestCardStyleLabels

const STYLES = Object.keys(crestCardStyleLabels) as Style[]

/** Etiqueta corta bajo cada variante (la larga, para los lectores de pantalla). */
const SHORT: Record<Style, string> = { color: 'A color', blanco: 'Blanco', grises: 'Grises' }

/**
 * Las tres variantes del escudo de un equipo tal como salen en las tarjetas (sobre el fondo oscuro), como
 * opciones: elegir una la guarda. `previews`: dirección de la imagen de cada estilo.
 */
export function CrestStylePicker({
  team,
  current,
  previews,
  action,
}: {
  team: string
  current: Style
  previews: Record<Style, string>
  action: (input: unknown) => Promise<ActionResult<unknown>>
}) {
  const router = useRouter()
  const toast = useToast()
  const [selected, setSelected] = useState<Style>(current)
  const [pending, setPending] = useState(false)

  async function choose(style: Style) {
    if (pending || style === selected) return
    const previous = selected
    setSelected(style)
    setPending(true)
    try {
      const result = await action({ cardCrestStyle: style })
      if (!result.ok) {
        setSelected(previous)
        toast({ variant: 'danger', message: result.message })
        return
      }
      toast({ message: `${team}: escudo «${SHORT[style].toLowerCase()}» en las tarjetas.` })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <FormBody>
      <fieldset className="grid gap-2" aria-busy={pending}>
        <legend className="sr-only">Escudo de {team} en las tarjetas</legend>
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((style) => (
            <label
              key={style}
              className="grid cursor-pointer gap-1 rounded-md border-2 border-transparent p-1 has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-(--focus)"
            >
              <input
                type="radio"
                name={`estilo-${team}`}
                value={style}
                checked={selected === style}
                onChange={() => choose(style)}
                className="sr-only"
              />
              {/* biome-ignore lint/performance/noImgElement: vista previa generada por el servidor (2.7) */}
              <img
                src={previews[style]}
                alt=""
                width={240}
                height={240}
                loading="lazy"
                className="aspect-square w-full rounded-sm bg-ink"
              />
              <span className="flex min-h-8 items-center justify-center text-center text-sm font-medium">
                {SHORT[style]}
                <span className="sr-only"> ({crestCardStyleLabels[style]})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </FormBody>
  )
}
