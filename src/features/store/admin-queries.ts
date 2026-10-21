import 'server-only'
import { asc, count, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, productCategories, productImages, products, productVariants } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual.

export async function listProductCategoriesAdmin() {
  return db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      slug: productCategories.slug,
      sortOrder: productCategories.sortOrder,
      productCount: count(products.id),
    })
    .from(productCategories)
    .leftJoin(products, eq(products.categoryId, productCategories.id))
    .groupBy(productCategories.id)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name))
}

export function productCategoryOptions() {
  return db
    .select({ value: productCategories.id, label: productCategories.name })
    .from(productCategories)
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name))
}

export async function listProductsAdmin() {
  const [rows, covers] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        priceClp: products.priceClp,
        isActive: products.isActive,
        categoryName: productCategories.name,
        variantCount: count(productVariants.id),
      })
      .from(products)
      .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .groupBy(products.id, productCategories.id)
      .orderBy(asc(productCategories.sortOrder), asc(products.sortOrder), asc(products.name)),
    productImageRows(),
  ])
  // La primera foto de cada producto es su miniatura en la lista.
  const firstImage = new Map<string, MediaThumbDTO>()
  for (const image of covers) {
    if (!firstImage.has(image.productId)) firstImage.set(image.productId, toMediaThumbDTO(image))
  }
  return rows.map((row) => ({ ...row, cover: firstImage.get(row.id) ?? null }))
}

/** Fotos de los productos (o de uno), en su orden. */
function productImageRows(productId?: string) {
  return db
    .select({
      imageId: productImages.id,
      productId: productImages.productId,
      sortOrder: productImages.sortOrder,
      id: mediaAssets.id,
      variants: mediaAssets.variants,
      altText: mediaAssets.altText,
      containsMinors: mediaAssets.containsMinors,
    })
    .from(productImages)
    .innerJoin(mediaAssets, eq(mediaAssets.id, productImages.mediaId))
    .where(productId ? eq(productImages.productId, productId) : undefined)
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
}

export async function getProductAdmin(id: string) {
  const [[product], variants, imageRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        categoryId: products.categoryId,
        description: products.description,
        priceClp: products.priceClp,
        compareAtPriceClp: products.compareAtPriceClp,
        trackStock: products.trackStock,
        isActive: products.isActive,
        sortOrder: products.sortOrder,
      })
      .from(products)
      .where(eq(products.id, id))
      .limit(1),
    db
      .select({
        id: productVariants.id,
        sizeLabel: productVariants.sizeLabel,
        stock: productVariants.stock,
        isAvailable: productVariants.isAvailable,
        sortOrder: productVariants.sortOrder,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.sizeLabel)),
    productImageRows(id),
  ])
  if (!product) return null
  const images = imageRows.map((row) => ({
    id: row.imageId,
    sortOrder: row.sortOrder,
    media: toMediaThumbDTO(row),
  }))
  return { ...product, variants, images }
}
export type ProductAdmin = NonNullable<Awaited<ReturnType<typeof getProductAdmin>>>
