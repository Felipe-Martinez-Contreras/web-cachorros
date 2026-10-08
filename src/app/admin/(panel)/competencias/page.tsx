import { Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { EmptyState } from '@/components/ui/feedback'
import { listCompetitionsAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { competitionKindLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Competencias' }

export default async function CompetitionsListPage() {
  await requirePanelUser('sport:write')
  const rows = await listCompetitionsAdmin()

  return (
    <>
      <PageHeader
        title="Competencias"
        description="Los campeonatos de cada temporada. Definen cuántos puntos vale un triunfo y un empate."
        action={<NewLink href="/admin/competencias/nueva">Nueva competencia</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Trophy aria-hidden="true" />} title="Todavía no hay competencias">
          Crea el campeonato de la temporada para poder programar partidos.
        </EmptyState>
      ) : (
        <ResourceList label="Competencias">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/competencias/${row.id}`}
              subtitle={`${row.seasonName} · ${competitionKindLabels[row.kind]} · ${row.pointsWin} pts por triunfo, ${row.pointsDraw} por empate`}
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
