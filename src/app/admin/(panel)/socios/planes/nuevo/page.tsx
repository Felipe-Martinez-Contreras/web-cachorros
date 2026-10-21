import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearPlan } from '@/features/members/actions'
import { PlanForm } from '@/features/members/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo plan' }

export default async function NewPlanPage() {
  await requirePanelUser('members:write')
  return (
    <>
      <PageHeader title="Nuevo plan" back={{ href: '/admin/socios/planes', label: 'Planes' }} />
      <PlanForm
        action={crearPlan}
        defaults={{
          name: '',
          feeClp: '',
          feePeriod: 'mensual',
          benefits: '',
          isActive: true,
          sortOrder: '0',
        }}
      />
    </>
  )
}
