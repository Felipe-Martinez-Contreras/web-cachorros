import type { MediaVariants } from '@/db/schema/media'
import { type CrestScale, crestScale } from './crest'

/** Lo mínimo que necesita `<ClubImage>`: serializable y sin datos internos de la biblioteca. */
export type ImageDTO = {
  src: string
  srcSet: string
  width: number
  height: number
  alt: string
  lqip: string | null
  credit: string | null
  /** Punto focal como `object-position` («50% 30%»). */
  focalPoint: string
  /** Solo escudos y logos: escala óptica dentro de su caja (`.crest`), con y sin disco. */
  crestScale?: CrestScale
}

type MediaRow = {
  variants: MediaVariants | null
  width: number | null
  height: number | null
  altText: string | null
  lqip: string | null
  credit: string | null
  focalX: number
  focalY: number
}

/** Las imágenes las sirve Caddy desde el volumen (`/media/*`); Node no las sirve en producción. */
export function mediaUrl(storagePath: string): string {
  return `/media/${storagePath}`
}

export function toImageDTO(media: MediaRow | null | undefined): ImageDTO | null {
  if (!media?.variants || !media.width || !media.height) return null
  const { webp, master } = media.variants
  const fallback = webp.at(-1)
  return {
    src: mediaUrl(fallback?.path ?? master),
    srcSet: webp.map((variant) => `${mediaUrl(variant.path)} ${variant.width}w`).join(', '),
    width: media.width,
    height: media.height,
    alt: media.altText ?? '',
    lqip: media.lqip,
    credit: media.credit,
    focalPoint: `${Math.round(media.focalX * 100)}% ${Math.round(media.focalY * 100)}%`,
    ...(media.variants.png512
      ? { crestScale: crestScale(media.width, media.height, media.variants.logo) }
      : null),
  }
}

/** Columnas de `media_assets` que necesita `toImageDTO` (para seleccionar solo esas). */
export const imageColumns = {
  variants: true,
  width: true,
  height: true,
  altText: true,
  lqip: true,
  credit: true,
  focalX: true,
  focalY: true,
} as const
