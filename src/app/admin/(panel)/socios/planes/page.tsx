import { BadgeDollarSign } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { MEMBERS_TABS } from '@/features/members/nav'
import { listPlansAdmin } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatClp } from '@/lib/format'
import { feePeriodLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Planes de socio' }

export default async function PlansPage() {
  await requirePanelUser('members:write')
  const rows = await listPlansAdmin()

  return (
    <>
      <PageHeader
        title="Planes de socio"
        description="Los tipos de socio con su cuota y beneficios, tal como aparecen en la página Hazte socio."
        action={<NewLink href="/admin/socios/planes/nuevo">Nuevo plan</NewLink>}
      />
      <SectionTabs label="Secciones de Socios" current="/admin/socios/planes" tabs={MEMBERS_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<BadgeDollarSign aria-hidden="true" />} title="Todavía no hay planes">
          Sin planes, la página Hazte socio no muestra el formulario.
        </EmptyState>
      ) : (
        <ResourceList label="Planes">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/socios/planes/${row.id}`}
              subtitle={`${formatClp(row.feeClp)} ${feePeriodLabels[row.feePeriod]}`}
              badges={!row.isActive && <Badge variant="outline">Inactivo</Badge>}
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
