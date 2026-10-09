import type { Metadata } from 'next'
import { connection } from 'next/server'
import { FilterForm, PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { NewsCard } from '@/features/news/components/news-card'
import { newsListHref, resolveNewsParams } from '@/features/news/lib/public-params'
import { getNewsFilters, getNewsPage } from '@/features/news/public-queries'
import { pageMetadata } from '@/features/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await pageMetadata({
    title: 'Noticias',
    description: 'Crónicas, comunicados y novedades de todas las series del Club Deportivo Los Cachorros.',
    path: '/noticias',
  })
  return {
    ...metadata,
    alternates: { ...metadata.alternates, types: { 'application/rss+xml': '/noticias/rss.xml' } },
  }
}

type Param = string | string[] | undefined
type Props = { searchParams: Promise<{ categoria?: Param; serie?: Param; pagina?: Param }> }

export default async function NewsListPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [params, filters] = await Promise.all([searchParams, getNewsFilters()])
  const { category, series, page: requestedPage } = resolveNewsParams(filters, params)
  const { items, page, totalPages } = await getNewsPage(
    category?.slug ?? null,
    series?.slug ?? null,
    requestedPage,
  )
  const active = { category: category?.slug ?? null, series: series?.slug ?? null }
  const filtered = Boolean(category || series)

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Noticias' }]} title="Noticias" />
      <div className="container-site grid grid-cols-1 gap-8 py-8 md:py-12">
        <FilterForm
          action="/noticias"
          selects={[
            {
              name: 'categoria',
              label: 'Categoría',
              value: category?.slug ?? '',
              options: [
                { value: '', label: 'Todas' },
                ...filters.categories.map((item) => ({ value: item.slug, label: item.name })),
              ],
            },
            {
              name: 'serie',
              label: 'Serie',
              value: series?.slug ?? '',
              options: [
                { value: '', label: 'Todas' },
                ...filters.series.map((item) => ({ value: item.slug, label: item.name })),
              ],
            },
          ]}
        />

        {items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No hay noticias con ese filtro' : 'Todavía no hay noticias publicadas'}
          >
            {filtered ? 'Prueba con otra categoría o serie.' : 'Vuelve pronto.'}
          </EmptyState>
        ) : (
          <>
            <h2 className="sr-only">
              {category?.name ?? 'Todas las noticias'}
              {series && ` · ${series.name}`}
              {page > 1 && ` · página ${page}`}
            </h2>
            <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => (
                <li key={item.id}>
                  <NewsCard news={item} priority={index === 0} />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} hrefFor={(n) => newsListHref(active, n)} />
          </>
        )}
      </div>
    </>
  )
}
