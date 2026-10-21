import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Alert } from '@/components/ui/feedback'
import { actualizarHorario, crearHorario, eliminarHorario } from '@/features/club/actions'
import { listTrainingAdmin } from '@/features/club/admin-queries'
import { TrainingScheduleForm } from '@/features/club/components/forms'
import { CLUB_TABS } from '@/features/club/nav'
import { sportOptions } from '@/features/series/queries'
import { teamAndVenueOptions } from '@/features/teams/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { weekdayLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Horarios de entrenamiento' }

const detailsClass = 'max-w-2xl rounded-lg border border-neutral-200 bg-paper p-3'
const summaryClass = 'flex min-h-12 cursor-pointer items-center font-semibold'

export default async function TrainingAdminPage() {
  await requirePanelUser('club:write')
  const [rows, { series }, { venues, homeVenueId }] = await Promise.all([
    listTrainingAdmin(),
    sportOptions(),
    teamAndVenueOptions(),
  ])
  const label = (row: (typeof rows)[number]) =>
    `${row.seriesName} · ${weekdayLabels[row.weekday]} ${row.startsAt} a ${row.endsAt}`

  return (
    <>
      <PageHeader
        title="Horarios de entrenamiento"
        description="Se muestran en La cancha y, los de las series formativas y juveniles, en Divisiones formativas."
      />
      <SectionTabs label="Secciones de Club" current="/admin/club/horarios" tabs={CLUB_TABS} />
      {series.length === 0 ? (
        <Alert title="Faltan series">Crea primero las series en Competencia → Series.</Alert>
      ) : (
        <div className="grid gap-3">
          {rows.length > 0 && (
            <ResourceList label="Horarios">
              {rows.map((row) => (
                <ResourceRow
                  key={row.id}
                  title={label(row)}
                  subtitle={[row.venueName, row.notes].filter(Boolean).join(' · ') || undefined}
                  actions={
                    <ActionButton
                      action={eliminarHorario.bind(null, row.id)}
                      successMessage="Horario eliminado."
                      confirm={{ title: `¿Eliminar el horario ${label(row)}?`, confirmLabel: 'Sí, eliminar' }}
                    >
                      Eliminar
                    </ActionButton>
                  }
                />
              ))}
            </ResourceList>
          )}
          {rows.map((row) => (
            <details key={row.id} className={detailsClass}>
              <summary className={summaryClass}>Editar {label(row)}</summary>
              <div className="pt-3">
                <TrainingScheduleForm
                  action={actualizarHorario.bind(null, row.id)}
                  series={series}
                  venues={venues}
                  defaults={{
                    seriesId: row.seriesId,
                    weekday: String(row.weekday),
                    startsAt: row.startsAt,
                    endsAt: row.endsAt,
                    venueId: row.venueId ?? '',
                    notes: row.notes ?? '',
                  }}
                />
              </div>
            </details>
          ))}
          <details className={detailsClass} open={rows.length === 0}>
            <summary className={summaryClass}>Agregar un horario</summary>
            <div className="pt-3">
              <TrainingScheduleForm
                isNew
                action={crearHorario}
                series={series}
                venues={venues}
                defaults={{
                  seriesId: series[0]?.value ?? '',
                  weekday: '2',
                  startsAt: '19:00',
                  endsAt: '20:30',
                  venueId: homeVenueId ?? '',
                  notes: '',
                }}
              />
            </div>
          </details>
        </div>
      )}
    </>
  )
}
