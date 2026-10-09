export const NEWS_PAGE_SIZE = 9

type Param = string | string[] | undefined
type Option = { slug: string }

const first = (value: Param) => (Array.isArray(value) ? value[0] : value)

/**
 * Filtros del listado de noticias según la URL (`?categoria=&serie=&pagina=`, especificación 5.1). Un valor
 * que no existe se ignora; la página es un entero desde 1.
 */
export function resolveNewsParams<C extends Option, S extends Option>(
  filters: { categories: C[]; series: S[] },
  params: { categoria?: Param; serie?: Param; pagina?: Param },
): { category: C | null; series: S | null; page: number } {
  const page = Number(first(params.pagina))
  return {
    category: filters.categories.find((item) => item.slug === first(params.categoria)) ?? null,
    series: filters.series.find((item) => item.slug === first(params.serie)) ?? null,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  }
}

/** Dirección del listado que conserva los filtros; la página 1 se omite. */
export function newsListHref(
  filters: { category?: string | null; series?: string | null },
  page = 1,
): string {
  const params = new URLSearchParams()
  if (filters.category) params.set('categoria', filters.category)
  if (filters.series) params.set('serie', filters.series)
  if (page > 1) params.set('pagina', String(page))
  const query = params.toString()
  return query ? `/noticias?${query}` : '/noticias'
}
