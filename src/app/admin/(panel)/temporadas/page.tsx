import { CalendarRange } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listSeasonsAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatShortDate, fromIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Temporadas' }

export default async function SeasonsListPage() {
  await requirePanelUser('sport:write')
  const rows = await listSeasonsAdmin()

  return (
    <>
      <PageHeader
        title="Temporadas"
        description="Cada año de competencia. Al crear una nueva puedes copiar el plantel de la anterior."
        action={<NewLink href="/admin/temporadas/nueva">Nueva temporada</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarRange aria-hidden="true" />} title="Todavía no hay temporadas">
          Crea la temporada en curso y márcala como actual.
        </EmptyState>
      ) : (
        <ResourceList label="Temporadas">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/temporadas/${row.id}`}
              subtitle={
                row.startsOn && row.endsOn
                  ? `${formatShortDate(fromIsoDate(row.startsOn))} – ${formatShortDate(fromIsoDate(row.endsOn))}`
                  : `Año ${row.year}`
              }
              badges={row.isCurrent && <Badge variant="success">Actual</Badge>}
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
