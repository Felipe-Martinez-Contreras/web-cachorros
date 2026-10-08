import { Users } from 'lucide-react'
import type { Metadata } from 'next'
import {
  FilterSelect,
  ListToolbar,
  NewLink,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { listPlayersAdmin } from '@/features/players/queries'
import { sportOptions } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { playerPositionLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Jugadores' }

type Props = { searchParams: Promise<{ q?: string; serie?: string; temporada?: string; pagina?: string }> }

export default async function PlayersListPage({ searchParams }: Props) {
  await requirePanelUser('players:write')
  const { q = '', serie, temporada, pagina } = await searchParams
  const options = await sportOptions()
  // Valores por defecto inteligentes: la temporada actual y todas las series.
  const seasonId = isUuid(temporada) ? temporada : options.currentSeasonId
  const seriesId = isUuid(serie) ? serie : null
  const { items, page, totalPages, total } = await listPlayersAdmin({
    q,
    seasonId,
    seriesId,
    page: Number.parseInt(pagina ?? '1', 10) || 1,
  })
  const filtering = q !== '' || seriesId !== null

  return (
    <>
      <PageHeader
        title="Jugadores"
        description="El plantel del club. Cada jugador se inscribe en una o más series por temporada."
        action={<NewLink href="/admin/jugadores/nuevo">Nuevo jugador</NewLink>}
      />
      <ListToolbar search={q} placeholder="Buscar por nombre o apodo">
        <FilterSelect
          name="serie"
          label="Serie"
          value={seriesId ?? ''}
          options={options.series}
          allLabel="Todas las series"
        />
        <FilterSelect name="temporada" label="Temporada" value={seasonId ?? ''} options={options.seasons} />
      </ListToolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title={filtering ? 'Sin resultados' : 'Todavía no hay jugadores'}
        >
          {filtering
            ? 'Prueba con otro nombre o quita el filtro de serie.'
            : 'Crea el primero con «Nuevo jugador» e inscríbelo en su serie.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">{total === 1 ? '1 jugador' : `${total} jugadores`}</p>
          <ResourceList label="Jugadores">
            {items.map((player) => (
              <ResourceRow
                key={player.id}
                title={
                  <>
                    {player.lastName}, {player.firstName}
                    {player.nickname && (
                      <span className="font-normal text-neutral-600"> «{player.nickname}»</span>
                    )}
                  </>
                }
                href={`/admin/jugadores/${player.id}`}
                subtitle={
                  <>
                    {playerPositionLabels[player.primaryPosition]}
                    {player.registrations.length > 0
                      ? ` · ${player.registrations
                          .map((r) => (r.shirtNumber ? `${r.seriesName} #${r.shirtNumber}` : r.seriesName))
                          .join(' · ')}`
                      : ' · sin inscripción esta temporada'}
                  </>
                }
                badges={
                  <>
                    {!player.isActive && <Badge>Inactivo</Badge>}
                    {player.isMinor && <Badge variant="soft">Menor de edad</Badge>}
                  </>
                }
              />
            ))}
          </ResourceList>
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefFor={(n) =>
              `/admin/jugadores?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(seriesId ? { serie: seriesId } : {}),
                ...(seasonId ? { temporada: seasonId } : {}),
                pagina: String(n),
              })}`
            }
            className="mt-6"
          />
        </>
      )}
    </>
  )
}
