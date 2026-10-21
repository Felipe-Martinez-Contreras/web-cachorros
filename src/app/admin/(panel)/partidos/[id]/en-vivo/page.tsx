import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import {
  agregarEvento,
  cambiarPeriodo,
  copiarNominaAnterior,
  deshacerUltimoEvento,
  editarEvento,
  eliminarEvento,
  finalizarPartido,
  guardarNomina,
  suspenderPartido,
} from '@/features/matches/actions'
import { consoleSnapshot, getResultSheet } from '@/features/matches/admin-queries'
import { LiveConsole } from '@/features/matches/components/live-console'
import { leerConsola } from '@/features/matches/console-actions'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'En vivo' }

export default async function LiveConsolePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('matches:live')
  const { id } = await params
  const sheet = isUuid(id) ? await getResultSheet(id) : null
  if (!sheet) notFound()
  const { match } = sheet

  return (
    <>
      <PageHeader
        title={`En vivo: ${match.homeShortName} vs ${match.awayShortName}`}
        description={
          <>
            {match.seriesName}
            {match.roundLabel && ` · ${match.roundLabel}`} · {formatLongDateTime(match.kickoffAt)}
          </>
        }
        back={{ href: `/admin/partidos/${match.id}`, label: 'Datos del partido' }}
      />
      {match.clubSide === 'ninguno' ? (
        <Alert title="Partido entre rivales">
          La consola en vivo es para los partidos del club. Carga el marcador final desde «Cargar resultado».
        </Alert>
      ) : (
        <LiveConsole
          matchId={match.id}
          snapshot={consoleSnapshot(sheet)}
          senders={{
            event: agregarEvento.bind(null, match.id),
            period: cambiarPeriodo.bind(null, match.id),
            undo: deshacerUltimoEvento.bind(null, match.id),
            finish: finalizarPartido.bind(null, match.id),
            suspend: suspenderPartido.bind(null, match.id),
          }}
          online={{
            read: leerConsola.bind(null, match.id),
            deleteEvent: eliminarEvento,
            editEvent: editarEvento,
            saveLineup: guardarNomina.bind(null, match.id),
            copyLineup: copiarNominaAnterior.bind(null, match.id),
          }}
        />
      )}
    </>
  )
}
