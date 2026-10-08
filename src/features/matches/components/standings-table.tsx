import { cn } from '@/lib/cn'
import { formatDayMonthNumeric, fromIsoDate } from '@/lib/format'
import type { StandingsDTO } from '../dto'
import { TeamCrest } from './scoreboard'

const COLUMNS = [
  ['PJ', 'Partidos jugados', 'played', true],
  ['PG', 'Partidos ganados', 'won', false],
  ['PE', 'Partidos empatados', 'drawn', false],
  ['PP', 'Partidos perdidos', 'lost', false],
  ['GF', 'Goles a favor', 'goalsFor', false],
  ['GC', 'Goles en contra', 'goalsAgainst', false],
  ['DIF', 'Diferencia de goles', 'goalDiff', true],
  ['PTS', 'Puntos', 'points', true],
] as const

type StandingsTableProps = {
  standings: StandingsDTO
  /** Vista compacta (PJ, DIF y PTS): mini-tabla de la portada y celulares. */
  compact?: boolean
  className?: string
}

/**
 * Tabla de posiciones con encabezados reales, fila del club resaltada y primera columna fija cuando hay
 * desplazamiento horizontal (especificación 4.5 y 6.2).
 */
export function StandingsTable({ standings, compact = false, className }: StandingsTableProps) {
  const columns = COLUMNS.filter(([, , , essential]) => !compact || essential)
  // La tabla completa puede desplazarse en horizontal: esa región debe poder enfocarse con el teclado.
  const scrollRegion = compact
    ? {}
    : { role: 'region', tabIndex: 0, 'aria-label': `Tabla de posiciones de ${standings.seriesName}` }
  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-lg border border-(--border)" {...scrollRegion}>
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="sr-only">
            Tabla de posiciones de {standings.seriesName}, {standings.competitionName}
          </caption>
          <thead>
            <tr className="border-b border-(--border) text-(--muted)">
              <th scope="col" className="w-10 px-2 py-3 text-center font-semibold">
                <abbr title="Posición" className="no-underline">
                  Pos
                </abbr>
              </th>
              <th scope="col" className="sticky left-0 bg-(--bg) px-2 py-3 text-left font-semibold">
                Equipo
              </th>
              {columns.map(([short, long]) => (
                <th key={short} scope="col" className="px-2 py-3 text-center font-semibold">
                  <abbr title={long} className="no-underline">
                    {short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row) => {
              const own = row.team.isOwnClub
              // La fila del club se distingue por fondo, peso del texto y una marca lateral (no solo por color).
              const cellBg = own ? 'bg-accent-soft' : 'bg-(--bg)'
              return (
                <tr
                  key={row.team.name}
                  className={cn('border-b border-(--border) last:border-0', own && 'font-bold')}
                  aria-current={own ? 'true' : undefined}
                >
                  <td
                    className={cn(
                      'px-2 py-3 text-center',
                      cellBg,
                      own && 'border-l-4 border-l-accent-strong',
                    )}
                  >
                    {row.position}
                  </td>
                  <th scope="row" className={cn('sticky left-0 px-2 py-3 text-left font-[inherit]', cellBg)}>
                    <span className="flex items-center gap-2">
                      <TeamCrest team={row.team} size="sm" className="size-6" />
                      <span className="whitespace-nowrap">{row.team.shortName}</span>
                    </span>
                  </th>
                  {columns.map(([short, , key]) => (
                    <td
                      key={short}
                      className={cn('px-2 py-3 text-center', cellBg, key === 'points' && 'font-bold')}
                    >
                      {key === 'goalDiff' && row.goalDiff > 0 ? `+${row.goalDiff}` : row[key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {(standings.asOf || standings.sourceNote) && (
        <p className="mt-2 text-sm text-(--muted)">
          {standings.asOf && `Actualizada al ${formatDayMonthNumeric(fromIsoDate(standings.asOf))}. `}
          {standings.sourceNote}
        </p>
      )}
    </div>
  )
}
