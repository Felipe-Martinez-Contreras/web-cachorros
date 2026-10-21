import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarEvento, eliminarEvento } from '@/features/events/actions'
import { getEventAdmin } from '@/features/events/admin-queries'
import { EventForm } from '@/features/events/components/event-form'
import { toSantiagoWallTime } from '@/features/matches/lib/schedule'
import { teamAndVenueOptions } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar evento' }

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('events:write')
  const { id } = await params
  const [event, { venues }] = await Promise.all([
    isUuid(id) ? getEventAdmin(id) : null,
    teamAndVenueOptions(),
  ])
  if (!event) notFound()
  const start = toSantiagoWallTime(event.startsAt)
  const end = event.endsAt ? toSantiagoWallTime(event.endsAt) : null

  return (
    <>
      <PageHeader
        title={event.title}
        description={
          event.isPublished ? (
            <>
              En el sitio:{' '}
              <Link href={`/eventos/${event.slug}`} className="underline">
                /eventos/{event.slug}
              </Link>
            </>
          ) : (
            'Borrador: no aparece en el sitio.'
          )
        }
        back={{ href: '/admin/eventos', label: 'Eventos' }}
      />
      <EventForm
        action={actualizarEvento.bind(null, event.id)}
        poster={event.poster}
        venues={venues}
        defaults={{
          title: event.title,
          type: event.type,
          startDate: start.date,
          startTime: start.time,
          // El día de término solo se muestra si es otro día.
          endDate: end && end.date !== start.date ? end.date : '',
          endTime: end?.time ?? '',
          locationText: event.locationText ?? '',
          venueId: event.venueId ?? '',
          posterMediaId: event.poster?.id ?? '',
          description: event.description,
          priceText: event.priceText ?? '',
          ctaUrl: event.ctaUrl ?? '',
          status: event.status,
          isPublished: event.isPublished,
        }}
      />
      <DeleteSection
        what={`el evento ${event.title}`}
        description="El afiche sigue en la biblioteca. Si ya se hizo, mejor márcalo «Realizado»: queda en los eventos pasados."
        action={eliminarEvento.bind(null, event.id)}
        redirectTo="/admin/eventos"
        buttonLabel="Eliminar evento"
        successMessage="Evento eliminado."
      />
    </>
  )
}
