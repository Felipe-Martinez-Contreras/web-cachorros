import type { CSSProperties } from 'react'
import type { ImageDTO } from '@/lib/images/dto'

type ClubImageProps = {
  image: ImageDTO
  /** Atributo `sizes`: cuánto ancho ocupa la imagen en cada breakpoint. */
  sizes: string
  /** Solo para la imagen LCP de la página (el hero): la precarga con prioridad alta. */
  priority?: boolean
  /** Reemplaza el texto alternativo de la biblioteca (usa `""` si la imagen es decorativa). */
  alt?: string
  className?: string
  style?: CSSProperties
}

/**
 * Imagen de la biblioteca de medios (especificación 2.7): `srcset` con las variantes WebP generadas al
 * subir, dimensiones explícitas (sin CLS), LQIP de fondo y `object-position` desde el punto focal.
 * No usa el optimizador de Next: las variantes ya existen y las sirve Caddy.
 */
export function ClubImage({ image, sizes, priority = false, alt, className, style }: ClubImageProps) {
  return (
    // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (especificación 2.7)
    <img
      src={image.src}
      srcSet={image.srcSet || undefined}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      className={className}
      style={{
        objectPosition: image.focalPoint,
        ...(image.lqip ? { backgroundImage: `url(${image.lqip})`, backgroundSize: 'cover' } : null),
        ...style,
      }}
    />
  )
}
