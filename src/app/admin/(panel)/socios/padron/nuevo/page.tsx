import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearSocio } from '@/features/members/actions'
import { NewMemberForm } from '@/features/members/components/forms'
import { planOptions } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { systemClock } from '@/lib/clock'
import { toIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Nuevo socio' }

export default async function NewMemberPage() {
  await requirePanelUser('members:write')
  const plans = await planOptions()
  return (
    <>
      <PageHeader title="Nuevo socio" back={{ href: '/admin/socios/padron', label: 'Padrón' }} />
      <NewMemberForm
        action={crearSocio}
        plans={plans}
        defaults={{
          memberNumber: '',
          fullName: '',
          rut: '',
          email: '',
          phone: '',
          planId: '',
          status: 'activo',
          joinedOn: toIsoDate(systemClock.now()),
        }}
      />
    </>
  )
}
