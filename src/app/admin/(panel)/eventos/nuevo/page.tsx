import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearEvento } from '@/features/events/actions'
import { EventForm } from '@/features/events/components/event-form'
import { teamAndVenueOptions } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo evento' }

export default async function NewEventPage() {
  await requirePanelUser('events:write')
  const { venues, homeVenueId } = await teamAndVenueOptions()
  return (
    <>
      <PageHeader title="Nuevo evento" back={{ href: '/admin/eventos', label: 'Eventos' }} />
      <EventForm
        action={crearEvento}
        poster={null}
        venues={venues}
        defaults={{
          title: '',
          type: 'completada',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          locationText: '',
          venueId: homeVenueId ?? '',
          posterMediaId: '',
          description: null,
          priceText: '',
          ctaUrl: '',
          status: 'programado',
          isPublished: true,
        }}
      />
    </>
  )
}
