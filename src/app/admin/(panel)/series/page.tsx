import { ArrowDown, ArrowUp, Shield } from 'lucide-react'
import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { moverSerie } from '@/features/series/actions'
import { listSeriesAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { seriesKindLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Series' }

export default async function SeriesListPage() {
  await requirePanelUser('sport:write')
  const rows = await listSeriesAdmin()

  return (
    <>
      <PageHeader
        title="Series"
        description="Las categorías en que compite el club. El orden de esta lista es el que se usa en todo el sitio."
        action={<NewLink href="/admin/series/nueva">Nueva serie</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Shield aria-hidden="true" />} title="Todavía no hay series">
          Crea la primera (por ejemplo, «Honor») para poder programar partidos e inscribir jugadores.
        </EmptyState>
      ) : (
        <ResourceList label="Series">
          {rows.map((row, index) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/series/${row.id}`}
              subtitle={`${seriesKindLabels[row.kind]} · tiempos de ${row.halfLengthMinutes} minutos`}
              badges={
                <>
                  <Badge variant={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                  {row.containsMinors && <Badge variant="soft">Con menores</Badge>}
                </>
              }
              actions={
                <>
                  <ActionButton
                    action={moverSerie.bind(null, row.id, 'subir')}
                    size="icon"
                    disabled={index === 0}
                    aria-label={`Subir ${row.name}`}
                  >
                    <ArrowUp aria-hidden="true" />
                  </ActionButton>
                  <ActionButton
                    action={moverSerie.bind(null, row.id, 'bajar')}
                    size="icon"
                    disabled={index === rows.length - 1}
                    aria-label={`Bajar ${row.name}`}
                  >
                    <ArrowDown aria-hidden="true" />
                  </ActionButton>
                </>
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
