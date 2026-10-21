import { Images } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listAlbumsAdmin } from '@/features/gallery/admin-queries'
import { GALLERY_TABS } from '@/features/gallery/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { formatShortDate, fromIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Galería y videos' }

export default async function GalleryAdminPage() {
  await requirePanelUser('gallery:write')
  const rows = await listAlbumsAdmin()

  return (
    <>
      <PageHeader
        title="Galería y videos"
        description="Los álbumes de fotos de partidos y actividades. Por defecto, sin fotos de menores."
        action={<NewLink href="/admin/galeria/nuevo">Nuevo álbum</NewLink>}
      />
      <SectionTabs label="Secciones de Galería" current="/admin/galeria" tabs={GALLERY_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<Images aria-hidden="true" />} title="Todavía no hay álbumes">
          Crea el primero y súbele las fotos del partido.
        </EmptyState>
      ) : (
        <ResourceList label="Álbumes">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.title}
              href={`/admin/galeria/${row.id}`}
              subtitle={[
                row.takenOn ? formatShortDate(fromIsoDate(row.takenOn)) : null,
                row.photoCount === 1 ? '1 foto' : `${row.photoCount} fotos`,
              ]
                .filter(Boolean)
                .join(' · ')}
              badges={
                <>
                  {!row.isPublished && <Badge variant="outline">Borrador</Badge>}
                  {row.containsMinors && <Badge variant="soft">Con menores</Badge>}
                </>
              }
              media={
                row.cover?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.cover.thumb} alt="" className="size-12 rounded-sm object-cover" />
                ) : undefined
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
