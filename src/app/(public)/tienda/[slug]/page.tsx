import { MessageCircle, ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { Breadcrumbs } from '@/components/site/page-shell'
import { RichText } from '@/components/site/rich-text'
import { loadSite } from '@/components/site/site-frame'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { getPageBlock } from '@/features/pages/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { ProductPrice } from '@/features/store/components/product-card'
import { MAX_ORDER_QUANTITY } from '@/features/store/lib/order'
import { getProductDetail, resolveProductRedirect } from '@/features/store/queries'
import { cn } from '@/lib/cn'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string | string[] }>
}

const ORDER_ERRORS: Record<string, string> = {
  talla: 'Elige una talla disponible.',
  cantidad: `Escribe una cantidad entre 1 y ${MAX_ORDER_QUANTITY}.`,
  whatsapp: 'El pedido por WhatsApp todavía no está disponible. Escríbenos desde la página de contacto.',
}

async function loadProduct(slug: string) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const product = await getProductDetail(slug)
  if (product) return product
  // Segunda barrera (el 404 y el 301 reales los responde el proxy, ADR 0008).
  const current = await resolveProductRedirect(slug)
  if (current) permanentRedirect(`/tienda/${current}`)
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadProduct((await params).slug)
  return pageMetadata({
    title: product.name,
    description: product.description?.slice(0, 160) ?? `${product.name}: pídelo por WhatsApp.`,
    path: `/tienda/${product.slug}`,
    image: product.images[0] ?? null,
  })
}

export default async function ProductPage({ params, searchParams }: Props) {
  const product = await loadProduct((await params).slug)
  const [query, site, sizeGuide] = await Promise.all([
    searchParams,
    loadSite(),
    getPageBlock('tienda.guia-tallas'),
  ])
  const error = typeof query.error === 'string' ? ORDER_ERRORS[query.error] : undefined
  const firstOrderable = product.sizes.find((size) => size.orderable)

  return (
    <div className="container-site grid grid-cols-1 gap-8 py-6 md:py-10">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Inicio' },
          { href: '/tienda', label: 'Tienda' },
          ...(product.category
            ? [{ href: `/tienda?categoria=${product.category.slug}`, label: product.category.name }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
        {product.images.length === 0 ? (
          <div className="grid aspect-square place-items-center rounded-lg bg-(--surface)">
            <ShoppingBag aria-hidden="true" className="size-16 text-(--muted)" />
          </div>
        ) : (
          // Galería sin JavaScript: en el celular se desliza de lado; en pantallas anchas va en columna.
          <ul
            aria-label={`Fotos de ${product.name}`}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:overflow-visible md:px-0"
          >
            {product.images.map((image, index) => (
              <li
                key={image.src}
                className="aspect-square w-[85%] shrink-0 snap-center overflow-hidden rounded-lg bg-(--surface) md:w-auto"
              >
                <ClubImage
                  image={image}
                  priority={index === 0}
                  sizes="(min-width: 768px) 50vw, 85vw"
                  className="size-full object-cover"
                />
              </li>
            ))}
          </ul>
        )}

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <h1 className="text-h1">{product.name}</h1>
            <ProductPrice
              priceClp={product.priceClp}
              compareAtPriceClp={product.compareAtPriceClp}
              className="text-2xl"
            />
            {product.soldOut && (
              <div>
                <Badge variant="dark">Agotado</Badge>
              </div>
            )}
          </div>
          {product.description && <p className="whitespace-pre-line text-(--muted)">{product.description}</p>}

          <section id="pedido" aria-labelledby="pedido-titulo" className="grid gap-4">
            <h2 id="pedido-titulo" className="text-h3">
              Haz tu pedido
            </h2>
            {error && (
              <Alert variant="danger" title="No pudimos armar el pedido">
                {error}
              </Alert>
            )}
            {!site.whatsapp ? (
              <Alert title="Pedidos por WhatsApp muy pronto">
                Mientras tanto, escríbenos desde{' '}
                <Link href="/contacto" className="text-(--link) underline">
                  Contacto
                </Link>
                .
              </Alert>
            ) : product.soldOut ? (
              <p>Por ahora no quedan tallas disponibles de este producto.</p>
            ) : (
              <form method="get" action={`/tienda/${product.slug}/pedido`} className="grid gap-4">
                {product.sizes.length > 0 && (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 font-medium">Talla</legend>
                    <ul className="flex flex-wrap gap-2">
                      {product.sizes.map((size) => (
                        <li key={size.label}>
                          <label
                            className={cn(
                              'relative inline-flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-md border border-neutral-500 px-3',
                              'has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)',
                              !size.orderable && 'cursor-not-allowed text-(--muted) line-through',
                            )}
                          >
                            <input
                              type="radio"
                              name="talla"
                              value={size.label}
                              required
                              disabled={!size.orderable}
                              defaultChecked={size === firstOrderable && product.sizes.length === 1}
                              className="sr-only"
                            />
                            {size.label}
                            {!size.orderable && <span className="sr-only"> (agotada)</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                )}
                {product.sizes.length === 0 && <input type="hidden" name="talla" value="Única" />}
                <Field
                  name="cantidad"
                  label="Cantidad"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_ORDER_QUANTITY}
                  defaultValue={1}
                  required
                  className="max-w-32"
                />
                <button
                  type="submit"
                  className={buttonVariants({ size: 'lg', className: 'justify-self-start' })}
                >
                  <MessageCircle aria-hidden="true" /> Pedir por WhatsApp
                </button>
                <p className="text-sm text-(--muted)">
                  Se abre WhatsApp con el pedido listo para enviar. El total es referencial: la directiva te
                  confirma el valor y la entrega.
                </p>
              </form>
            )}
          </section>

          {sizeGuide && (
            <details className="rounded-lg border border-(--border) p-4">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                Guía de tallas
              </summary>
              <RichText doc={sizeGuide.body} images={sizeGuide.images} className="pt-2" />
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
