import type { newsType } from '@/db/schema/enums'
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
