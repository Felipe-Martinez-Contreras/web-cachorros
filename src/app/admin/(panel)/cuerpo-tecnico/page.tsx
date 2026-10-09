import { ClipboardList } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { EmptyState } from '@/components/ui/feedback'
import { listStaffAdmin } from '@/features/staff/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { staffRoleLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Cuerpo técnico' }

export default async function StaffListPage() {
  await requirePanelUser('players:write')
  const rows = await listStaffAdmin()

  return (
    <>
      <PageHeader
        title="Cuerpo técnico"
        description="Directores técnicos, ayudantes, delegados y demás encargados de cada serie."
        action={<NewLink href="/admin/cuerpo-tecnico/nuevo">Nueva persona</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardList aria-hidden="true" />} title="Todavía no hay nadie">
          Agrega al director técnico y al delegado de cada serie.
        </EmptyState>
      ) : (
        <ResourceList label="Cuerpo técnico">
          {rows.map((row) => {
            const current = row.assignments.filter((assignment) => assignment.isCurrentSeason)
            return (
              <ResourceRow
                key={row.id}
                title={row.fullName}
                href={`/admin/cuerpo-tecnico/${row.id}`}
                subtitle={
                  current.length > 0
                    ? current.map((a) => `${staffRoleLabels[a.role]} de ${a.seriesName}`).join(' · ')
                    : 'Sin cargo en la temporada actual'
                }
              />
            )
          })}
        </ResourceList>
      )}
    </>
  )
}
