import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { ClubImage } from '@/components/site/club-image'
import { Badge } from '@/components/ui/badge'
import { formatClp } from '@/lib/format'
import type { ProductCardDTO } from '../dto'

/** Precio del producto; si tiene precio anterior, se muestra tachado (y se anuncia como tal). */
export function ProductPrice({
  priceClp,
  compareAtPriceClp,
  className,
}: {
  priceClp: number
  compareAtPriceClp: number | null
  className?: string
}) {
  return (
    <p className={className}>
      <span className="font-bold">{formatClp(priceClp)}</span>
      {compareAtPriceClp !== null && (
        <>
          {' '}
          <s className="text-(--muted)">
            <span className="sr-only">Antes </span>
            {formatClp(compareAtPriceClp)}
          </s>
        </>
      )}
    </p>
  )
}

/** Tarjeta del catálogo: foto cuadrada, nombre y precio. */
export function ProductCard({ product }: { product: ProductCardDTO }) {
  return (
    <article className="group relative grid content-start gap-3">
      <div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-(--surface)">
        {product.image ? (
          <ClubImage
            image={product.image}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <ShoppingBag aria-hidden="true" className="size-12 text-(--muted)" />
        )}
        {product.soldOut && (
          <Badge variant="dark" className="absolute top-2 left-2">
            Agotado
          </Badge>
        )}
      </div>
      <h3 className="text-lg leading-snug font-bold">
        <Link
          href={`/tienda/${product.slug}`}
          className="after:absolute after:inset-0 hover:underline hover:underline-offset-4"
        >
          {product.name}
        </Link>
      </h3>
      <ProductPrice priceClp={product.priceClp} compareAtPriceClp={product.compareAtPriceClp} />
    </article>
  )
}
