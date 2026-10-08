import type { socialPlatform } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

export type SocialPlatform = (typeof socialPlatform.enumValues)[number]

export type SocialPostDTO = {
  id: string
  platform: SocialPlatform
  /** Enlace a la publicación original; `null` si aún no se cargó una URL válida. */
  permalink: string | null
  excerpt: string | null
  image: ImageDTO | null
}

export type SocialLinkDTO = { platform: SocialPlatform; url: string }
