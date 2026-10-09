import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarSerie, eliminarSerie } from '@/features/series/actions'
import { SeriesForm } from '@/features/series/components/forms'
import { getSeriesAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar serie' }

export default async function EditSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sport:write')
  const { id } = await params
  const row = isUuid(id) ? await getSeriesAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader title={`Editar ${row.name}`} back={{ href: '/admin/series', label: 'Series' }} />
      <SeriesForm
        action={actualizarSerie.bind(null, row.id)}
        defaults={{
          name: row.name,
          shortName: row.shortName,
          kind: row.kind,
          halfLengthMinutes: row.halfLengthMinutes,
          containsMinors: row.containsMinors,
          isActive: row.isActive,
          description: row.description ?? '',
        }}
      />
      <DeleteSection
        what={`la serie ${row.name}`}
        description="Solo se puede eliminar una serie sin partidos ni jugadores. Si ya tiene historia, desactívala."
        action={eliminarSerie.bind(null, row.id)}
        redirectTo="/admin/series"
        buttonLabel="Eliminar serie"
        successMessage="Serie eliminada."
      />
    </>
  )
}
