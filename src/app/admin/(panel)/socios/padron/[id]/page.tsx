import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarSocio } from '@/features/members/actions'
import { MemberForm } from '@/features/members/components/forms'
import { getMemberAdmin, planOptions } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar socio' }

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('members:write')
  const { id } = await params
  const [row, plans] = await Promise.all([isUuid(id) ? getMemberAdmin(id) : null, planOptions()])
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title={`Socio N.º ${row.memberNumber}`}
        description={`${row.fullName}. Para dar de baja a un socio, cambia su estado: el número queda reservado.`}
        back={{ href: '/admin/socios/padron', label: 'Padrón' }}
      />
      <MemberForm
        action={actualizarSocio.bind(null, row.id)}
        plans={plans}
        defaults={{
          fullName: row.fullName,
          rut: row.rut ?? '',
          email: row.email ?? '',
          phone: row.phone ?? '',
          planId: row.planId ?? '',
          status: row.status,
          joinedOn: row.joinedOn,
        }}
      />
    </>
  )
}
