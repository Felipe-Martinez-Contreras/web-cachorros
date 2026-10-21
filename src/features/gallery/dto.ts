import type { videoProvider } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

export type AlbumCardDTO = {
  id: string
  slug: string
  title: string
  /** Fecha `AAAA-MM-DD` de las fotos, si se conoce. */
  takenOn: string | null
  cover: ImageDTO | null
  photoCount: number
}

export type AlbumPhotoDTO = { id: string; image: ImageDTO; caption: string | null }

export type AlbumDetailDTO = Omit<AlbumCardDTO, 'photoCount'> & {
  photos: AlbumPhotoDTO[]
  match: { slug: string; label: string } | null
  event: { slug: string; title: string } | null
  updatedAt: string
}

export type VideoDTO = {
  id: string
  title: string
  provider: (typeof videoProvider.enumValues)[number]
  url: string
  /** Solo YouTube: el reproductor se carga recién al tocar (fachada). */
  youtubeId: string | null
  thumbnail: ImageDTO | null
  publishedOn: string | null
}
