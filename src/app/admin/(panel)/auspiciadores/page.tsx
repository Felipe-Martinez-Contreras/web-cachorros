import { Handshake } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listSponsorsAdmin } from '@/features/sponsors/admin-queries'
import { SPONSORS_TABS } from '@/features/sponsors/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { systemClock } from '@/lib/clock'
import { toIsoDate } from '@/lib/format'
import { sponsorTierLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Auspiciadores' }

export default async function SponsorsAdminPage() {
  await requirePanelUser('sponsors:write')
  const rows = await listSponsorsAdmin()
  const today = toIsoDate(systemClock.now())

  return (
    <>
      <PageHeader
        title="Auspiciadores"
        description="Los auspiciadores del sitio por nivel. Uno vencido o inactivo deja de mostrarse solo."
        action={<NewLink href="/admin/auspiciadores/nuevo">Nuevo auspiciador</NewLink>}
      />
      <SectionTabs label="Secciones de Auspiciadores" current="/admin/auspiciadores" tabs={SPONSORS_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<Handshake aria-hidden="true" />} title="Todavía no hay auspiciadores">
          Agrega el primero para mostrarlo en la portada y en la página Auspiciadores.
        </EmptyState>
      ) : (
        <ResourceList label="Auspiciadores">
          {rows.map((row) => {
            const expired = row.endsOn !== null && row.endsOn < today
            const upcoming = row.startsOn !== null && row.startsOn > today
            return (
              <ResourceRow
                key={row.id}
                title={row.name}
                href={`/admin/auspiciadores/${row.id}`}
                subtitle={sponsorTierLabels[row.tier]}
                badges={
                  <>
                    {!row.isActive && <Badge variant="outline">Oculto</Badge>}
                    {expired && <Badge variant="danger">Vencido</Badge>}
                    {upcoming && <Badge variant="soft">Desde el {row.startsOn}</Badge>}
                  </>
                }
                media={
                  row.logo?.thumb ? (
                    // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                    <img src={row.logo.thumb} alt="" className="size-12 object-contain" />
                  ) : undefined
                }
              />
            )
          })}
        </ResourceList>
      )}
    </>
  )
}
