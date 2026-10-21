import {
  checkbox,
  optionalInt,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
  requiredUuid,
} from '@/lib/form-schemas'
import { z } from '@/lib/zod'

const sortOrder = () => requiredInt(0, 999, 'Escribe un número entre 0 y 999.')
const MAX_PRICE = 10_000_000

export const productCategorySchema = z.object({
  name: requiredText('Escribe el nombre de la categoría.', 60),
  sortOrder: sortOrder(),
})
export type ProductCategoryFormValues = z.input<typeof productCategorySchema>

export const productSchema = z
  .object({
    name: requiredText('Escribe el nombre del producto.', 100),
    categoryId: optionalUuid(),
    description: optionalText(2000),
    priceClp: requiredInt(0, MAX_PRICE, 'Escribe el precio en pesos, sin puntos.'),
    compareAtPriceClp: optionalInt(0, MAX_PRICE, 'Escribe el precio anterior en pesos, sin puntos.'),
    trackStock: checkbox(),
    isActive: checkbox(),
    sortOrder: sortOrder(),
  })
  .refine((value) => value.compareAtPriceClp === null || value.compareAtPriceClp > value.priceClp, {
    message: 'El precio anterior tiene que ser mayor que el precio actual.',
    path: ['compareAtPriceClp'],
  })
export type ProductFormValues = z.input<typeof productSchema>

export const productVariantSchema = z.object({
  sizeLabel: requiredText('Escribe la talla (por ejemplo «M» o «10 años»).', 30),
  stock: optionalInt(0, 99_999, 'Escribe las unidades disponibles (0 o más).'),
  isAvailable: checkbox(),
  sortOrder: sortOrder(),
})
export type ProductVariantFormValues = z.input<typeof productVariantSchema>

export const productImageSchema = z.object({
  mediaId: requiredUuid('Elige una foto de la biblioteca.'),
  sortOrder: sortOrder(),
})
export type ProductImageFormValues = z.input<typeof productImageSchema>
