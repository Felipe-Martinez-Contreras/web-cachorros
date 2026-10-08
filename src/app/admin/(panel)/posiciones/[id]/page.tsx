import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { eliminarTabla, guardarTabla } from '@/features/standings/actions'
import { getStandingsAdmin } from '@/features/standings/admin-queries'
import { StandingsEditor } from '@/features/standings/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar tabla de posiciones' }

export default async function EditStandingsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('standings:write')
  const { id } = await params
  const detail = isUuid(id) ? await getStandingsAdmin(id) : null
  if (!detail) notFound()
  const { table, rows, teams, preview } = detail

  return (
    <>
      <PageHeader
        title={`Tabla de ${table.seriesName}${table.groupLabel ? ` · ${table.groupLabel}` : ''}`}
        description={`${table.competitionName} · ${table.seasonName} · ${table.pointsWin} puntos por triunfo y ${table.pointsDraw} por empate`}
        back={{ href: '/admin/posiciones', label: 'Tabla de posiciones' }}
      />
      <StandingsEditor
        // Al guardar, la grilla vuelve a partir de lo que quedó en el servidor (ya ordenado).
        key={rows.map((row) => row.teamId).join()}
        action={guardarTabla.bind(null, table.id)}
        teams={teams}
        pointsWin={table.pointsWin}
        pointsDraw={table.pointsDraw}
        defaults={{
          mode: table.mode,
          asOf: table.asOf ?? '',
          sourceNote: table.sourceNote ?? '',
          rows: rows.map((row) => ({ ...row, position: row.position ?? '', note: row.note ?? '' })),
        }}
      />

      <section
        aria-labelledby="vista-titulo"
        className="mt-10 grid max-w-3xl gap-3 border-t border-neutral-200 pt-6"
      >
        <h2 id="vista-titulo" className="text-lg font-bold">
          Así se ve en el sitio
        </h2>
        {preview.length === 0 ? (
          <p className="text-neutral-600">La tabla todavía no tiene equipos.</p>
        ) : (
          <div
            className="overflow-x-auto rounded-lg border border-neutral-200 bg-paper"
            {...{
              role: 'region',
              tabIndex: 0,
              'aria-label': `Vista previa de la tabla de ${table.seriesName}`,
            }}
          >
            <table className="w-full min-w-[32rem] text-sm tabular-nums">
              <caption className="sr-only">Vista previa de la tabla guardada</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  {['Pos', 'Equipo', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DIF', 'PTS'].map((heading) => (
                    <th key={heading} scope="col" className="px-2 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.teamId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-2 py-2">{row.position}</td>
                    <th scope="row" className="px-2 py-2 text-left font-medium">
                      {row.teamName}
                    </th>
                    <td className="px-2 py-2">{row.played}</td>
                    <td className="px-2 py-2">{row.won}</td>
                    <td className="px-2 py-2">{row.drawn}</td>
                    <td className="px-2 py-2">{row.lost}</td>
                    <td className="px-2 py-2">{row.goalsFor}</td>
                    <td className="px-2 py-2">{row.goalsAgainst}</td>
                    <td className="px-2 py-2">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                    <td className="px-2 py-2 font-bold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeleteSection
        what={`la tabla de ${table.seriesName}`}
        description="Se elimina la tabla con sus filas. Los partidos y resultados no se tocan."
        action={eliminarTabla.bind(null, table.id)}
        redirectTo="/admin/posiciones"
        buttonLabel="Eliminar tabla"
        successMessage="Tabla eliminada."
      />
    </>
  )
}
