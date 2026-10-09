import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FilterSelect,
  ListToolbar,
  NewLink,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { listMatchesAdmin, type MatchListView } from '@/features/matches/admin-queries'
import { sportOptions } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatMatchDate } from '@/lib/format'
import { matchResolutionLabels, matchStatusLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Partidos' }

type Props = {
  searchParams: Promise<{ vista?: string; serie?: string; temporada?: string; pagina?: string }>
}

const VIEWS: { value: MatchListView; label: string }[] = [
  { value: 'proximos', label: 'Por jugar' },
  { value: 'jugados', label: 'Jugados' },
  { value: 'todos', label: 'Todos' },
]

const STATUS_VARIANT = {
  programado: 'neutral',
  en_vivo: 'live',
  finalizado: 'success',
  suspendido: 'soft',
  postergado: 'soft',
  cancelado: 'dark',
} as const

export default async function MatchesListPage({ searchParams }: Props) {
  await requirePanelUser('matches:write')
  const { vista, serie, temporada, pagina } = await searchParams
  const options = await sportOptions()
  const view = VIEWS.some((item) => item.value === vista) ? (vista as MatchListView) : 'proximos'
  const seasonId = isUuid(temporada) ? temporada : options.currentSeasonId
  const seriesId = isUuid(serie) ? serie : null
  const { items, page, totalPages, total } = await listMatchesAdmin({
    seasonId,
    seriesId,
    view,
    page: Number.parseInt(pagina ?? '1', 10) || 1,
  })
  const now = Date.now()

  return (
    <>
      <PageHeader
        title="Partidos"
        description="Programa los partidos y, después de jugarlos, carga el resultado con sus goles y tarjetas."
        action={
          <div className="flex flex-wrap gap-2">
            <NewLink href="/admin/partidos/jornada">Programar jornada</NewLink>
            <Link href="/admin/partidos/nuevo" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Un partido
            </Link>
          </div>
        }
      />
      <ListToolbar>
        <FilterSelect name="vista" label="Mostrar" value={view} options={VIEWS} />
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
        <EmptyState icon={<CalendarDays aria-hidden="true" />} title="No hay partidos aquí">
          {view === 'proximos'
            ? 'Usa «Programar jornada» para crear en un paso los partidos de varias series contra el mismo rival.'
            : 'Cambia el filtro para ver otros partidos.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">{total === 1 ? '1 partido' : `${total} partidos`}</p>
          <ResourceList label="Partidos">
            {items.map((match) => {
              const played = match.status === 'finalizado'
              // Ya debería haberse jugado y todavía no tiene resultado.
              const pending = !played && match.status !== 'cancelado' && match.kickoffAt.getTime() < now
              return (
                <ResourceRow
                  key={match.id}
                  title={
                    played
                      ? `${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}`
                      : `${match.homeName} vs ${match.awayName}`
                  }
                  href={`/admin/partidos/${match.id}`}
                  subtitle={
                    <>
                      {match.seriesName}
                      {match.roundLabel && ` · ${match.roundLabel}`} · {formatMatchDate(match.kickoffAt)}
                      {match.venueName && ` · ${match.venueName}`}
                    </>
                  }
                  badges={
                    <>
                      <Badge variant={STATUS_VARIANT[match.status]}>{matchStatusLabels[match.status]}</Badge>
                      {match.resolution !== 'normal' && played && (
                        <Badge variant="outline">{matchResolutionLabels[match.resolution]}</Badge>
                      )}
                      {match.clubSide === 'ninguno' && <Badge variant="outline">Entre rivales</Badge>}
                      {pending && <Badge variant="accent">Falta el resultado</Badge>}
                    </>
                  }
                  actions={
                    match.status !== 'cancelado' && (
                      <Link
                        href={`/admin/partidos/${match.id}/resultado`}
                        className={buttonVariants({ variant: pending ? 'dark' : 'outline', size: 'lg' })}
                      >
                        {played ? 'Corregir resultado' : 'Cargar resultado'}
                      </Link>
                    )
                  }
                />
              )
            })}
          </ResourceList>
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefFor={(n) =>
              `/admin/partidos?${new URLSearchParams({
                vista: view,
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
