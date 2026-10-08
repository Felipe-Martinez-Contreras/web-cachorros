import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { sportOptions } from '@/features/series/queries'
import {
  actualizarIntegrante,
  asignarIntegrante,
  eliminarIntegrante,
  quitarAsignacion,
} from '@/features/staff/actions'
import { AssignmentForm, StaffForm } from '@/features/staff/components/forms'
import { getStaffAdmin } from '@/features/staff/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { staffRoleLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Editar persona del cuerpo técnico' }

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('players:write')
  const { id } = await params
  const [row, options] = await Promise.all([isUuid(id) ? getStaffAdmin(id) : null, sportOptions()])
  if (!row) notFound()
  const defaultSeason = options.currentSeasonId ?? ''
  const defaultSeries = options.series[0]?.value ?? ''

  return (
    <>
      <PageHeader title={row.fullName} back={{ href: '/admin/cuerpo-tecnico', label: 'Cuerpo técnico' }} />
      <StaffForm
        action={actualizarIntegrante.bind(null, row.id)}
        photo={row.photo}
        defaults={{ fullName: row.fullName, photoMediaId: row.photo?.id ?? '', bio: row.bio ?? '' }}
      />

      <section
        aria-labelledby="cargos-titulo"
        className="mt-10 grid max-w-2xl gap-3 border-t border-neutral-200 pt-6"
      >
        <h2 id="cargos-titulo" className="text-lg font-bold">
          Cargos
        </h2>
        {row.assignments.length === 0 ? (
          <p className="text-neutral-600">Sin cargos todavía: no aparece en el sitio hasta asignarle uno.</p>
        ) : (
          <ResourceList label="Cargos">
            {row.assignments.map((assignment) => (
              <ResourceRow
                key={assignment.id}
                title={`${staffRoleLabels[assignment.role]} · ${assignment.seriesName}`}
                subtitle={assignment.seasonName}
                actions={
                  <ActionButton
                    action={quitarAsignacion.bind(null, assignment.id)}
                    successMessage="Cargo quitado."
                    confirm={{
                      title: `¿Quitar el cargo en ${assignment.seriesName}?`,
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
        {defaultSeason && defaultSeries ? (
          <details
            className="rounded-lg border border-neutral-200 bg-paper p-3"
            open={row.assignments.length === 0}
          >
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold">
              Asignar un cargo
            </summary>
            <div className="pt-3">
              <AssignmentForm
                action={asignarIntegrante.bind(null, row.id)}
                seasons={options.seasons}
                series={options.series}
                defaults={{ role: 'director_tecnico', seriesId: defaultSeries, seasonId: defaultSeason }}
              />
            </div>
          </details>
        ) : (
          <Alert title="Faltan datos para asignar">Crea primero una temporada y una serie.</Alert>
        )}
      </section>

      <DeleteSection
        what={`a ${row.fullName}`}
        description="Se elimina la persona con todos sus cargos, de esta temporada y de las anteriores."
        action={eliminarIntegrante.bind(null, row.id)}
        redirectTo="/admin/cuerpo-tecnico"
        buttonLabel="Eliminar persona"
        successMessage="Persona eliminada."
      />
    </>
  )
}
