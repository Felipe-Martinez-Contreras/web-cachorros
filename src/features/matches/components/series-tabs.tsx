import Link from 'next/link'
import { cn } from '@/lib/cn'

type SeriesTabsProps = {
  series: { slug: string; name: string }[]
  activeSlug: string
  /** Enlace de cada pestaña: la serie activa vive en la URL (`?serie=honor`). */
  hrefFor: (slug: string) => string
  label?: string
  className?: string
}

/**
 * Pestañas de series controladas por URL: son enlaces, así que funcionan sin JavaScript, se pueden
 * compartir y respetan el botón «atrás». La activa se marca con `aria-current`.
 */
export function SeriesTabs({ series, activeSlug, hrefFor, label = 'Series', className }: SeriesTabsProps) {
  return (
    <nav aria-label={label} className={cn('-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0', className)}>
      <ul className="flex min-w-max gap-1 border-b border-(--border)">
        {series.map((item) => {
          const active = item.slug === activeSlug
          return (
            <li key={item.slug}>
              <Link
                href={hrefFor(item.slug)}
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-11 items-center border-b-[3px] px-3 font-semibold whitespace-nowrap transition-colors duration-150',
                  active
                    ? 'border-(--link) text-(--fg)'
                    : 'border-transparent text-(--muted) hover:border-(--border) hover:text-(--fg)',
                )}
              >
                {item.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
