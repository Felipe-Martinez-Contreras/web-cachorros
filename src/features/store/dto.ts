import type { ImageDTO } from '@/lib/images/dto'

export type ProductCardDTO = {
  id: string
  slug: string
  name: string
  priceClp: number
  compareAtPriceClp: number | null
  image: ImageDTO | null
  /** Ninguna talla se puede pedir. */
  soldOut: boolean
}

export type StoreCategoryDTO = { slug: string; name: string; products: ProductCardDTO[] }

export type ProductSizeDTO = { label: string; orderable: boolean }

export type ProductDetailDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  priceClp: number
  compareAtPriceClp: number | null
  category: { slug: string; name: string } | null
  images: ImageDTO[]
  sizes: ProductSizeDTO[]
  soldOut: boolean
  updatedAt: string
}
