import type { Metadata } from 'next'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import {
  actualizarCategoriaTienda,
  crearCategoriaTienda,
  eliminarCategoriaTienda,
} from '@/features/store/actions'
import { listProductCategoriesAdmin } from '@/features/store/admin-queries'
import { ProductCategoryForm } from '@/features/store/components/forms'
import { STORE_TABS } from '@/features/store/nav'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Categorías de la tienda' }

const detailsClass = 'max-w-2xl rounded-lg border border-neutral-200 bg-paper p-3'
const summaryClass = 'flex min-h-12 cursor-pointer items-center font-semibold'

export default async function StoreCategoriesPage() {
  await requirePanelUser('store:write')
  const rows = await listProductCategoriesAdmin()
  const nextOrder = String(rows.reduce((max, row) => Math.max(max, row.sortOrder + 1), 0))

  return (
    <>
      <PageHeader
        title="Categorías de la tienda"
        description="Agrupan los productos en la tienda y sirven de filtro."
      />
      <SectionTabs label="Secciones de Tienda" current="/admin/tienda/categorias" tabs={STORE_TABS} />
      <div className="grid gap-3">
        {rows.length > 0 && (
          <ResourceList label="Categorías">
            {rows.map((row) => (
              <ResourceRow
                key={row.id}
                title={row.name}
                subtitle={row.productCount === 1 ? '1 producto' : `${row.productCount} productos`}
                actions={
                  <ActionButton
                    action={eliminarCategoriaTienda.bind(null, row.id)}
                    successMessage="Categoría eliminada."
                    confirm={{ title: `¿Eliminar la categoría ${row.name}?`, confirmLabel: 'Sí, eliminar' }}
                  >
                    Eliminar
                  </ActionButton>
                }
              />
            ))}
          </ResourceList>
        )}
        {rows.map((row) => (
          <details key={row.id} className={detailsClass}>
            <summary className={summaryClass}>Editar {row.name}</summary>
            <div className="pt-3">
              <ProductCategoryForm
                action={actualizarCategoriaTienda.bind(null, row.id)}
                defaults={{ name: row.name, sortOrder: String(row.sortOrder) }}
              />
            </div>
          </details>
        ))}
        <details className={detailsClass} open={rows.length === 0}>
          <summary className={summaryClass}>Agregar una categoría</summary>
          <div className="pt-3">
            <ProductCategoryForm
              isNew
              action={crearCategoriaTienda}
              defaults={{ name: '', sortOrder: nextOrder }}
            />
          </div>
        </details>
      </div>
    </>
  )
}
