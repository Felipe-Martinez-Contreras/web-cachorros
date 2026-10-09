import { MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listVenuesAdmin } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Canchas' }

export default async function VenuesListPage() {
  await requirePanelUser('sport:write')
  const rows = await listVenuesAdmin()

  return (
    <>
      <PageHeader
        title="Canchas"
        description="Dónde se juegan los partidos. Con la ubicación, el sitio ofrece «Cómo llegar»."
        action={<NewLink href="/admin/canchas/nueva">Nueva cancha</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<MapPin aria-hidden="true" />} title="Todavía no hay canchas">
          Agrega la cancha del club y las de los rivales.
        </EmptyState>
      ) : (
        <ResourceList label="Canchas">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/canchas/${row.id}`}
              subtitle={[row.address, row.commune].filter(Boolean).join(' · ') || 'Sin dirección'}
              badges={
                <>
                  {row.isHome && <Badge variant="dark">Del club</Badge>}
                  {row.geoLat === null && <Badge variant="soft">Sin ubicación en el mapa</Badge>}
                </>
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
