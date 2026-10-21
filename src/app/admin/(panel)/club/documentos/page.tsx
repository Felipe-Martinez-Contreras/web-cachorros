import { FileText } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listDocumentsAdmin } from '@/features/club/admin-queries'
import { CLUB_TABS } from '@/features/club/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { formatFileSize } from '@/lib/format'
import { documentCategoryLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Documentos' }

export default async function DocumentsAdminPage() {
  await requirePanelUser('club:write')
  const rows = await listDocumentsAdmin()

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Actas, balances, rendiciones y otros PDF de la página Transparencia."
        action={<NewLink href="/admin/club/documentos/nuevo">Nuevo documento</NewLink>}
      />
      <SectionTabs label="Secciones de Club" current="/admin/club/documentos" tabs={CLUB_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<FileText aria-hidden="true" />} title="Todavía no hay documentos">
          Sube el primero para mostrarlo en Transparencia.
        </EmptyState>
      ) : (
        <ResourceList label="Documentos">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.title}
              href={`/admin/club/documentos/${row.id}`}
              subtitle={`${documentCategoryLabels[row.category]}${row.periodLabel ? ` · ${row.periodLabel}` : ''} · ${formatFileSize(row.bytes)}`}
              badges={!row.isPublished && <Badge variant="outline">Borrador</Badge>}
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
