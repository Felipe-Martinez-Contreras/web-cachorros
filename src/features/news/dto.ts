import type { RichTextDoc } from '@/db/schema/_columns'
import type { newsType } from '@/db/schema/enums'
import type { MatchDTO } from '@/features/matches/dto'
import type { ImageDTO } from '@/lib/images/dto'

export type NewsCardDTO = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  type: (typeof newsType.enumValues)[number]
  categoryName: string | null
  /** Instante ISO 8601 de publicación. */
  publishedAt: string
  cover: ImageDTO | null
}

export type NewsFiltersDTO = {
  categories: { slug: string; name: string }[]
  series: { slug: string; name: string }[]
}

export type NewsPageDTO = { items: NewsCardDTO[]; page: number; totalPages: number; total: number }

export type NewsDetailDTO = NewsCardDTO & {
  categorySlug: string | null
  updatedAt: string
  body: RichTextDoc | null
  /** Imágenes de la biblioteca usadas en el cuerpo, por id. */
  bodyImages: Record<string, ImageDTO>
  series: { slug: string; name: string }[]
  /** Partido relacionado (la crónica abre con su marcador). */
  match: MatchDTO | null
  seoTitle: string | null
  seoDescription: string | null
  /** Imagen para compartir: la elegida para redes o, si no hay, la portada. */
  shareImage: ImageDTO | null
  related: NewsCardDTO[]
}

export type NewsFeedItemDTO = {
  slug: string
  title: string
  summary: string
  categoryName: string | null
  publishedAt: string
}
