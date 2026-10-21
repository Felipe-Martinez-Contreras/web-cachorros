import { ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listProductsAdmin } from '@/features/store/admin-queries'
import { STORE_TABS } from '@/features/store/nav'
import { requirePanelUser } from '@/lib/auth/session'
import { formatClp } from '@/lib/format'

export const metadata: Metadata = { title: 'Tienda' }

export default async function StoreAdminPage() {
  await requirePanelUser('store:write')
  const rows = await listProductsAdmin()

  return (
    <>
      <PageHeader
        title="Tienda"
        description="Los productos del catálogo. Los pedidos llegan por WhatsApp al número de Configuración."
        action={<NewLink href="/admin/tienda/nuevo">Nuevo producto</NewLink>}
      />
      <SectionTabs label="Secciones de Tienda" current="/admin/tienda" tabs={STORE_TABS} />
      {rows.length === 0 ? (
        <EmptyState icon={<ShoppingBag aria-hidden="true" />} title="Todavía no hay productos">
          Agrega el primero para mostrarlo en la tienda.
        </EmptyState>
      ) : (
        <ResourceList label="Productos">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/tienda/${row.id}`}
              subtitle={`${formatClp(row.priceClp)} · ${row.categoryName ?? 'Sin categoría'}`}
              badges={
                <>
                  {!row.isActive && <Badge variant="outline">Oculto</Badge>}
                  {row.variantCount === 0 && <Badge variant="soft">Sin tallas</Badge>}
                  {!row.cover && <Badge variant="soft">Sin fotos</Badge>}
                </>
              }
              media={
                row.cover?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.cover.thumb} alt="" className="size-12 rounded-sm object-cover" />
                ) : undefined
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
