import { FileText } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { FilterForm, PageHero } from '@/components/site/page-shell'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import type { DocumentCategory } from '@/features/club/dto'
import { getTransparency } from '@/features/club/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { formatFileSize, formatShortDate, fromIsoDate } from '@/lib/format'
import { documentCategoryLabels } from '@/lib/labels'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Transparencia',
    description:
      'Actas, balances, rendiciones, estatutos, reglamentos y memorias del Club Deportivo Los Cachorros.',
    path: '/club/transparencia',
  })
}

type Param = string | string[] | undefined
type Props = { searchParams: Promise<{ categoria?: Param; anio?: Param }> }

const first = (value: Param) => (Array.isArray(value) ? value[0] : value)

function isCategory(value: unknown): value is DocumentCategory {
  return typeof value === 'string' && Object.hasOwn(documentCategoryLabels, value)
}

export default async function TransparencyPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const params = await searchParams
  const requestedCategory = first(params.categoria)
  const category = isCategory(requestedCategory) ? requestedCategory : null
  const requestedYear = Number(first(params.anio))
  const year = Number.isInteger(requestedYear) && requestedYear > 1900 ? requestedYear : null
  const { documents, categories, years } = await getTransparency({ category, year })
  const filtered = Boolean(category || year)

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Transparencia' }]} title="Transparencia">
        <p className="max-w-2xl text-(--muted)">
          Los documentos del club, para que cada socio y vecino sepa cómo se administra.
        </p>
      </PageHero>

      <div className="container-site grid grid-cols-1 gap-8 py-8 md:py-12">
        {(categories.length > 1 || years.length > 1) && (
          <FilterForm
            action="/club/transparencia"
            selects={[
              {
                name: 'categoria',
                label: 'Categoría',
                value: category ?? '',
                options: [
                  { value: '', label: 'Todas' },
                  ...categories.map((item) => ({ value: item, label: documentCategoryLabels[item] })),
                ],
              },
              {
                name: 'anio',
                label: 'Año',
                value: year ? String(year) : '',
                options: [
                  { value: '', label: 'Todos' },
                  ...years.map((item) => ({ value: String(item), label: String(item) })),
                ],
              },
            ]}
          />
        )}

        {documents.length === 0 ? (
          <EmptyState
            title={filtered ? 'No hay documentos con ese filtro' : 'Todavía no hay documentos publicados'}
          >
            {filtered ? 'Prueba con otra categoría o año.' : 'Vuelve pronto.'}
          </EmptyState>
        ) : (
          <>
            <h2 className="sr-only">
              {category ? documentCategoryLabels[category] : 'Todos los documentos'}
              {year && ` · ${year}`}
            </h2>
            <ul className="grid gap-3">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border border-(--border) bg-(--surface) p-4"
                >
                  <FileText aria-hidden="true" className="mt-1 size-6 shrink-0 text-accent-strong" />
                  <div className="grid min-w-0 flex-1 basis-56 gap-1">
                    <h3 className="font-bold">{document.title}</h3>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-(--muted)">
                      <Badge variant="neutral">{documentCategoryLabels[document.category]}</Badge>
                      {document.periodLabel && <span>{document.periodLabel}</span>}
                      {document.date && (
                        <time dateTime={document.date}>{formatShortDate(fromIsoDate(document.date))}</time>
                      )}
                      <span>PDF · {formatFileSize(document.bytes)}</span>
                    </p>
                    {document.description && <p className="text-(--muted)">{document.description}</p>}
                  </div>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-11 items-center font-semibold text-(--link) underline"
                  >
                    Abrir PDF
                    <span className="sr-only">de {document.title} (se abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
