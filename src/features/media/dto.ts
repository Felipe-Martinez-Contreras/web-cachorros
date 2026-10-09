import type { MediaVariants } from '@/db/schema/media'
import { type ImageDTO, mediaUrl, toImageDTO } from '@/lib/images/dto'

/** Miniatura para grillas y selectores del panel. */
export type MediaThumbDTO = {
  id: string
  /** Variante WebP más pequeña. */
  thumb: string | null
  alt: string
  containsMinors: boolean
}

export type MediaListItemDTO = MediaThumbDTO & {
  width: number | null
  height: number | null
  createdAt: string
}

export type MediaDetailDTO = MediaListItemDTO & {
  image: ImageDTO | null
  credit: string | null
  focalX: number
  focalY: number
  minorsConsentConfirmedAt: string | null
  bytes: number
  originalFilename: string | null
}

export type MediaUsageDTO = { label: string; count: number }

type ThumbRow = {
  id: string
  variants: MediaVariants | null
  altText: string | null
  containsMinors: boolean
}

export function toMediaThumbDTO(row: ThumbRow): MediaThumbDTO {
  const smallest = row.variants?.webp[0]
  return {
    id: row.id,
    thumb: smallest ? mediaUrl(smallest.path) : null,
    alt: row.altText ?? '',
    containsMinors: row.containsMinors,
  }
}

type ListRow = ThumbRow & { width: number | null; height: number | null; createdAt: Date }

export function toMediaListItemDTO(row: ListRow): MediaListItemDTO {
  return {
    ...toMediaThumbDTO(row),
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
  }
}

type DetailRow = ListRow & {
  lqip: string | null
  credit: string | null
  focalX: number
  focalY: number
  minorsConsentConfirmedAt: Date | null
  bytes: number
  originalFilename: string | null
}

export function toMediaDetailDTO(row: DetailRow): MediaDetailDTO {
  return {
    ...toMediaListItemDTO(row),
    image: toImageDTO(row),
    credit: row.credit,
    focalX: row.focalX,
    focalY: row.focalY,
    minorsConsentConfirmedAt: row.minorsConsentConfirmedAt?.toISOString() ?? null,
    bytes: row.bytes,
    originalFilename: row.originalFilename,
  }
}
