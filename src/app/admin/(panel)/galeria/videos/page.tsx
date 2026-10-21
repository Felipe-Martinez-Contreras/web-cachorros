import { Video } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listVideosAdmin } from '@/features/gallery/admin-queries'
import { GALLERY_TABS } from '@/features/gallery/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { isContentMarker } from '@/lib/markers'

export const metadata: Metadata = { title: 'Videos' }

const PROVIDERS = { youtube: 'YouTube', facebook: 'Facebook' } as const

export default async function VideosAdminPage() {
  await requirePanelUser('gallery:write')
  const rows = await listVideosAdmin()

  return (
    <>
      <PageHeader
        title="Videos"
        description="Videos de YouTube y Facebook. En el sitio se cargan recién cuando alguien los toca."
        action={<NewLink href="/admin/galeria/videos/nuevo">Nuevo video</NewLink>}
      />
      <SectionTabs label="Secciones de Galería" current="/admin/galeria/videos" tabs={GALLERY_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<Video aria-hidden="true" />} title="Todavía no hay videos">
          Pega la dirección de un video de YouTube o Facebook.
        </EmptyState>
      ) : (
        <ResourceList label="Videos">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.title}
              href={`/admin/galeria/videos/${row.id}`}
              subtitle={PROVIDERS[row.provider]}
              badges={
                <>
                  {!row.isPublished && <Badge variant="outline">Borrador</Badge>}
                  {isContentMarker(row.url) && <Badge variant="soft">Falta la dirección</Badge>}
                </>
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
