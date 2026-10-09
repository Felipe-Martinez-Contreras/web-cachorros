import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarTemporada, copiarPlantel, eliminarTemporada } from '@/features/series/actions'
import { CopySquadForm, SeasonForm } from '@/features/series/components/forms'
import { getSeasonAdmin, listSeasonsAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar temporada' }

export default async function EditSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sport:write')
  const { id } = await params
  const [row, all] = await Promise.all([isUuid(id) ? getSeasonAdmin(id) : null, listSeasonsAdmin()])
  if (!row) notFound()
  const others = all.filter((season) => season.id !== row.id).map((s) => ({ value: s.id, label: s.name }))

  return (
    <>
      <PageHeader title={`Editar ${row.name}`} back={{ href: '/admin/temporadas', label: 'Temporadas' }} />
      <SeasonForm
        action={actualizarTemporada.bind(null, row.id)}
        defaults={{
          name: row.name,
          year: row.year,
          startsOn: row.startsOn ?? '',
          endsOn: row.endsOn ?? '',
          isCurrent: row.isCurrent,
        }}
      />

      <section
        aria-labelledby="copiar-titulo"
        className="mt-10 grid max-w-2xl gap-3 border-t border-neutral-200 pt-6"
      >
        <h2 id="copiar-titulo" className="text-lg font-bold">
          Copiar plantel desde otra temporada
        </h2>
        <p className="text-neutral-600">
          Esta temporada tiene {row.players === 1 ? '1 inscripción' : `${row.players} inscripciones`} de
          jugadores y {row.staff === 1 ? '1 asignación' : `${row.staff} asignaciones`} de cuerpo técnico.
          Copiar agrega los que faltan (con su número y serie) y no toca los que ya están; las bajas no se
          copian.
        </p>
        {others.length === 0 ? (
          <p className="text-neutral-600">No hay otra temporada desde la que copiar.</p>
        ) : (
          <CopySquadForm action={copiarPlantel.bind(null, row.id)} seasons={others} />
        )}
      </section>

      <DeleteSection
        what={`la ${row.name}`}
        description="Solo se puede eliminar una temporada sin competencias, partidos ni inscripciones."
        action={eliminarTemporada.bind(null, row.id)}
        redirectTo="/admin/temporadas"
        buttonLabel="Eliminar temporada"
        successMessage="Temporada eliminada."
      />
    </>
  )
}
