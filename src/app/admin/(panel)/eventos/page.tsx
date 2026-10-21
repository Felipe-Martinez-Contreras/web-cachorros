import { CalendarHeart } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listEventsAdmin } from '@/features/events/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatLongDateTime } from '@/lib/format'
import { eventStatusLabels, eventTypeLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Eventos' }

export default async function EventsAdminPage() {
  await requirePanelUser('events:write')
  const rows = await listEventsAdmin()

  return (
    <>
      <PageHeader
        title="Eventos"
        description="Completadas, bingos, rifas y otras actividades del club, con su afiche."
        action={<NewLink href="/admin/eventos/nuevo">Nuevo evento</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarHeart aria-hidden="true" />} title="Todavía no hay eventos">
          Crea el primero para mostrarlo en la portada y en la página Eventos.
        </EmptyState>
      ) : (
        <ResourceList label="Eventos">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.title}
              href={`/admin/eventos/${row.id}`}
              subtitle={`${eventTypeLabels[row.type]} · ${formatLongDateTime(row.startsAt)}`}
              badges={
                <>
                  {!row.isPublished && <Badge variant="outline">Borrador</Badge>}
                  {row.status !== 'programado' && (
                    <Badge variant={row.status === 'cancelado' ? 'danger' : 'neutral'}>
                      {eventStatusLabels[row.status]}
                    </Badge>
                  )}
                </>
              }
              media={
                row.poster?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.poster.thumb} alt="" className="size-12 rounded-sm object-cover" />
                ) : undefined
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
