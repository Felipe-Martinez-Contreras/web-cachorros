'use client' // Cliente: guarda el estilo del escudo al elegirlo y avisa el resultado.

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import type { ActionResult } from '@/lib/action-result'
import { crestCardStyleLabels } from '@/lib/labels'

type Style = keyof typeof crestCardStyleLabels

const STYLES = Object.keys(crestCardStyleLabels) as Style[]

/** Etiqueta corta bajo cada variante (la larga, para los lectores de pantalla). */
const SHORT: Record<Style, string> = { color: 'A color', blanco: 'Blanco', grises: 'Grises' }

/**
 * Las vistas previas se piden de a pocas: cada una cuesta CPU en el servidor la primera vez, y una página con
 * 15 equipos pediría 45 juntas (incidente sha-8191eed). Cola compartida por toda la página.
 */
const MAX_LOADING = 2
let loadingNow = 0
const waitingTurn: (() => void)[] = []

function takeTurn(): Promise<() => void> {
  return new Promise((resolve) => {
    const start = () => {
      loadingNow++
      let done = false
      resolve(() => {
        if (done) return
        done = true
        loadingNow--
        waitingTurn.shift()?.()
      })
    }
    if (loadingNow < MAX_LOADING) start()
    else waitingTurn.push(start)
  })
}

/** Una vista previa: se pide cuando está por verse y le toca turno en la cola de la página. */
function CrestPreview({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const release = useRef<(() => void) | null>(null)

  useEffect(() => {
    const image = ref.current
    if (!image) return
    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        takeTurn().then((done) => {
          if (cancelled) return done()
          release.current = done
          setActive(src)
        })
      },
      { rootMargin: '200px' },
    )
    observer.observe(image)
    return () => {
      cancelled = true
      observer.disconnect()
      release.current?.()
    }
  }, [src])

  const finished = () => release.current?.()
  return (
    // biome-ignore lint/performance/noImgElement: vista previa generada por el servidor (2.7)
    <img
      ref={ref}
      src={active ?? undefined}
      alt=""
      width={240}
      height={240}
      loading="lazy"
      decoding="async"
      onLoad={finished}
      onError={finished}
      className="aspect-square w-full rounded-sm bg-ink"
    />
  )
}

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
              <CrestPreview src={previews[style]} />
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
