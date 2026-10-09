import { Tags } from 'lucide-react'
import type { Metadata } from 'next'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { EmptyState } from '@/components/ui/feedback'
import { crearCategoria } from '@/features/news/actions'
import { listNewsCategoriesAdmin } from '@/features/news/admin-queries'
import { NewsCategoryForm } from '@/features/news/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Categorías de noticias' }

export default async function NewsCategoriesPage() {
  await requirePanelUser('news:write')
  const rows = await listNewsCategoriesAdmin()

  return (
    <>
      <PageHeader
        title="Categorías de noticias"
        description="Los temas por los que se pueden filtrar las noticias en el sitio."
        back={{ href: '/admin/noticias', label: 'Noticias' }}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Tags aria-hidden="true" />} title="Todavía no hay categorías">
          Agrega la primera con el formulario de abajo (por ejemplo, «Primer equipo»).
        </EmptyState>
      ) : (
        <ResourceList label="Categorías">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/noticias/categorias/${row.id}`}
              subtitle={row.newsCount === 1 ? '1 noticia' : `${row.newsCount} noticias`}
            />
          ))}
        </ResourceList>
      )}
      <section aria-labelledby="nueva-categoria" className="mt-10 grid gap-4">
        <h2 id="nueva-categoria" className="text-lg font-bold">
          Nueva categoría
        </h2>
        <NewsCategoryForm action={crearCategoria} defaults={{ name: '', sortOrder: '' }} resetOnSuccess />
      </section>
    </>
  )
}
