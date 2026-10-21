import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearProducto } from '@/features/store/actions'
import { productCategoryOptions } from '@/features/store/admin-queries'
import { ProductForm } from '@/features/store/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo producto' }

export default async function NewProductPage() {
  await requirePanelUser('store:write')
  const categories = await productCategoryOptions()
  return (
    <>
      <PageHeader title="Nuevo producto" back={{ href: '/admin/tienda', label: 'Tienda' }} />
      <ProductForm
        isNew
        action={crearProducto}
        categories={categories}
        defaults={{
          name: '',
          categoryId: categories[0]?.value ?? '',
          description: '',
          priceClp: '',
          compareAtPriceClp: '',
          trackStock: false,
          isActive: true,
          sortOrder: '0',
        }}
      />
    </>
  )
}
