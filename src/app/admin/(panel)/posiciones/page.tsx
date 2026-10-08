import { ListOrdered } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listStandingsAdmin } from '@/features/standings/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatShortDate, fromIsoDate } from '@/lib/format'
import { standingsModeLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Tabla de posiciones' }

export default async function StandingsListPage() {
  await requirePanelUser('standings:write')
  const rows = await listStandingsAdmin()

  return (
    <>
      <PageHeader
        title="Tabla de posiciones"
        description="Una tabla por serie y competencia. Puedes copiarla a mano desde la asociación o dejar que se calcule con los resultados."
        action={<NewLink href="/admin/posiciones/nueva">Nueva tabla</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<ListOrdered aria-hidden="true" />} title="Todavía no hay tablas">
          Crea la tabla de cada serie para mostrarla en el sitio.
        </EmptyState>
      ) : (
        <ResourceList label="Tablas de posiciones">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={`${row.seriesName}${row.groupLabel ? ` · ${row.groupLabel}` : ''}`}
              href={`/admin/posiciones/${row.id}`}
              subtitle={
                <>
                  {row.competitionName} · {row.seasonName} · {row.teams} equipos
                  {row.asOf && ` · actualizada al ${formatShortDate(fromIsoDate(row.asOf))}`}
                </>
              }
              badges={
                <Badge variant={row.mode === 'calculada' ? 'soft' : 'neutral'}>
                  {standingsModeLabels[row.mode]}
                </Badge>
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
