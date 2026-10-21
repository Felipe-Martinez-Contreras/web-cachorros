import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import {
  mediaAssets,
  productCategories,
  productImages,
  products,
  productVariants,
  slugRedirects,
} from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { type ImageDTO, toImageDTO } from '@/lib/images/dto'
import type { ProductCardDTO, ProductDetailDTO, StoreCategoryDTO } from './dto'
import { isVariantOrderable } from './lib/order'

type VariantRow = { productId: string; sizeLabel: string; stock: number | null; isAvailable: boolean }

async function loadVariants(productIds: string[]): Promise<Map<string, VariantRow[]>> {
  const byProduct = new Map<string, VariantRow[]>()
  if (productIds.length === 0) return byProduct
  const rows = await db
    .select({
      productId: productVariants.productId,
      sizeLabel: productVariants.sizeLabel,
      stock: productVariants.stock,
      isAvailable: productVariants.isAvailable,
    })
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.sizeLabel))
  for (const row of rows) byProduct.set(row.productId, [...(byProduct.get(row.productId) ?? []), row])
  return byProduct
}

async function loadImages(productIds: string[]): Promise<Map<string, ImageDTO[]>> {
  const byProduct = new Map<string, ImageDTO[]>()
  if (productIds.length === 0) return byProduct
  const rows = await db
    .select({
      productId: productImages.productId,
      variants: mediaAssets.variants,
      width: mediaAssets.width,
      height: mediaAssets.height,
      altText: mediaAssets.altText,
      lqip: mediaAssets.lqip,
      credit: mediaAssets.credit,
      focalX: mediaAssets.focalX,
      focalY: mediaAssets.focalY,
    })
    .from(productImages)
    .innerJoin(mediaAssets, eq(mediaAssets.id, productImages.mediaId))
    // Una foto marcada con menores no se publica (9.6), aunque haya quedado asignada.
    .where(and(inArray(productImages.productId, productIds), eq(mediaAssets.containsMinors, false)))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
  for (const { productId, ...media } of rows) {
    const image = toImageDTO(media)
    if (image) byProduct.set(productId, [...(byProduct.get(productId) ?? []), image])
  }
  return byProduct
}

const isSoldOut = (variants: VariantRow[], trackStock: boolean) =>
  variants.length > 0 && !variants.some((variant) => isVariantOrderable(variant, trackStock))

/** Catálogo público: productos activos agrupados por categoría (6.8). Los sin categoría van al final. */
export async function getStoreCatalog(): Promise<StoreCategoryDTO[]> {
  'use cache'
  cacheTag(tags.store(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      priceClp: products.priceClp,
      compareAtPriceClp: products.compareAtPriceClp,
      trackStock: products.trackStock,
      categorySlug: productCategories.slug,
      categoryName: productCategories.name,
    })
    .from(products)
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(eq(products.isActive, true))
    .orderBy(
      asc(productCategories.sortOrder),
      asc(productCategories.name),
      asc(products.sortOrder),
      asc(products.name),
    )
  const ids = rows.map((row) => row.id)
  const [variants, images] = await Promise.all([loadVariants(ids), loadImages(ids)])

  const groups: StoreCategoryDTO[] = []
  const other: ProductCardDTO[] = []
  for (const row of rows) {
    const card: ProductCardDTO = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      priceClp: row.priceClp,
      compareAtPriceClp: row.compareAtPriceClp,
      image: images.get(row.id)?.[0] ?? null,
      soldOut: isSoldOut(variants.get(row.id) ?? [], row.trackStock),
    }
    if (!row.categorySlug || !row.categoryName) {
      other.push(card)
      continue
    }
    const last = groups.at(-1)
    if (last?.slug === row.categorySlug) last.products.push(card)
    else groups.push({ slug: row.categorySlug, name: row.categoryName, products: [card] })
  }
  if (other.length > 0) groups.push({ slug: 'otros', name: 'Otros productos', products: other })
  return groups
}

/** Producto activo por su slug vigente, con fotos y tallas; `null` si no existe o está oculto. */
export async function getProductDetail(slug: string): Promise<ProductDetailDTO | null> {
  'use cache'
  cacheTag(tags.store(), tags.media())
  cacheLife('hours')

  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      priceClp: products.priceClp,
      compareAtPriceClp: products.compareAtPriceClp,
      trackStock: products.trackStock,
      updatedAt: products.updatedAt,
      categorySlug: productCategories.slug,
      categoryName: productCategories.name,
    })
    .from(products)
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1)
  if (!row) return null

  const [variants, images] = await Promise.all([loadVariants([row.id]), loadImages([row.id])])
  const sizes = (variants.get(row.id) ?? []).map((variant) => ({
    label: variant.sizeLabel,
    orderable: isVariantOrderable(variant, row.trackStock),
  }))
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceClp: row.priceClp,
    compareAtPriceClp: row.compareAtPriceClp,
    category:
      row.categorySlug && row.categoryName ? { slug: row.categorySlug, name: row.categoryName } : null,
    images: images.get(row.id) ?? [],
    sizes,
    soldOut: sizes.length > 0 && !sizes.some((size) => size.orderable),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Slug vigente de un producto activo al que se llegó por una dirección antigua (segunda barrera). */
export async function resolveProductRedirect(oldSlug: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: products.slug })
    .from(slugRedirects)
    .innerJoin(products, eq(products.id, slugRedirects.entityId))
    .where(
      and(
        eq(slugRedirects.entityType, 'product'),
        eq(slugRedirects.oldSlug, oldSlug),
        eq(products.isActive, true),
      ),
    )
    .limit(1)
  return row?.slug ?? null
}
