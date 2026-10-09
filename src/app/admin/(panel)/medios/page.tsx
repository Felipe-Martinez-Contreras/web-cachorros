import { Images } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ListToolbar, PageHeader } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { Uploader } from '@/features/media/components/uploader'
import { listMedia } from '@/features/media/queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Biblioteca de medios' }

type Props = { searchParams: Promise<{ q?: string; pagina?: string }> }

export default async function MediaLibraryPage({ searchParams }: Props) {
  await requirePanelUser('media:write')
  const { q = '', pagina } = await searchParams
  const { items, page, totalPages, total } = await listMedia({
    q,
    page: Number.parseInt(pagina ?? '1', 10) || 1,
  })

  return (
    <>
      <PageHeader
        title="Biblioteca de medios"
        description="Las fotos y escudos del sitio. Se achican en tu celular antes de subirse, para gastar menos datos."
      />

      <details open={total === 0} className="mb-6 rounded-lg border border-neutral-200 bg-paper p-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-lg font-bold">Subir fotos</summary>
        <div className="pt-4">
          <Uploader />
        </div>
      </details>

      <ListToolbar search={q} placeholder="Buscar por descripción o nombre de archivo" />

      {items.length === 0 ? (
        <EmptyState
          icon={<Images aria-hidden="true" />}
          title={q ? 'Sin resultados' : 'Todavía no hay imágenes'}
        >
          {q ? 'Prueba con otra palabra.' : 'Sube la primera con «Subir fotos».'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">
            {total === 1 ? '1 imagen' : `${total} imágenes`}
            {q ? ` con «${q}»` : ''}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((media) => (
              <li key={media.id}>
                <Link
                  href={`/admin/medios/${media.id}`}
                  className="grid gap-1 rounded-lg border border-neutral-200 bg-paper p-2"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-md bg-neutral-100">
                    {media.thumb && (
                      // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                      <img src={media.thumb} alt="" loading="lazy" className="size-full object-contain" />
                    )}
                    {media.containsMinors && (
                      <Badge variant="dark" className="absolute bottom-1 left-1">
                        Menores
                      </Badge>
                    )}
                  </span>
                  <span className="line-clamp-2 min-h-10 text-sm font-medium break-words">{media.alt}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefFor={(n) =>
              `/admin/medios?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(n) })}`
            }
            className="mt-6"
          />
        </>
      )}
    </>
  )
}
