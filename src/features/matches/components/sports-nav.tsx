import Link from 'next/link'
import { FilterForm } from '@/components/site/page-shell'
import { cn } from '@/lib/cn'
import type { SportsNavDTO } from '../dto'
import { sportsQuery } from '../lib/public-params'
import { SeriesTabs } from './series-tabs'

const SECTIONS = [
  { key: 'fixture', path: '/partidos', label: 'Fixture y resultados' },
  { key: 'posiciones', path: '/partidos/posiciones', label: 'Posiciones' },
  { key: 'goleadores', path: '/partidos/goleadores', label: 'Goleadores' },
] as const

type Props = {
  nav: SportsNavDTO
  /** Dirección de la página actual, sin parámetros. */
  path: string
  /** Sección activa de Partidos; sin ella (Plantel) no se muestra el segundo nivel. */
  section?: (typeof SECTIONS)[number]['key']
  seriesSlug: string
  season: SportsNavDTO['seasons'][number]
  /** En Plantel la serie va en la ruta (`/plantel/honor`), no como parámetro. */
  seriesInPath?: boolean
}

/**
 * Navegación de las páginas deportivas: pestañas de series, secciones y selector de temporada. Todo son
 * enlaces o un formulario GET: funciona sin JavaScript y cada vista tiene su propia dirección.
 */
export function SportsNav({ nav, path, section, seriesSlug, season, seriesInPath = false }: Props) {
  return (
    <div className="grid gap-4">
      <SeriesTabs
        series={nav.series}
        activeSlug={seriesSlug}
        hrefFor={(slug) =>
          seriesInPath
            ? `/plantel/${slug}${sportsQuery(null, season)}`
            : `${path}${sportsQuery(slug, season)}`
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        {section && (
          <nav aria-label="Secciones de partidos">
            <ul className="flex flex-wrap gap-2">
              {SECTIONS.map((item) => (
                <li key={item.key}>
                  <Link
                    href={`${item.path}${sportsQuery(seriesSlug, season)}`}
                    aria-current={item.key === section ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
                      item.key === section
                        ? 'border-ink bg-ink text-paper'
                        : 'border-neutral-300 hover:border-ink',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {nav.seasons.length > 1 && (
          <FilterForm
            action={path}
            hidden={seriesInPath ? {} : { serie: seriesSlug }}
            selects={[
              {
                name: 'temporada',
                label: 'Temporada',
                value: String(season.year),
                options: nav.seasons.map((item) => ({ value: String(item.year), label: item.name })),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}
