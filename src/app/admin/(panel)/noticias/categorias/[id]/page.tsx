import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarCategoria, eliminarCategoria } from '@/features/news/actions'
import { getNewsCategoryAdmin } from '@/features/news/admin-queries'
import { NewsCategoryForm } from '@/features/news/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar categoría' }

const LIST = '/admin/noticias/categorias'

export default async function EditNewsCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('news:write')
  const { id } = await params
  const row = isUuid(id) ? await getNewsCategoryAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader title={`Editar ${row.name}`} back={{ href: LIST, label: 'Categorías' }} />
      <NewsCategoryForm
        action={actualizarCategoria.bind(null, row.id)}
        defaults={{ name: row.name, sortOrder: String(row.sortOrder) }}
        redirectTo={LIST}
      />
      <DeleteSection
        what={`la categoría ${row.name}`}
        description="Solo se puede eliminar una categoría que no tiene noticias."
        action={eliminarCategoria.bind(null, row.id)}
        redirectTo={LIST}
        buttonLabel="Eliminar categoría"
        successMessage="Categoría eliminada."
      />
    </>
  )
}
