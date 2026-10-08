import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearIntegrante } from '@/features/staff/actions'
import { StaffForm } from '@/features/staff/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva persona del cuerpo técnico' }

export default async function NewStaffPage() {
  await requirePanelUser('players:write')
  return (
    <>
      <PageHeader
        title="Nueva persona"
        description="Después de crearla podrás asignarle su cargo en cada serie."
        back={{ href: '/admin/cuerpo-tecnico', label: 'Cuerpo técnico' }}
      />
      <StaffForm
        isNew
        action={crearIntegrante}
        photo={null}
        defaults={{ fullName: '', photoMediaId: '', bio: '' }}
      />
    </>
  )
}
