import { Users } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listBoardAdmin } from '@/features/club/admin-queries'
import { CLUB_TABS } from '@/features/club/nav'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Club' }

export default async function ClubAdminPage() {
  await requirePanelUser('club:write')
  const rows = await listBoardAdmin()

  return (
    <>
      <PageHeader
        title="Club"
        description="La directiva que aparece en el sitio y los documentos de transparencia."
        action={<NewLink href="/admin/club/nuevo">Nuevo integrante</NewLink>}
      />
      <SectionTabs label="Secciones de Club" current="/admin/club" tabs={CLUB_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<Users aria-hidden="true" />} title="Todavía no hay directiva">
          Agrega a sus integrantes para mostrarlos en la página Directiva.
        </EmptyState>
      ) : (
        <ResourceList label="Directiva">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.fullName}
              href={`/admin/club/${row.id}`}
              subtitle={row.roleTitle}
              badges={!row.isCurrent && <Badge variant="outline">Período terminado</Badge>}
              media={
                row.photo?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.photo.thumb} alt="" className="size-12 rounded-full object-cover" />
                ) : undefined
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
