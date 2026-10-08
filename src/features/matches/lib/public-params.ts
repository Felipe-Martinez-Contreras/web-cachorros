type SeriesOption = { id: string; slug: string; name: string }
type SeasonOption = { id: string; name: string; year: number; isCurrent: boolean }

type Nav = { series: SeriesOption[]; seasons: SeasonOption[]; featuredSeriesSlug: string | null }

/**
 * Serie y temporada que muestra una página de Partidos o Plantel según la URL (`?serie=honor&temporada=2026`).
 * Sin parámetros, o con valores que no existen, se usa la serie destacada y la temporada actual (5.1).
 */
export function resolveSportsParams(
  nav: Nav,
  params: { serie?: string | string[]; temporada?: string | string[] },
): { series: SeriesOption | null; season: SeasonOption | null } {
  const serie = Array.isArray(params.serie) ? params.serie[0] : params.serie
  const temporada = Array.isArray(params.temporada) ? params.temporada[0] : params.temporada
  return {
    series:
      nav.series.find((item) => item.slug === serie) ??
      nav.series.find((item) => item.slug === nav.featuredSeriesSlug) ??
      nav.series[0] ??
      null,
    season:
      nav.seasons.find((item) => String(item.year) === temporada) ??
      nav.seasons.find((item) => item.isCurrent) ??
      nav.seasons[0] ??
      null,
  }
}

/** Query string que conserva la serie y la temporada al cambiar de pestaña o de página. */
export function sportsQuery(seriesSlug: string | null, season: SeasonOption | null): string {
  const params = new URLSearchParams()
  if (seriesSlug) params.set('serie', seriesSlug)
  // La temporada actual es el valor por defecto: se omite para dejar las direcciones más limpias.
  if (season && !season.isCurrent) params.set('temporada', String(season.year))
  const query = params.toString()
  return query ? `?${query}` : ''
}
