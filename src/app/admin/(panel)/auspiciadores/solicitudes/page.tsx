import { Download, Megaphone } from 'lucide-react'
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
import type { InboxStatus } from '@/features/members/queries'
import { listSponsorshipInquiriesAdmin } from '@/features/sponsors/admin-queries'
import { SPONSORS_TABS } from '@/features/sponsors/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { optionsFromLabels } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { inboxStatusLabels, sponsorTierLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Solicitudes de auspicio' }

export default async function SponsorshipInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  await requirePanelUser('sponsors:write')
  const { estado } = await searchParams
  const status = estado && Object.hasOwn(inboxStatusLabels, estado) ? (estado as InboxStatus) : null
  const rows = await listSponsorshipInquiriesAdmin({ status })

  return (
    <>
      <PageHeader
        title="Solicitudes de auspicio"
        description="Comercios que escribieron desde «¿Quieres auspiciar al club?»."
        action={
          <a
            href="/api/admin/exportar/solicitudes-auspicio"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <Download aria-hidden="true" /> Exportar CSV
          </a>
        }
      />
      <SectionTabs
        label="Secciones de Auspiciadores"
        current="/admin/auspiciadores/solicitudes"
        tabs={SPONSORS_TABS}
      />
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
          icon={<Megaphone aria-hidden="true" />}
          title={status ? 'Sin resultados' : 'No hay solicitudes'}
        >
          {status
            ? 'Prueba con otro estado.'
            : 'Las solicitudes aparecen aquí apenas alguien envía el formulario.'}
        </EmptyState>
      ) : (
        <ResourceList label="Solicitudes de auspicio">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.businessName}
              href={`/admin/auspiciadores/solicitudes/${row.id}`}
              subtitle={[
                row.contactName,
                row.tierInterest ? sponsorTierLabels[row.tierInterest] : null,
                formatLongDateTime(row.createdAt),
              ]
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
