import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarIntegrante, eliminarIntegrante } from '@/features/club/actions'
import { getBoardMemberAdmin } from '@/features/club/admin-queries'
import { BoardMemberForm } from '@/features/club/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar integrante' }

export default async function EditBoardMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('club:write')
  const { id } = await params
  const member = isUuid(id) ? await getBoardMemberAdmin(id) : null
  if (!member) notFound()

  return (
    <>
      <PageHeader
        title={member.fullName}
        description={member.roleTitle}
        back={{ href: '/admin/club', label: 'Club' }}
      />
      <BoardMemberForm
        action={actualizarIntegrante.bind(null, member.id)}
        photo={member.photo}
        defaults={{
          fullName: member.fullName,
          roleTitle: member.roleTitle,
          photoMediaId: member.photo?.id ?? '',
          publicEmail: member.publicEmail ?? '',
          termStart: member.termStart ?? '',
          termEnd: member.termEnd ?? '',
          isCurrent: member.isCurrent,
          sortOrder: String(member.sortOrder),
        }}
      />
      <DeleteSection
        what={`a ${member.fullName} de la directiva`}
        description="Al terminar su período, mejor desmarca «Integra la directiva vigente»."
        action={eliminarIntegrante.bind(null, member.id)}
        redirectTo="/admin/club"
        buttonLabel="Eliminar integrante"
        successMessage="Integrante eliminado."
      />
    </>
  )
}
