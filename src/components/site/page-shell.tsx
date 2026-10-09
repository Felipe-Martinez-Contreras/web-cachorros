import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { JsonLd } from '@/features/seo/components/json-ld'
import { breadcrumbJsonLd } from '@/features/seo/lib/json-ld'
import { siteBaseUrl } from '@/features/seo/metadata'

export type Crumb = { href?: string; label: string }

/** Migas de pan: el último elemento es la página actual y no enlaza. Incluye su JSON-LD (`BreadcrumbList`). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Migas de pan">
      <JsonLd data={breadcrumbJsonLd(items, siteBaseUrl())} />
      <ol className="flex flex-wrap items-center gap-x-1 text-meta text-(--muted)">
        {items.map((item, index) => (
          <li key={`${item.href ?? ''}${item.label}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight aria-hidden="true" className="size-4" />}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-11 items-center hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 items-center text-(--fg)">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Encabezado oscuro de las páginas interiores, con migas de pan y título. */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  children,
}: {
  crumbs: Crumb[]
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="theme-dark">
      <div className="container-site grid gap-2 pt-4 pb-8 md:pb-12">
        <Breadcrumbs items={crumbs} />
        {eyebrow && <p className="text-eyebrow text-accent">{eyebrow}</p>}
        <h1 className="text-h1">{title}</h1>
        {children}
      </div>
    </header>
  )
}

type Option = { value: string; label: string }

/**
 * Filtros de una página pública como formulario GET: el estado vive en la URL y funciona sin JavaScript
 * (especificación 3.3). Los valores que no cambian viajan como campos ocultos.
 */
export function FilterForm({
  action,
  selects,
  hidden = {},
}: {
  action: string
  selects: { name: string; label: string; value: string; options: Option[] }[]
  hidden?: Record<string, string>
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {selects.map((select) => (
        <label key={select.name} className="grid min-w-0 basis-44 gap-1 text-meta font-semibold">
          {select.label}
          <select
            name={select.name}
            defaultValue={select.value}
            className="block min-h-11 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base font-normal text-ink"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className={buttonVariants({ variant: 'dark' })}>
        Ver
      </button>
    </form>
  )
}
