import 'server-only'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'
import { runHeavy } from '@/lib/heavy-queue'
import { logger } from '@/lib/logger'
import type { MatchdayPhotoSource } from './dto'
import { type ShareRequest, shareCachePath } from './lib/cards'
import { loadShareCard, readMediaFile } from './queries'

// Tarjetas generadas una vez por versión (especificación 2.8): se guardan en `SHARE_CACHE_DIR` y se
// sirven con URL versionada. La generación pasa por la cola de 1 que comparte con sharp.

export function shareCacheDir(): string {
  // La carpeta se decide en runtime (variable de entorno): el comentario evita que el build la rastree.
  return path.resolve(/* turbopackIgnore: true */ env.SHARE_CACHE_DIR ?? './data/cache/share')
}

export type ShareImage = { bytes: Buffer; fromCache: boolean }

/**
 * Imagen de una tarjeta en su versión vigente: desde el disco si ya existe; si no, se dibuja (en la cola),
 * se guarda y se borran las versiones anteriores del mismo formato. `null` si sus datos ya no existen.
 */
export async function getShareImage(request: ShareRequest, version: string): Promise<ShareImage | null> {
  const file = path.join(/* turbopackIgnore: true */ shareCacheDir(), shareCachePath(request, version))
  const cached = await readIfExists(file)
  if (cached) return { bytes: cached, fromCache: true }

  return runHeavy(async () => {
    // Otra petición pudo generarla mientras esta esperaba su turno.
    const ready = await readIfExists(file)
    if (ready) return { bytes: ready, fromCache: true }

    const data = await loadShareCard(request)
    if (!data) return null
    if ((data.kind === 'match' || data.kind === 'jornada') && data.matchday) {
      data.matchday.photos = await Promise.all(data.matchday.photoSources.map(matchdayPhoto))
    }
    const started = performance.now()
    const { renderShareCard } = await import('./render')
    const bytes = await renderShareCard(data, request.format)
    const ms = Math.round(performance.now() - started)
    logger.info(
      { template: request.template, format: request.format, ms, bytes: bytes.byteLength },
      'tarjeta generada',
    )

    await mkdir(path.dirname(file), { recursive: true })
    // Se escribe aparte y se renombra: una lectura simultánea nunca ve un archivo a medias.
    const temporary = `${file}.${process.pid}.tmp`
    await writeFile(temporary, bytes)
    await rename(temporary, file)
    await removeOldVersions(request, file)
    return { bytes, fromCache: false }
  })
}

async function readIfExists(file: string): Promise<Buffer | null> {
  try {
    return await readFile(file)
  } catch {
    return null
  }
}

/** Borra las versiones anteriores de la misma tarjeta y formato (el disco de la VM es chico). */
async function removeOldVersions(request: ShareRequest, current: string): Promise<void> {
  const dir = path.dirname(current)
  const prefix = `${request.id}-v`
  const suffix = `-${request.format}.`
  try {
    const names = await readdir(dir)
    await Promise.all(
      names
        .filter(
          (name) => name.startsWith(prefix) && name.includes(suffix) && path.join(dir, name) !== current,
        )
        .map((name) => rm(path.join(dir, name), { force: true })),
    )
  } catch (error) {
    logger.warn({ err: error }, 'no se pudieron borrar tarjetas antiguas')
  }
}

/** Tratamiento de cada panel del matchday, como la plantilla: blanco y negro, color y color (velo en el render). */
const PANEL_TREATMENT = ['gris', 'color', 'color'] as const
/** Proporción de los paneles (ancho / alto) y su tamaño: alcanza para el más alto (9:16) sin pesar de más. */
const PANEL_RATIO = 0.4
const PANEL_HEIGHT = 1200

/**
 * Foto de un panel como *data URI* JPEG: recortada a la proporción del panel alrededor de su punto focal y,
 * en el primero, en escala de grises (Satori no aplica filtros). `null` si el archivo no está.
 */
export async function matchdayPhoto(
  source: MatchdayPhotoSource | null,
  index: number,
): Promise<string | null> {
  if (!source) return null
  const bytes = await readMediaFile(source.file)
  return bytes ? treatMatchdayPhoto(bytes, source, index) : null
}

/** El recorte y el tratamiento de un panel a partir de los bytes de la foto (también lo usa `share-preview`). */
export async function treatMatchdayPhoto(
  bytes: Buffer,
  focal: { focalX: number; focalY: number },
  index: number,
): Promise<string | null> {
  const { default: sharp } = await import('sharp')
  // Primero se endereza según su EXIF, para que el recorte use las medidas reales.
  const { data, info } = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .rotate()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  if (width === 0 || height === 0) return null
  // Recorte de la proporción del panel, centrado en el punto focal y sin salirse de la foto.
  const cropWidth = Math.min(width, Math.round(height * PANEL_RATIO))
  const cropHeight = Math.min(height, Math.round(cropWidth / PANEL_RATIO))
  const left = Math.round(Math.min(Math.max(focal.focalX * width - cropWidth / 2, 0), width - cropWidth))
  const top = Math.round(Math.min(Math.max(focal.focalY * height - cropHeight / 2, 0), height - cropHeight))
  let pipeline = sharp(data)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ height: PANEL_HEIGHT, withoutEnlargement: true })
  if (PANEL_TREATMENT[index] === 'gris') pipeline = pipeline.grayscale()
  const jpeg = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
