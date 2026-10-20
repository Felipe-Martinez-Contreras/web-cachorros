import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarPlan, eliminarPlan } from '@/features/members/actions'
import { PlanForm } from '@/features/members/components/forms'
import { getPlanAdmin } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar plan' }

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('members:write')
  const { id } = await params
  const row = isUuid(id) ? await getPlanAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader title={`Editar ${row.name}`} back={{ href: '/admin/socios/planes', label: 'Planes' }} />
      <PlanForm
        action={actualizarPlan.bind(null, row.id)}
        defaults={{
          name: row.name,
          feeClp: String(row.feeClp),
          feePeriod: row.feePeriod,
          benefits: (row.benefits ?? []).join('\n'),
          isActive: row.isActive,
          sortOrder: String(row.sortOrder),
        }}
      />
      <DeleteSection
        what={`el plan ${row.name}`}
        description="Solo se puede eliminar un plan sin socios ni solicitudes. Si ya no se ofrece, desactívalo."
        action={eliminarPlan.bind(null, row.id)}
        redirectTo="/admin/socios/planes"
        buttonLabel="Eliminar plan"
        successMessage="Plan eliminado."
      />
    </>
  )
}
