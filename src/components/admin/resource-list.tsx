import { ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/** Título de una pantalla del panel, con su acción principal a un toque. */
export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  /** Enlace «volver» sobre el título (pantallas de edición). */
  back?: { href: string; label: string }
}) {
  return (
    <div className="mb-6 grid gap-3">
      {back && (
        <Link href={back.href} className="inline-flex min-h-12 items-center text-sm font-medium underline">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="max-w-2xl text-neutral-600">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

/** Botón-enlace «Nuevo…» para el encabezado de una lista. */
export function NewLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: 'dark', size: 'lg' })}>
      {children}
    </Link>
  )
}

/** Lista del panel: tarjetas apiladas en el celular y filas en escritorio (especificación 7.1). */
export function ResourceList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="grid gap-2">
      {children}
    </ul>
  )
}

type ResourceRowProps = {
  title: ReactNode
  /** Si viene, el título enlaza a la pantalla de edición y toda la tarjeta invita a tocar. */
  href?: string
  subtitle?: ReactNode
  badges?: ReactNode
  /** Imagen o ícono a la izquierda (escudo, foto). */
  media?: ReactNode
  /** Botones de la fila (ordenar, desactivar…). */
  actions?: ReactNode
  className?: string
}

export function ResourceRow({ title, href, subtitle, badges, media, actions, className }: ResourceRowProps) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-paper p-3',
        className,
      )}
    >
      {media && <div className="shrink-0">{media}</div>}
      <div className="grid min-w-0 flex-1 basis-48 gap-1">
        {href ? (
          <Link href={href} className="flex min-h-12 items-center gap-1 font-semibold">
            <span className="min-w-0 break-words">{title}</span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-neutral-500" />
          </Link>
        ) : (
          <p className="font-semibold">{title}</p>
        )}
        {subtitle && <div className="text-sm text-neutral-600">{subtitle}</div>}
        {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  )
}

/** Búsqueda y filtros de una lista como formulario GET: el estado vive en la URL. */
export function ListToolbar({
  search,
  placeholder = 'Buscar…',
  children,
}: {
  /** Valor actual de `?q=`; `undefined` oculta el buscador. */
  search?: string
  placeholder?: string
  /** Filtros adicionales (`<select name="…">`). */
  children?: ReactNode
}) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
      {search !== undefined && (
        <label className="grid min-w-0 flex-1 basis-56 gap-1">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={placeholder}
            className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base"
          />
        </label>
      )}
      {children}
      <button type="submit" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        <Search aria-hidden="true" />
        Filtrar
      </button>
    </form>
  )
}

/** `<select>` de filtro para `ListToolbar`. */
export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string
  label: string
  value?: string
  options: { value: string; label: string }[]
  /** Texto de la opción vacía («Todas las series»). Sin ella, el filtro siempre tiene valor. */
  allLabel?: string
}) {
  return (
    <label className="grid min-w-0 basis-40 gap-1 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={value ?? ''}
        className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base font-normal"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
