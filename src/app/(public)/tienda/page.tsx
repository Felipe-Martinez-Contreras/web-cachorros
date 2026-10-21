import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PageHero } from '@/components/site/page-shell'
import { badgeVariants } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { pageMetadata } from '@/features/seo/metadata'
import { ProductCard } from '@/features/store/components/product-card'
import { getStoreCatalog } from '@/features/store/queries'
import { cn } from '@/lib/cn'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Tienda',
    description:
      'Camisetas, polerones y accesorios del Club Deportivo Los Cachorros. Elige tu talla y pide por WhatsApp.',
    path: '/tienda',
  })
}

type Props = { searchParams: Promise<{ categoria?: string | string[] }> }

export default async function StorePage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [params, catalog] = await Promise.all([searchParams, getStoreCatalog()])
  const requested = typeof params.categoria === 'string' ? params.categoria : null
  const active = catalog.find((group) => group.slug === requested) ?? null
  const groups = active ? [active] : catalog

  const chip = (selected: boolean) =>
    cn(
      badgeVariants({ variant: selected ? 'dark' : 'neutral' }),
      'min-h-11 px-3 text-sm',
      !selected && 'hover:bg-neutral-200',
    )

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Tienda' }]} title="Tienda">
        <p className="max-w-2xl text-(--muted)">
          Lleva los colores del club. Elige el producto y tu talla, y haz el pedido por WhatsApp: no hay pago
          en línea.
        </p>
      </PageHero>

      <div className="container-site grid grid-cols-1 gap-10 py-8 md:py-12">
        {catalog.length === 0 ? (
          <EmptyState title="La tienda está preparando sus productos">Vuelve pronto.</EmptyState>
        ) : (
          <>
            {catalog.length > 1 && (
              <nav aria-label="Categorías de la tienda">
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Link href="/tienda" className={chip(!active)} aria-current={active ? undefined : 'page'}>
                      Todo
                    </Link>
                  </li>
                  {catalog.map((group) => (
                    <li key={group.slug}>
                      <Link
                        href={`/tienda?categoria=${group.slug}`}
                        className={chip(group === active)}
                        aria-current={group === active ? 'page' : undefined}
                      >
                        {group.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {groups.map((group) => (
              <section key={group.slug} aria-labelledby={`categoria-${group.slug}`} className="grid gap-5">
                <h2 id={`categoria-${group.slug}`} className="text-h2 uppercase">
                  {group.name}
                </h2>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {group.products.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  )
}
