import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { MediaVariants } from '@/db/schema/media'

// Presupuesto de memoria de la VM (especificación 2.7): un hilo y sin caché interna.
sharp.concurrency(1)
sharp.cache(false)

/** Anchos fijos de las variantes WebP de fotos. */
export const PHOTO_WIDTHS = [320, 480, 768, 1024, 1440, 1920] as const
/** Escudos y logos se muestran pequeños: se agregan anchos menores. */
export const LOGO_WIDTHS = [96, 192, 320, 480] as const

const MAX_MASTER_WIDTH = 2560
const MAX_LOGO_WIDTH = 1024
const MAX_INPUT_PIXELS = 50_000_000
const LQIP_WIDTH = 24
/** Densidades de rasterizado de SVG, de mayor a menor: se usa la primera que no exceda el tamaño útil. */
const SVG_DENSITIES = [300, 200, 150, 110, 72]

export type ProcessImageOptions = {
  /** Carpeta raíz de las subidas (`UPLOADS_DIR`). */
  uploadsDir: string
  /** `logo`: escudos y logos, con transparencia y PNG de 512 px para Satori. */
  kind?: 'photo' | 'logo'
  /** Carpeta del archivo dentro de `uploadsDir`. Por defecto, un UUID nuevo; el seed la fija para ser idempotente. */
  storageKey?: string
}

export type ProcessedImage = {
  storageKey: string
  mime: string
  bytes: number
  width: number
  height: number
  variants: MediaVariants
  lqip: string
}

/**
 * Procesa una imagen una sola vez: la re-codifica (lo que elimina EXIF/GPS y cualquier carga oculta),
 * guarda el *master*, las variantes WebP y un LQIP en base64. Los SVG se rasterizan: nunca se sirven
 * SVG de usuarios.
 */
export async function processImage(input: Buffer, options: ProcessImageOptions): Promise<ProcessedImage> {
  const isLogo = options.kind === 'logo'
  const storageKey = options.storageKey ?? randomUUID()
  if (!/^[a-z0-9][a-z0-9-]*$/.test(storageKey)) throw new Error('La clave de almacenamiento no es válida.')
  const dir = path.join(options.uploadsDir, storageKey)

  const density = isSvg(input) ? await svgDensity(input) : undefined
  // Se decodifica una sola vez a píxeles crudos: las salidas no acumulan pérdidas de re-compresión.
  const source = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, density })
    // Aplica la orientación EXIF antes de descartar los metadatos.
    .rotate()
    .resize({ width: isLogo ? MAX_LOGO_WIDTH : MAX_MASTER_WIDTH, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = source.info
  const pixels = () => sharp(source.data, { raw: { width, height, channels } })
  const keepAlpha = isLogo || channels === 4

  const master = keepAlpha
    ? await pixels().png({ compressionLevel: 9 }).toBuffer()
    : await pixels().jpeg({ quality: 85, mozjpeg: true }).toBuffer()
  const masterName = keepAlpha ? 'master.png' : 'master.jpg'

  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, masterName), master)

  const variants: MediaVariants = { master: `${storageKey}/${masterName}`, webp: [] }
  for (const target of variantWidths(isLogo ? LOGO_WIDTHS : PHOTO_WIDTHS, width)) {
    const variant = await pixels()
      .resize({ width: target })
      .webp({ quality: 78, alphaQuality: 90 })
      .toBuffer({ resolveWithObject: true })
    const name = `w${target}.webp`
    await writeFile(path.join(dir, name), variant.data)
    variants.webp.push({
      width: variant.info.width,
      height: variant.info.height,
      path: `${storageKey}/${name}`,
    })
  }

  if (isLogo) {
    const png = await pixels()
      .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    await writeFile(path.join(dir, 'png512.png'), png)
    variants.png512 = `${storageKey}/png512.png`
  }

  const lqip = await pixels().resize({ width: LQIP_WIDTH }).webp({ quality: 40 }).toBuffer()

  return {
    storageKey,
    mime: keepAlpha ? 'image/png' : 'image/jpeg',
    bytes: master.byteLength,
    width,
    height,
    variants,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  }
}

/** Anchos a generar: los fijos que no superan al original y, si queda espacio, el propio ancho original. */
export function variantWidths(fixed: readonly number[], sourceWidth: number): number[] {
  const widths = fixed.filter((width) => width <= sourceWidth)
  const largestFixed = fixed.at(-1) ?? 0
  if (widths.length === 0 || (sourceWidth < largestFixed && !widths.includes(sourceWidth))) {
    widths.push(sourceWidth)
  }
  return widths
}

/**
 * Los SVG no tienen tamaño en píxeles: se rasterizan a la mayor densidad que no supere el doble del ancho
 * máximo (un SVG medido en milímetros puede resultar enorme a 300 ppp).
 */
async function svgDensity(input: Buffer): Promise<number> {
  for (const density of SVG_DENSITIES) {
    const metadata = await sharp(input, { density, limitInputPixels: MAX_INPUT_PIXELS })
      .metadata()
      .catch(() => null)
    if (metadata?.width && metadata.width <= MAX_MASTER_WIDTH * 2) return density
  }
  return SVG_DENSITIES.at(-1) ?? 72
}

export function isSvg(input: Buffer): boolean {
  const head = input.subarray(0, 1024).toString('utf8').trimStart().toLowerCase()
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))
}
