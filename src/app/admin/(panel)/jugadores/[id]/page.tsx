import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/feedback'
import {
  actualizarInscripcion,
  actualizarJugador,
  agregarAjuste,
  eliminarAjuste,
  eliminarInscripcion,
  eliminarJugador,
  inscribirJugador,
} from '@/features/players/actions'
import { AdjustmentForm, PlayerForm, RegistrationForm } from '@/features/players/components/forms'
import { getPlayerAdmin } from '@/features/players/queries'
import { sportOptions } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { registrationStatusLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Editar jugador' }

const sectionClass = 'mt-10 grid max-w-2xl gap-3 border-t border-neutral-200 pt-6'
const detailsClass = 'rounded-lg border border-neutral-200 bg-paper p-3'
const summaryClass = 'flex min-h-12 cursor-pointer items-center font-semibold'

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('players:write')
  const { id } = await params
  const [player, options] = await Promise.all([isUuid(id) ? getPlayerAdmin(id) : null, sportOptions()])
  if (!player) notFound()
  const defaultSeason = options.currentSeasonId ?? ''
  const defaultSeries = options.series[0]?.value ?? ''

  return (
    <>
      <PageHeader
        title={`${player.firstName} ${player.lastName}`}
        back={{ href: '/admin/jugadores', label: 'Jugadores' }}
      />
      {player.isMinor && (
        <Alert title="Es menor de edad" className="mb-6 max-w-2xl">
          En el sitio aparece solo como «{player.firstName} {player.lastName.charAt(0)}.», sin ficha, sin foto
          y sin fecha de nacimiento.
        </Alert>
      )}

      <PlayerForm
        action={actualizarJugador.bind(null, player.id)}
        photo={player.photo}
        defaults={{
          firstName: player.firstName,
          lastName: player.lastName,
          nickname: player.nickname ?? '',
          birthDate: player.birthDate ?? '',
          primaryPosition: player.primaryPosition,
          positionDetail: player.positionDetail ?? '',
          photoMediaId: player.photo?.id ?? '',
          isActive: player.isActive,
          imageConsent: player.imageConsentAt !== null,
        }}
      />

      <section aria-labelledby="inscripciones-titulo" className={sectionClass}>
        <h2 id="inscripciones-titulo" className="text-lg font-bold">
          Inscripciones
        </h2>
        {player.registrations.length === 0 ? (
          <p className="text-neutral-600">
            Todavía no está inscrito en ninguna serie: no aparece en el plantel ni se puede poner en una
            nómina.
          </p>
        ) : (
          <ResourceList label="Inscripciones">
            {player.registrations.map((registration) => (
              <ResourceRow
                key={registration.id}
                title={`${registration.seriesName} · ${registration.seasonName}`}
                subtitle={registration.shirtNumber ? `Camiseta ${registration.shirtNumber}` : 'Sin número'}
                badges={
                  <>
                    <Badge variant={registration.status === 'activo' ? 'success' : 'neutral'}>
                      {registrationStatusLabels[registration.status]}
                    </Badge>
                    {registration.isCaptain && <Badge variant="dark">Capitán</Badge>}
                  </>
                }
                actions={
                  <ActionButton
                    action={eliminarInscripcion.bind(null, registration.id)}
                    successMessage="Inscripción eliminada."
                    confirm={{
                      title: `¿Quitar la inscripción en ${registration.seriesName}?`,
                      description: `Dejará de aparecer en el plantel de ${registration.seasonName}. Sus partidos jugados se conservan.`,
                      confirmLabel: 'Sí, quitar',
                    }}
                  >
                    Quitar
                  </ActionButton>
                }
              />
            ))}
          </ResourceList>
        )}
        {player.registrations.map((registration) => (
          <details key={registration.id} className={detailsClass}>
            <summary className={summaryClass}>
              Editar inscripción en {registration.seriesName} · {registration.seasonName}
            </summary>
            <div className="pt-3">
              <RegistrationForm
                action={actualizarInscripcion.bind(null, registration.id)}
                seasons={options.seasons}
                series={options.series}
                defaults={{
                  seasonId: registration.seasonId,
                  seriesId: registration.seriesId,
                  shirtNumber: registration.shirtNumber ?? '',
                  isCaptain: registration.isCaptain,
                  status: registration.status,
                }}
              />
            </div>
          </details>
        ))}
        {defaultSeason && defaultSeries ? (
          <details className={detailsClass} open={player.registrations.length === 0}>
            <summary className={summaryClass}>Inscribir en una serie</summary>
            <div className="pt-3">
              <RegistrationForm
                isNew
                action={inscribirJugador.bind(null, player.id)}
                seasons={options.seasons}
                series={options.series}
                defaults={{
                  seasonId: defaultSeason,
                  seriesId: defaultSeries,
                  shirtNumber: '',
                  isCaptain: false,
                  status: 'activo',
                }}
              />
            </div>
          </details>
        ) : (
          <Alert title="Faltan datos para inscribir">Crea primero una temporada y una serie.</Alert>
        )}
      </section>

      <section aria-labelledby="historicas-titulo" className={sectionClass}>
        <h2 id="historicas-titulo" className="text-lg font-bold">
          Estadísticas históricas
        </h2>
        <p className="text-neutral-600">
          Las estadísticas se calculan solas desde los partidos cargados. Aquí se suman las de años anteriores
          que el club tenga anotadas, sin crear partidos de mentira.
        </p>
        {player.adjustments.length > 0 && (
          <ResourceList label="Estadísticas históricas">
            {player.adjustments.map((adjustment) => (
              <ResourceRow
                key={adjustment.id}
                title={`${adjustment.seriesName} · ${adjustment.seasonName}`}
                subtitle={
                  <>
                    {adjustment.appearances} PJ · {adjustment.goals} goles · {adjustment.yellowCards}{' '}
                    amarillas · {adjustment.redCards} rojas
                    {adjustment.note && <> · {adjustment.note}</>}
                  </>
                }
                actions={
                  <ActionButton
                    action={eliminarAjuste.bind(null, adjustment.id)}
                    successMessage="Estadísticas eliminadas."
                    confirm={{
                      title: '¿Eliminar estas estadísticas históricas?',
                      confirmLabel: 'Sí, eliminar',
                    }}
                  >
                    Eliminar
                  </ActionButton>
                }
              />
            ))}
          </ResourceList>
        )}
        {defaultSeason && defaultSeries && (
          <details className={detailsClass}>
            <summary className={summaryClass}>Agregar estadísticas de una temporada</summary>
            <div className="pt-3">
              <AdjustmentForm
                action={agregarAjuste.bind(null, player.id)}
                seasons={options.seasons}
                series={options.series}
                defaults={{
                  seasonId: defaultSeason,
                  seriesId: defaultSeries,
                  appearances: 0,
                  goals: 0,
                  yellowCards: 0,
                  redCards: 0,
                  note: '',
                }}
              />
            </div>
          </details>
        )}
      </section>

      <DeleteSection
        what={`a ${player.firstName} ${player.lastName}`}
        description="Solo se puede eliminar un jugador que nunca estuvo en una nómina ni en la cronología de un partido. Si ya jugó, desactívalo."
        action={eliminarJugador.bind(null, player.id)}
        redirectTo="/admin/jugadores"
        buttonLabel="Eliminar jugador"
        successMessage="Jugador eliminado."
      />
    </>
  )
}
