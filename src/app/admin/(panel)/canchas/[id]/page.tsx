import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarCancha, eliminarCancha } from '@/features/teams/actions'
import { VenueForm } from '@/features/teams/components/forms'
import { formatCoordinates } from '@/features/teams/lib/parse-coordinates'
import { getVenueAdmin } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar cancha' }

export default async function EditVenuePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sport:write')
  const { id } = await params
  const row = isUuid(id) ? await getVenueAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader title={`Editar ${row.name}`} back={{ href: '/admin/canchas', label: 'Canchas' }} />
      <VenueForm
        action={actualizarCancha.bind(null, row.id)}
        defaults={{
          name: row.name,
          address: row.address ?? '',
          commune: row.commune ?? '',
          location: formatCoordinates(row.geoLat, row.geoLng),
          isHome: row.isHome,
          notes: row.notes ?? '',
        }}
      />
      <DeleteSection
        what={`la cancha ${row.name}`}
        description="Solo se puede eliminar una cancha sin partidos, eventos ni entrenamientos asociados."
        action={eliminarCancha.bind(null, row.id)}
        redirectTo="/admin/canchas"
        buttonLabel="Eliminar cancha"
        successMessage="Cancha eliminada."
      />
    </>
  )
}
