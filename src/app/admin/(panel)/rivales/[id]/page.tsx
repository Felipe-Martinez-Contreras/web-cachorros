import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarEquipo, eliminarRival } from '@/features/teams/actions'
import { TeamForm } from '@/features/teams/components/forms'
import { getTeamAdmin } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar club' }

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sport:write')
  const { id } = await params
  const row = isUuid(id) ? await getTeamAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title={`Editar ${row.name}`}
        description={
          row.isOwnClub ? 'Este es el club propio: su nombre y escudo se usan en los partidos.' : undefined
        }
        back={{ href: '/admin/rivales', label: 'Rivales' }}
      />
      <TeamForm
        action={actualizarEquipo.bind(null, row.id)}
        crest={row.crest}
        defaults={{
          name: row.name,
          shortName: row.shortName,
          commune: row.commune ?? '',
          crestMediaId: row.crest?.id ?? '',
        }}
      />
      {!row.isOwnClub && (
        <DeleteSection
          what={`el rival ${row.name}`}
          description="Solo se puede eliminar un rival sin partidos ni filas en tablas de posiciones."
          action={eliminarRival.bind(null, row.id)}
          redirectTo="/admin/rivales"
          buttonLabel="Eliminar rival"
          successMessage="Rival eliminado."
        />
      )}
    </>
  )
}
