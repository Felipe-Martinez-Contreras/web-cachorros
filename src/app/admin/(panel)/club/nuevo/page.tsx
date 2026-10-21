import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearIntegrante } from '@/features/club/actions'
import { BoardMemberForm } from '@/features/club/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo integrante' }

export default async function NewBoardMemberPage() {
  await requirePanelUser('club:write')
  return (
    <>
      <PageHeader title="Nuevo integrante de la directiva" back={{ href: '/admin/club', label: 'Club' }} />
      <BoardMemberForm
        action={crearIntegrante}
        photo={null}
        defaults={{
          fullName: '',
          roleTitle: '',
          photoMediaId: '',
          publicEmail: '',
          termStart: '',
          termEnd: '',
          isCurrent: true,
          sortOrder: '0',
        }}
      />
    </>
  )
}
