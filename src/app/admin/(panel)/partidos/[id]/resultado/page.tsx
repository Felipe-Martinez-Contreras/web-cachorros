import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import {
  agregarEvento,
  copiarNominaAnterior,
  eliminarEvento,
  finalizarPartido,
  guardarNomina,
} from '@/features/matches/actions'
import { getResultSheet } from '@/features/matches/admin-queries'
import { ResultLoader } from '@/features/matches/components/result-loader'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Cargar resultado' }

export default async function MatchResultPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('matches:write')
  const { id } = await params
  const sheet = isUuid(id) ? await getResultSheet(id) : null
  if (!sheet) notFound()
  const { match } = sheet

  return (
    <>
      <PageHeader
        title={match.status === 'finalizado' ? 'Corregir resultado' : 'Cargar resultado'}
        description={
          <>
            {match.seriesName}
            {match.roundLabel && ` · ${match.roundLabel}`} · {formatLongDateTime(match.kickoffAt)}
          </>
        }
        back={{ href: `/admin/partidos/${match.id}`, label: 'Datos del partido' }}
      />
      {match.status === 'cancelado' ? (
        <Alert title="Este partido está cancelado">
          Para cargarle un resultado, primero vuelve a programarlo desde los datos del partido.
        </Alert>
      ) : (
        <ResultLoader
          // Tras copiar la nómina o cambiar de partido, el formulario parte de los datos nuevos.
          key={`${match.id}:${sheet.lineup.length}`}
          match={{
            homeName: match.homeShortName,
            awayName: match.awayShortName,
            clubSide: match.clubSide,
            status: match.status,
            resolution: match.resolution,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            homePenalties: match.homePenalties,
            awayPenalties: match.awayPenalties,
            scoreLocked: match.scoreLocked,
          }}
          squad={sheet.squad}
          lineup={sheet.lineup}
          events={sheet.events}
          hasPreviousLineup={sheet.previousMatchId !== null}
          actions={{
            saveLineup: guardarNomina.bind(null, match.id),
            copyLineup: copiarNominaAnterior.bind(null, match.id),
            addEvent: agregarEvento.bind(null, match.id),
            deleteEvent: eliminarEvento,
            finish: finalizarPartido.bind(null, match.id),
          }}
        />
      )}
    </>
  )
}
