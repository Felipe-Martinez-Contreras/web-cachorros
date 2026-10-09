type SourceImage = { src: string; srcSet: string; width: number; height: number; alt: string }

export type OgImage = { url: string; width: number; height: number; alt: string }

const TARGET_WIDTH = 1200

/**
 * Imagen para `og:image` a partir de una imagen de la biblioteca: la variante más pequeña que alcanza
 * 1200 px de ancho (o la más grande que haya). La dirección queda relativa; `metadataBase` la hace absoluta.
 */
export function ogImageOf(image: SourceImage | null | undefined): OgImage | null {
  if (!image) return null
  const variants = image.srcSet
    .split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .flatMap(([url, descriptor]) => {
      const width = Number.parseInt(descriptor ?? '', 10)
      return url && Number.isFinite(width) ? [{ url, width }] : []
    })
    .sort((a, b) => a.width - b.width)
  const chosen = variants.find((variant) => variant.width >= TARGET_WIDTH) ?? variants.at(-1)
  if (!chosen) return { url: image.src, width: image.width, height: image.height, alt: image.alt }
  return {
    url: chosen.url,
    width: chosen.width,
    height: Math.round((chosen.width * image.height) / image.width),
    alt: image.alt,
  }
}
