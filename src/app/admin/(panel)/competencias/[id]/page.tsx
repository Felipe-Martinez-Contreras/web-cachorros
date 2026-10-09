import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarCompetencia, eliminarCompetencia } from '@/features/series/actions'
import { CompetitionForm } from '@/features/series/components/forms'
import { getCompetitionAdmin, sportOptions } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar competencia' }

export default async function EditCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sport:write')
  const { id } = await params
  const [row, options] = await Promise.all([isUuid(id) ? getCompetitionAdmin(id) : null, sportOptions()])
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title={`Editar ${row.name}`}
        back={{ href: '/admin/competencias', label: 'Competencias' }}
      />
      <CompetitionForm
        action={actualizarCompetencia.bind(null, row.id)}
        seasons={options.seasons}
        defaults={{
          seasonId: row.seasonId,
          name: row.name,
          kind: row.kind,
          organizer: row.organizer ?? '',
          pointsWin: row.pointsWin,
          pointsDraw: row.pointsDraw,
        }}
      />
      <DeleteSection
        what={`la competencia ${row.name}`}
        description="Solo se puede eliminar una competencia sin partidos ni tablas de posiciones."
        action={eliminarCompetencia.bind(null, row.id)}
        redirectTo="/admin/competencias"
        buttonLabel="Eliminar competencia"
        successMessage="Competencia eliminada."
      />
    </>
  )
}
