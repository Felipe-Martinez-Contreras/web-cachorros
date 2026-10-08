import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

type PaginationProps = {
  page: number
  totalPages: number
  /** Construye el enlace de cada página (los filtros viven en la URL: `?pagina=2`). */
  hrefFor: (page: number) => string
  className?: string
}

/** Páginas a mostrar: primera, última y las vecinas de la actual; `null` marca un salto. */
export function paginationRange(page: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | null)[] = []
  let previous = 0
  for (const current of sorted) {
    if (current - previous > 1) out.push(null)
    out.push(current)
    previous = current
  }
  return out
}

const itemClass =
  'grid min-h-11 min-w-11 place-items-center rounded-md px-2 font-semibold tabular-nums hover:bg-(--fg)/8'

/** Paginación numerada con enlaces reales: funciona sin JavaScript. */
export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label="Paginación"
      className={cn('flex flex-wrap items-center justify-center gap-1', className)}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" aria-label="Página anterior" className={itemClass}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(itemClass, 'opacity-30 hover:bg-transparent')}>
          <ChevronLeft className="size-5" />
        </span>
      )}
      {paginationRange(page, totalPages).map((item, index) =>
        item === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: los saltos no tienen identidad propia
          <span key={`salto-${index}`} aria-hidden="true" className="px-1 text-(--muted)">
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={cn(itemClass, 'bg-(--fg) text-(--bg) hover:bg-(--fg)')}
          >
            <span className="sr-only">Página </span>
            {item}
          </span>
        ) : (
          <Link key={item} href={hrefFor(item)} className={itemClass}>
            <span className="sr-only">Página </span>
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" aria-label="Página siguiente" className={itemClass}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(itemClass, 'opacity-30 hover:bg-transparent')}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </nav>
  )
}
