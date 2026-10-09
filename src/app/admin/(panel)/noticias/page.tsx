import { Newspaper } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FilterSelect,
  ListToolbar,
  NewLink,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { listNewsAdmin, newsFormOptions } from '@/features/news/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid, optionsFromLabels } from '@/lib/form-schemas'
import { formatLongDateTime, formatShortDate } from '@/lib/format'
import { newsStatusLabels, newsTypeLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Noticias' }

type Props = {
  searchParams: Promise<{ q?: string; estado?: string; categoria?: string; pagina?: string }>
}

const STATUS_VARIANT = {
  borrador: 'neutral',
  programada: 'soft',
  publicada: 'success',
  archivada: 'dark',
} as const

type Status = keyof typeof newsStatusLabels

export default async function NewsListPage({ searchParams }: Props) {
  await requirePanelUser('news:write')
  const { q = '', estado, categoria, pagina } = await searchParams
  const status = estado && estado in newsStatusLabels ? (estado as Status) : null
  const categoryId = isUuid(categoria) ? categoria : null
  const [{ items, page, totalPages, total }, options] = await Promise.all([
    listNewsAdmin({ q, status, categoryId, page: Number.parseInt(pagina ?? '1', 10) || 1 }),
    newsFormOptions(),
  ])
  const filtered = Boolean(q || status || categoryId)

  return (
    <>
      <PageHeader
        title="Noticias"
        description="Escribe, programa y publica las noticias del club. Un borrador no se ve en el sitio."
        action={
          <div className="flex flex-wrap gap-2">
            <NewLink href="/admin/noticias/nueva">Nueva noticia</NewLink>
            <Link
              href="/admin/noticias/categorias"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              Categorías
            </Link>
          </div>
        }
      />
      <ListToolbar search={q} placeholder="Buscar por título">
        <FilterSelect
          name="estado"
          label="Estado"
          value={status ?? ''}
          options={optionsFromLabels(newsStatusLabels)}
          allLabel="Todos"
        />
        <FilterSelect
          name="categoria"
          label="Categoría"
          value={categoryId ?? ''}
          options={options.categories}
          allLabel="Todas"
        />
      </ListToolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={<Newspaper aria-hidden="true" />}
          title={filtered ? 'Sin resultados' : 'Todavía no hay noticias'}
        >
          {filtered
            ? 'Cambia la búsqueda o los filtros.'
            : 'Toca «Nueva noticia», escribe el título, agrega una foto y publícala.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">{total === 1 ? '1 noticia' : `${total} noticias`}</p>
          <ResourceList label="Noticias">
            {items.map((item) => (
              <ResourceRow
                key={item.id}
                title={item.title}
                href={`/admin/noticias/${item.id}`}
                subtitle={
                  <>
                    {newsTypeLabels[item.type]}
                    {item.categoryName && ` · ${item.categoryName}`}
                    {item.status === 'publicada' &&
                      item.publishedAt &&
                      ` · ${formatShortDate(item.publishedAt)}`}
                    {item.status === 'programada' &&
                      item.publishedAt &&
                      ` · sale el ${formatLongDateTime(item.publishedAt)}`}
                    {(item.status === 'borrador' || item.status === 'archivada') &&
                      ` · editada el ${formatShortDate(item.updatedAt)}`}
                  </>
                }
                badges={
                  <>
                    <Badge variant={STATUS_VARIANT[item.status]}>{newsStatusLabels[item.status]}</Badge>
                    {item.isFeatured && <Badge variant="accent">Destacada</Badge>}
                    {item.isPinned && <Badge variant="outline">Fijada</Badge>}
                  </>
                }
                media={
                  item.cover?.thumb ? (
                    // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                    <img src={item.cover.thumb} alt="" className="size-14 rounded-md object-cover" />
                  ) : (
                    <span className="grid size-14 place-items-center rounded-md bg-neutral-100 text-neutral-500">
                      <Newspaper aria-hidden="true" className="size-6" />
                    </span>
                  )
                }
              />
            ))}
          </ResourceList>
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefFor={(n) =>
              `/admin/noticias?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(status ? { estado: status } : {}),
                ...(categoryId ? { categoria: categoryId } : {}),
                pagina: String(n),
              })}`
            }
            className="mt-6"
          />
        </>
      )}
    </>
  )
}
