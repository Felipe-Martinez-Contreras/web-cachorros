import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearCancha } from '@/features/teams/actions'
import { VenueForm } from '@/features/teams/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva cancha' }

export default async function NewVenuePage() {
  await requirePanelUser('sport:write')
  return (
    <>
      <PageHeader title="Nueva cancha" back={{ href: '/admin/canchas', label: 'Canchas' }} />
      <VenueForm
        action={crearCancha}
        defaults={{ name: '', address: '', commune: '', location: '', isHome: false, notes: '' }}
      />
    </>
  )
}
