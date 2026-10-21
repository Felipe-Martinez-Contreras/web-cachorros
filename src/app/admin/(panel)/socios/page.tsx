import { Download, UserPlus } from 'lucide-react'
import type { Metadata } from 'next'
import { InboxStatusBadge } from '@/components/admin/inbox'
import {
  FilterSelect,
  ListToolbar,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { MEMBERS_TABS } from '@/features/members/nav'
import { type InboxStatus, listMembershipRequestsAdmin } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { optionsFromLabels } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { inboxStatusLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Socios' }

export default async function MembershipRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  await requirePanelUser('members:write')
  const { estado } = await searchParams
  const status = estado && Object.hasOwn(inboxStatusLabels, estado) ? (estado as InboxStatus) : null
  const rows = await listMembershipRequestsAdmin({ status })

  return (
    <>
      <PageHeader
        title="Socios"
        description="Solicitudes que llegan desde la página Hazte socio. Al aprobar una, el socio entra al padrón con su número."
        action={
          <a
            href="/api/admin/exportar/solicitudes-socio"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <Download aria-hidden="true" /> Exportar CSV
          </a>
        }
      />
      <SectionTabs label="Secciones de Socios" current="/admin/socios" tabs={MEMBERS_TABS} />
      <ListToolbar>
        <FilterSelect
          name="estado"
          label="Estado"
          value={status ?? ''}
          options={optionsFromLabels(inboxStatusLabels)}
          allLabel="Todos los estados"
        />
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState
          icon={<UserPlus aria-hidden="true" />}
          title={status ? 'Sin solicitudes en este estado' : 'Todavía no hay solicitudes'}
        >
          {status
            ? 'Prueba con otro estado.'
            : 'Las solicitudes aparecen aquí apenas alguien envía el formulario.'}
        </EmptyState>
      ) : (
        <ResourceList label="Solicitudes de socio">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.fullName}
              href={`/admin/socios/solicitudes/${row.id}`}
              subtitle={[row.planName ?? 'Sin plan', row.commune, formatLongDateTime(row.createdAt)]
                .filter(Boolean)
                .join(' · ')}
              badges={<InboxStatusBadge status={row.status} />}
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
