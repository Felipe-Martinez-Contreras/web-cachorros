import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import {
  actualizarProducto,
  actualizarTalla,
  agregarFotoProducto,
  agregarTalla,
  eliminarProducto,
  eliminarTalla,
  quitarFotoProducto,
} from '@/features/store/actions'
import { getProductAdmin, productCategoryOptions } from '@/features/store/admin-queries'
import { ProductForm, ProductImageForm, VariantForm } from '@/features/store/components/forms'
import { isVariantOrderable } from '@/features/store/lib/order'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar producto' }

const sectionClass = 'mt-10 grid max-w-2xl gap-3 border-t border-neutral-200 pt-6'
const detailsClass = 'rounded-lg border border-neutral-200 bg-paper p-3'
const summaryClass = 'flex min-h-12 cursor-pointer items-center font-semibold'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('store:write')
  const { id } = await params
  const [product, categories] = await Promise.all([
    isUuid(id) ? getProductAdmin(id) : null,
    productCategoryOptions(),
  ])
  if (!product) notFound()
  const nextOrder = (items: { sortOrder: number }[]) =>
    String(items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0))

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          product.isActive ? (
            <>
              En el sitio:{' '}
              <Link href={`/tienda/${product.slug}`} className="underline">
                /tienda/{product.slug}
              </Link>
            </>
          ) : (
            'Oculto: no aparece en la tienda.'
          )
        }
        back={{ href: '/admin/tienda', label: 'Tienda' }}
      />
      <ProductForm
        action={actualizarProducto.bind(null, product.id)}
        categories={categories}
        defaults={{
          name: product.name,
          categoryId: product.categoryId ?? '',
          description: product.description ?? '',
          priceClp: String(product.priceClp),
          compareAtPriceClp: product.compareAtPriceClp === null ? '' : String(product.compareAtPriceClp),
          trackStock: product.trackStock,
          isActive: product.isActive,
          sortOrder: String(product.sortOrder),
        }}
      />

      <section aria-labelledby="tallas-titulo" className={sectionClass}>
        <h2 id="tallas-titulo" className="text-lg font-bold">
          Tallas
        </h2>
        {product.variants.length === 0 ? (
          <p className="text-neutral-600">Sin tallas, el producto se pide como «talla única».</p>
        ) : (
          <ResourceList label="Tallas">
            {product.variants.map((variant) => (
              <ResourceRow
                key={variant.id}
                title={variant.sizeLabel}
                subtitle={
                  product.trackStock
                    ? variant.stock === null
                      ? 'Sin control de stock'
                      : `${variant.stock} disponibles`
                    : undefined
                }
                badges={
                  !isVariantOrderable(variant, product.trackStock) && <Badge variant="dark">Agotada</Badge>
                }
                actions={
                  <ActionButton
                    action={eliminarTalla.bind(null, variant.id)}
                    successMessage="Talla eliminada."
                    confirm={{
                      title: `¿Eliminar la talla ${variant.sizeLabel}?`,
                      description: 'Para dejar de ofrecerla un tiempo, mejor desmárcala como disponible.',
                      confirmLabel: 'Sí, eliminar',
                    }}
                  >
                    Eliminar
                  </ActionButton>
                }
              />
            ))}
          </ResourceList>
        )}
        {product.variants.map((variant) => (
          <details key={variant.id} className={detailsClass}>
            <summary className={summaryClass}>Editar la talla {variant.sizeLabel}</summary>
            <div className="pt-3">
              <VariantForm
                action={actualizarTalla.bind(null, variant.id)}
                defaults={{
                  sizeLabel: variant.sizeLabel,
                  stock: variant.stock === null ? '' : String(variant.stock),
                  isAvailable: variant.isAvailable,
                  sortOrder: String(variant.sortOrder),
                }}
              />
            </div>
          </details>
        ))}
        <details className={detailsClass} open={product.variants.length === 0}>
          <summary className={summaryClass}>Agregar una talla</summary>
          <div className="pt-3">
            <VariantForm
              isNew
              action={agregarTalla.bind(null, product.id)}
              defaults={{
                sizeLabel: '',
                stock: '',
                isAvailable: true,
                sortOrder: nextOrder(product.variants),
              }}
            />
          </div>
        </details>
      </section>

      <section aria-labelledby="fotos-titulo" className={sectionClass}>
        <h2 id="fotos-titulo" className="text-lg font-bold">
          Fotos
        </h2>
        {product.images.length === 0 ? (
          <p className="text-neutral-600">Sin fotos, la tienda muestra un ícono en su lugar.</p>
        ) : (
          <ResourceList label="Fotos">
            {product.images.map((image, index) => (
              <ResourceRow
                key={image.id}
                title={image.media.alt || 'Foto sin descripción'}
                subtitle={index === 0 ? 'Portada' : `Orden ${image.sortOrder}`}
                media={
                  image.media.thumb ? (
                    // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                    <img src={image.media.thumb} alt="" className="size-12 rounded-sm object-cover" />
                  ) : undefined
                }
                actions={
                  <ActionButton
                    action={quitarFotoProducto.bind(null, product.id, image.id)}
                    successMessage="Foto quitada."
                    confirm={{
                      title: '¿Quitar esta foto del producto?',
                      description: 'La foto sigue en la biblioteca de medios.',
                      confirmLabel: 'Sí, quitar',
                    }}
                  >
                    Quitar
                  </ActionButton>
                }
              />
            ))}
          </ResourceList>
        )}
        <details className={detailsClass} open={product.images.length === 0}>
          <summary className={summaryClass}>Agregar una foto</summary>
          <div className="pt-3">
            <ProductImageForm
              action={agregarFotoProducto.bind(null, product.id)}
              defaults={{ mediaId: '', sortOrder: nextOrder(product.images) }}
            />
          </div>
        </details>
      </section>

      <DeleteSection
        what={`el producto ${product.name}`}
        description="Se borran también sus tallas. Las fotos siguen en la biblioteca. Para retirarlo un tiempo, mejor ocúltalo."
        action={eliminarProducto.bind(null, product.id)}
        redirectTo="/admin/tienda"
        buttonLabel="Eliminar producto"
        successMessage="Producto eliminado."
      />
    </>
  )
}
