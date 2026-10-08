import { ShieldHalf } from 'lucide-react'
import type { Metadata } from 'next'
import { ListToolbar, NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listTeamsAdmin } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Rivales' }

export default async function TeamsListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePanelUser('sport:write')
  const { q = '' } = await searchParams
  const rows = await listTeamsAdmin(q)

  return (
    <>
      <PageHeader
        title="Rivales"
        description="Los clubes contra los que juega el club, con su escudo. El primero de la lista es el club propio."
        action={<NewLink href="/admin/rivales/nuevo">Nuevo rival</NewLink>}
      />
      <ListToolbar search={q} placeholder="Buscar por nombre" />
      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldHalf aria-hidden="true" />}
          title={q ? 'Sin resultados' : 'Todavía no hay clubes'}
        >
          {q ? 'Prueba con otro nombre.' : 'Agrega los rivales del campeonato para programar partidos.'}
        </EmptyState>
      ) : (
        <ResourceList label="Clubes">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/rivales/${row.id}`}
              subtitle={row.commune ?? 'Sin comuna'}
              badges={row.isOwnClub && <Badge variant="dark">Club propio</Badge>}
              media={
                row.crest?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.crest.thumb} alt="" className="size-12 object-contain" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-600">
                    {row.shortName.slice(0, 2).toUpperCase()}
                  </span>
                )
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
