import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SHARE_FORMATS, type ShareFormat } from '../lib/cards'

// Vista previa de una tarjeta en el panel sin gastar CPU al abrir la página: si la versión ya está dibujada
// (en el disco) se muestra; si no, un enlace «Ver imagen» la dibuja al tocarlo. La ruta la dibuja con
// `request.signal`: si quien la pidió se va antes de su turno en la cola, no se dibuja.

/** Hueco del tamaño de la tarjeta con el enlace para dibujarla. */
export function CardPreviewLink({
  href,
  label,
  className,
}: {
  href: string
  /** Qué tarjeta es (lo leen los lectores de pantalla después de «Ver imagen»). */
  label: string
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center font-semibold text-link underline',
        className,
      )}
    >
      <ImageIcon aria-hidden="true" className="size-8 text-neutral-500" />
      {/* El nombre accesible empieza con el texto visible (WCAG 2.5.3) y dice de qué tarjeta es. */}
      <span>
        Ver imagen<span className="sr-only">: {label}</span>
      </span>
      <span className="text-sm font-normal text-neutral-600 no-underline">Se dibuja al abrirla.</span>
    </a>
  )
}

/** La tarjeta, o el enlace para dibujarla si todavía no existe. Siempre con `loading="lazy"`. */
export function CardPreview({
  src,
  cached,
  alt,
  format = 'vertical',
  className,
}: {
  src: string
  cached: boolean
  alt: string
  format?: ShareFormat
  className?: string
}) {
  const { width, height } = SHARE_FORMATS[format]
  const aspect = format === 'vertical' ? 'aspect-[4/5]' : format === 'cuadrado' ? 'aspect-square' : undefined
  if (!cached) return <CardPreviewLink href={src} label={alt} className={cn(aspect, className)} />
  return (
    // biome-ignore lint/performance/noImgElement: la tarjeta ya viene en su tamaño final.
    <img
      src={src}
      width={width}
      height={height}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('h-auto w-full rounded-md border border-neutral-200 bg-ink', className)}
    />
  )
}
