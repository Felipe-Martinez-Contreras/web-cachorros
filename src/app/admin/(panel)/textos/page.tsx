import type { Metadata } from 'next'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { listPageBlocksAdmin } from '@/features/pages/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatShortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Textos de páginas' }

export default async function PageBlocksPage() {
  await requirePanelUser('pages:write')
  const rows = await listPageBlocksAdmin()

  return (
    <>
      <PageHeader
        title="Textos de páginas"
        description="Los textos fijos del sitio que puedes cambiar cuando quieras: el relato de la historia, los beneficios de los socios, la política de privacidad y otros."
      />
      <ResourceList label="Textos de páginas">
        {rows.map((row) => (
          <ResourceRow
            key={row.key}
            title={row.label}
            href={`/admin/textos/${row.key}`}
            subtitle={
              <>
                {row.where}
                {row.updatedAt && ` · editado el ${formatShortDate(row.updatedAt)}`}
              </>
            }
            badges={
              <>
                {row.isEmpty && <Badge variant="accent">Sin texto</Badge>}
                {row.isPending && <Badge variant="soft">Falta completar</Badge>}
                {row.href === null && <Badge variant="outline">Su página llega más adelante</Badge>}
              </>
            }
          />
        ))}
      </ResourceList>
    </>
  )
}
