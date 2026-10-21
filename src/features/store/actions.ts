'use server'

import { and, eq } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { productCategories, productImages, products, productVariants } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { productCategorySchema, productImageSchema, productSchema, productVariantSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const nothing = z.unknown()

const categoryConstraints = {
  product_categories_slug_uq: { message: 'Ya existe una categoría con ese nombre.', field: 'name' },
  products_category_id_product_categories_id_fk: {
    message: 'Esta categoría tiene productos: muévelos a otra antes de eliminarla.',
  },
}

const variantConstraints = {
  product_variants_product_size_uq: { message: 'Este producto ya tiene esa talla.', field: 'sizeLabel' },
}

const imageConstraints = {
  product_images_product_media_uq: { message: 'Esa foto ya está en el producto.', field: 'mediaId' },
}

// ── Categorías ──────────────────────────────────────────────────────────────────────────────────

export async function crearCategoriaTienda(input: unknown): Result {
  return mutate({
    action: 'product_category.create',
    permission: 'store:write',
    entityType: 'product_category',
    schema: productCategorySchema,
    input,
    tags: [tags.store()],
    constraints: categoryConstraints,
    write: async (tx, data) => {
      const slug = await resolveSlug(tx, productCategories, data.name)
      const [row] = await tx
        .insert(productCategories)
        .values({ ...data, slug })
        .returning({ id: productCategories.id })
      if (!row) throw new Error('La categoría no se creó.')
      return { id: row.id, summary: `Creó la categoría de la tienda ${data.name}` }
    },
  })
}

export async function actualizarCategoriaTienda(id: string, input: unknown): Result {
  return mutate({
    action: 'product_category.update',
    permission: 'store:write',
    entityType: 'product_category',
    schema: productCategorySchema,
    input,
    tags: [tags.store()],
    constraints: categoryConstraints,
    write: async (tx, data) => {
      const categoryId = assertId(id, 'No encontramos esa categoría.')
      // El filtro de la tienda (?categoria=) usa el slug: se rehace con el nombre, sin redirecciones.
      const slug = await resolveSlug(tx, productCategories, data.name, categoryId)
      const [row] = await tx
        .update(productCategories)
        .set({ ...data, slug })
        .where(eq(productCategories.id, categoryId))
        .returning({ id: productCategories.id })
      if (!row) throw new Rejection('No encontramos esa categoría. Puede que la hayan eliminado.')
      return { id: categoryId, summary: `Editó la categoría de la tienda ${data.name}` }
    },
  })
}

export async function eliminarCategoriaTienda(id: string): Result {
  return mutate({
    action: 'product_category.delete',
    permission: 'store:write',
    entityType: 'product_category',
    schema: nothing,
    input: null,
    tags: [tags.store()],
    constraints: categoryConstraints,
    write: async (tx) => {
      const categoryId = assertId(id, 'No encontramos esa categoría.')
      const [row] = await tx
        .delete(productCategories)
        .where(eq(productCategories.id, categoryId))
        .returning({ name: productCategories.name })
      if (!row) throw new Rejection('No encontramos esa categoría. Puede que ya la hayan eliminado.')
      return { id: categoryId, summary: `Eliminó la categoría de la tienda ${row.name}` }
    },
  })
}

// ── Productos ───────────────────────────────────────────────────────────────────────────────────

export async function crearProducto(input: unknown): Result {
  return mutate({
    action: 'product.create',
    permission: 'store:write',
    entityType: 'product',
    schema: productSchema,
    input,
    tags: [tags.store()],
    write: async (tx, data) => {
      const slug = await resolveSlug(tx, products, data.name)
      const [row] = await tx
        .insert(products)
        .values({ ...data, slug })
        .returning({ id: products.id })
      if (!row) throw new Error('El producto no se creó.')
      return { id: row.id, summary: `Creó el producto ${data.name}`, meta: { slug } }
    },
  })
}

export async function actualizarProducto(id: string, input: unknown): Result {
  return mutate({
    action: 'product.update',
    permission: 'store:write',
    entityType: 'product',
    schema: productSchema,
    input,
    tags: [tags.store()],
    write: async (tx, data) => {
      const productId = assertId(id, 'No encontramos ese producto.')
      const [current] = await tx
        .select({ slug: products.slug })
        .from(products)
        .where(eq(products.id, productId))
        .for('update')
      if (!current) throw new Rejection('No encontramos ese producto. Puede que lo hayan eliminado.')
      // Al renombrar cambia la dirección; la anterior responde con un 301 (3.9).
      const slug = await resolveSlug(tx, products, data.name, productId)
      await tx
        .update(products)
        .set({ ...data, slug })
        .where(eq(products.id, productId))
      await recordSlugChange(tx, 'product', productId, current.slug, slug)
      return { id: productId, summary: `Editó el producto ${data.name}`, meta: { slug } }
    },
  })
}

export async function eliminarProducto(id: string): Result {
  return mutate({
    action: 'product.delete',
    permission: 'store:write',
    entityType: 'product',
    schema: nothing,
    input: null,
    tags: [tags.store()],
    write: async (tx) => {
      const productId = assertId(id, 'No encontramos ese producto.')
      // Sus tallas y fotos se van con él (ON DELETE CASCADE); los archivos siguen en la biblioteca.
      const [row] = await tx
        .delete(products)
        .where(eq(products.id, productId))
        .returning({ name: products.name })
      if (!row) throw new Rejection('No encontramos ese producto. Puede que ya lo hayan eliminado.')
      return { id: productId, summary: `Eliminó el producto ${row.name}` }
    },
  })
}

async function productName(tx: Tx, productId: string) {
  const [row] = await tx.select({ name: products.name }).from(products).where(eq(products.id, productId))
  if (!row) throw new Rejection('No encontramos ese producto. Puede que lo hayan eliminado.')
  return row.name
}

// ── Tallas ──────────────────────────────────────────────────────────────────────────────────────

export async function agregarTalla(productId: string, input: unknown): Result {
  return mutate({
    action: 'product_variant.create',
    permission: 'store:write',
    entityType: 'product_variant',
    schema: productVariantSchema,
    input,
    tags: [tags.store()],
    constraints: variantConstraints,
    write: async (tx, data) => {
      const id = assertId(productId, 'No encontramos ese producto.')
      const name = await productName(tx, id)
      const [row] = await tx
        .insert(productVariants)
        .values({ ...data, productId: id })
        .returning({ id: productVariants.id })
      if (!row) throw new Error('La talla no se agregó.')
      return { id: row.id, summary: `Agregó la talla ${data.sizeLabel} a ${name}` }
    },
  })
}

export async function actualizarTalla(variantId: string, input: unknown): Result {
  return mutate({
    action: 'product_variant.update',
    permission: 'store:write',
    entityType: 'product_variant',
    schema: productVariantSchema,
    input,
    tags: [tags.store()],
    constraints: variantConstraints,
    write: async (tx, data) => {
      const id = assertId(variantId, 'No encontramos esa talla.')
      const [row] = await tx
        .update(productVariants)
        .set(data)
        .where(eq(productVariants.id, id))
        .returning({ id: productVariants.id })
      if (!row) throw new Rejection('No encontramos esa talla. Puede que la hayan eliminado.')
      return {
        id,
        summary: `Editó la talla ${data.sizeLabel}`,
        meta: { stock: data.stock, isAvailable: data.isAvailable },
      }
    },
  })
}

export async function eliminarTalla(variantId: string): Result {
  return mutate({
    action: 'product_variant.delete',
    permission: 'store:write',
    entityType: 'product_variant',
    schema: nothing,
    input: null,
    tags: [tags.store()],
    write: async (tx) => {
      const id = assertId(variantId, 'No encontramos esa talla.')
      const [row] = await tx
        .delete(productVariants)
        .where(eq(productVariants.id, id))
        .returning({ sizeLabel: productVariants.sizeLabel })
      if (!row) throw new Rejection('No encontramos esa talla. Puede que ya la hayan eliminado.')
      return { id, summary: `Eliminó la talla ${row.sizeLabel}` }
    },
  })
}

// ── Fotos ───────────────────────────────────────────────────────────────────────────────────────

export async function agregarFotoProducto(productId: string, input: unknown): Result {
  return mutate({
    action: 'product_image.create',
    permission: 'store:write',
    entityType: 'product_image',
    schema: productImageSchema,
    input,
    tags: [tags.store()],
    constraints: imageConstraints,
    write: async (tx, data) => {
      const id = assertId(productId, 'No encontramos ese producto.')
      const name = await productName(tx, id)
      await assertPublishableMedia(tx, data.mediaId, 'mediaId')
      const [row] = await tx
        .insert(productImages)
        .values({ ...data, productId: id })
        .returning({ id: productImages.id })
      if (!row) throw new Error('La foto no se agregó.')
      return { id: row.id, summary: `Agregó una foto a ${name}` }
    },
  })
}

export async function quitarFotoProducto(productId: string, imageId: string): Result {
  return mutate({
    action: 'product_image.delete',
    permission: 'store:write',
    entityType: 'product_image',
    schema: nothing,
    input: null,
    tags: [tags.store()],
    write: async (tx) => {
      const id = assertId(imageId, 'No encontramos esa foto.')
      const owner = assertId(productId, 'No encontramos ese producto.')
      const [row] = await tx
        .delete(productImages)
        .where(and(eq(productImages.id, id), eq(productImages.productId, owner)))
        .returning({ id: productImages.id })
      if (!row) throw new Rejection('No encontramos esa foto. Puede que ya la hayan quitado.')
      return { id, summary: 'Quitó una foto de un producto' }
    },
  })
}
