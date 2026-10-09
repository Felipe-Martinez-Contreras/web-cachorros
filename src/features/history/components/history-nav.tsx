import Link from 'next/link'
import { cn } from '@/lib/cn'

const LINKS = [
  { href: '/historia', label: 'Línea de tiempo' },
  { href: '/historia/titulos', label: 'Títulos' },
  { href: '/historia/salon-de-la-fama', label: 'Salón de la fama' },
  { href: '/historia/camisetas', label: 'Camisetas' },
] as const

/** Navegación entre las páginas de Historia; va dentro del encabezado oscuro. */
export function HistoryNav({ current }: { current: (typeof LINKS)[number]['href'] }) {
  return (
    <nav aria-label="Secciones de Historia" className="mt-3">
      <ul className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={link.href === current ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-md border border-(--border) px-4 font-semibold',
                link.href === current ? 'border-accent bg-accent text-ink' : 'hover:bg-(--fg)/8',
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
