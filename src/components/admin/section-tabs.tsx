import Link from 'next/link'
import { cn } from '@/lib/cn'

/** Pestañas de un módulo con varias pantallas (Socios: solicitudes, padrón y planes). Son enlaces. */
export function SectionTabs({
  label,
  current,
  tabs,
}: {
  label: string
  current: string
  tabs: { href: string; label: string }[]
}) {
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto">
      <ul className="flex gap-1 border-b border-neutral-300">
        {tabs.map((tab) => {
          const active = tab.href === current
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center border-b-2 px-3 font-semibold whitespace-nowrap',
                  active ? 'border-ink text-ink' : 'border-transparent text-neutral-600 hover:text-ink',
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
