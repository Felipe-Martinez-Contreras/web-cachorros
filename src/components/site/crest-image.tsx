import type { CSSProperties } from 'react'
import { type CrestScale, crestScale } from '@/lib/images/crest'
import type { ImageDTO } from '@/lib/images/dto'
import { ClubImage } from './club-image'

/** El escudo genérico (`public/placeholder/escudo-generico.svg`, 512 × 512 con margen), medido una vez. */
const GENERIC_CREST_SCALE = crestScale(512, 512, { v: 1, coverage: 0.593, radius: 0.529 })

/** Escala óptica como variables de `.crest > img` (globals.css): una con disco blanco y otra sin él. */
function crestVars(scale: CrestScale): CSSProperties {
  return { '--crest-disc': scale.disc, '--crest-bare': scale.bare } as CSSProperties
}

/**
 * Imagen de un escudo dentro de `.crest`: ocupa la caja con `object-contain` y se escala según lo visible,
 * para que todos se perciban del mismo tamaño y ninguno se salga del disco. Decorativa (`alt=""`).
 */
export function CrestImage({ image, sizes }: { image: ImageDTO | null; sizes: string }) {
  if (!image) {
    return (
      // biome-ignore lint/performance/noImgElement: archivo estático pequeño, sin optimizador (2.7)
      <img
        src="/placeholder/escudo-generico.svg"
        alt=""
        width={96}
        height={96}
        className="size-full object-contain"
        style={crestVars(GENERIC_CREST_SCALE)}
      />
    )
  }
  return (
    <ClubImage
      image={image}
      alt=""
      sizes={sizes}
      className="size-full object-contain"
      style={{
        backgroundImage: 'none',
        objectPosition: 'center',
        ...(image.crestScale ? crestVars(image.crestScale) : null),
      }}
    />
  )
}
