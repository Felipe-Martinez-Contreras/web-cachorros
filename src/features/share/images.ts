import 'server-only'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'
import { runHeavy } from '@/lib/heavy-queue'
import { type FocalPoint, focalCrop } from '@/lib/images/focal-crop'
import { logger } from '@/lib/logger'
import { cardCrestImage } from './crest-card'
import type { CardCrest, MatchdayPhotoSource, MatchdayTopLine, ShareCardData } from './dto'
import { MATCHDAY_CROP_RATIO, type ShareRequest, shareCachePath } from './lib/cards'
import { loadShareCard, readMediaFile } from './queries'

// Tarjetas generadas una vez por versión (especificación 2.8): se guardan en `SHARE_CACHE_DIR` y se
// sirven con URL versionada. La generación pasa por la cola de 1 que comparte con sharp.

export function shareCacheDir(): string {
  // La carpeta se decide en runtime (variable de entorno): el comentario evita que el build la rastree.
  return path.resolve(/* turbopackIgnore: true */ env.SHARE_CACHE_DIR ?? './data/cache/share')
}

export type ShareImage = { bytes: Buffer; fromCache: boolean }

/**
 * Imagen de una tarjeta en su versión vigente: desde el disco si ya existe; si no, se dibuja y se guarda, y
 * se borran las versiones anteriores del mismo formato. `null` si sus datos ya no existen.
 *
 * Primero se leen los datos (BD y archivos) y recién después se entra a la cola de 1 para procesar (sharp y
 * Satori): ninguna consulta corre dentro de la cola ni retiene una conexión mientras espera su turno. Con
 * `signal`, si quien la pidió se fue antes de su turno, no se dibuja (`QueueAbortedError`).
 */
export async function getShareImage(
  request: ShareRequest,
  version: string,
  signal?: AbortSignal,
): Promise<ShareImage | null> {
  const file = path.join(/* turbopackIgnore: true */ shareCacheDir(), shareCachePath(request, version))
  const cached = await readIfExists(file)
  if (cached) return { bytes: cached, fromCache: true }

  const data = await loadShareCard(request)
  if (!data) return null

  return runHeavy(
    async () => {
      // Otra petición pudo generarla mientras esta esperaba su turno.
      const ready = await readIfExists(file)
      if (ready) return { bytes: ready, fromCache: true }

      const started = performance.now()
      await prepareCardImages(data)
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
    },
    { signal },
  )
}

/**
 * Lo que la tarjeta necesita procesar con sharp, ya con los datos leídos: las fotos del matchday, el logo de
 * la línea superior, los escudos sin disco y la foto de la noticia. Corre dentro de la cola.
 */
export async function prepareCardImages(data: ShareCardData): Promise<void> {
  if ((data.kind === 'match' || data.kind === 'jornada') && data.matchday) {
    data.matchday.photos = await Promise.all(
      data.matchday.photoSources.map((source) => matchdayPhoto(source)),
    )
    await fillTopLineLogo(data.matchday.topLine)
  }
  if (data.kind === 'weekend') await fillTopLineLogo(data.topLine)
  if (data.kind === 'news' && data.photoFile) data.photo = await newsPhoto(data.photoFile)
  const crests = cardCrests(data)
  // El mismo escudo (el del club, un rival repetido) se trata una sola vez.
  const treated = new Map<string, CardCrest['bare']>()
  for (const crest of crests) {
    if (!crest.bareSource) continue
    const key = `${crest.bareSource.style}:${crest.src}`
    if (!treated.has(key)) {
      const { png, style } = crest.bareSource
      treated.set(
        key,
        await cardCrestImage(png, { style }).catch((error: unknown) => {
          logger.warn({ err: error }, 'no se pudo tratar un escudo para la tarjeta')
          return null
        }),
      )
    }
    crest.bare = treated.get(key) ?? null
    crest.bareSource = null
  }
}

/** Todos los escudos de una tarjeta. */
function cardCrests(data: ShareCardData): CardCrest[] {
  const teams: (CardCrest | null)[] = []
  if (data.kind === 'match' || data.kind === 'jornada')
    teams.push(data.match.home.crest, data.match.away.crest)
  if (data.kind === 'weekend') {
    teams.push(data.clubCrest)
    for (const match of data.matches) teams.push(match.home.crest, match.away.crest)
  }
  if (data.kind === 'news') teams.push(data.clubCrest)
  return teams.filter((crest): crest is CardCrest => crest !== null)
}

/** Foto de la noticia reducida a JPEG de 1200 px (Satori no lee WebP y así pesa poco en memoria). */
async function newsPhoto(file: string): Promise<string | null> {
  const bytes = await readMediaFile(file)
  if (!bytes) return null
  const { default: sharp } = await import('sharp')
  const jpeg = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .resize({ width: 1200, height: 900, fit: 'cover', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
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

/** Proporción del recorte (ancho / alto) y su alto: alcanza para el panel más alto (9:16) sin pesar de más. */
const PANEL_RATIO = MATCHDAY_CROP_RATIO
const PANEL_HEIGHT = 1200
/** Contraste del blanco y negro (alrededor del gris medio): los grises bajos pasan a negro profundo. */
const PANEL_CONTRAST = 1.25

/**
 * Foto de un panel como *data URI* JPEG: recortada a la proporción del panel alrededor de su punto focal
 * (con su zoom) y en blanco y negro con contraste (Satori no aplica filtros). `null` si el archivo no está.
 */
export async function matchdayPhoto(source: MatchdayPhotoSource | null): Promise<string | null> {
  if (!source) return null
  const bytes = await readMediaFile(source.file)
  return bytes ? treatMatchdayPhoto(bytes, source) : null
}

/** El recorte y el tratamiento de un panel a partir de los bytes de la foto (también lo usa `share-preview`). */
export async function treatMatchdayPhoto(bytes: Buffer, focal: FocalPoint): Promise<string | null> {
  const { default: sharp } = await import('sharp')
  // Primero se endereza según su EXIF, para que el recorte use las medidas reales.
  const { data, info } = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .rotate()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  if (width === 0 || height === 0) return null
  const jpeg = await sharp(data)
    .extract(focalCrop(width, height, PANEL_RATIO, focal))
    .resize({ height: PANEL_HEIGHT, withoutEnlargement: true })
    .grayscale()
    // Estira el rango (sin los extremos sueltos) y sube el contraste: negros profundos, blancos limpios.
    .normalise({ lower: 1, upper: 99 })
    .linear(PANEL_CONTRAST, -128 * (PANEL_CONTRAST - 1))
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

async function fillTopLineLogo(line: MatchdayTopLine | null): Promise<void> {
  if (line?.kind !== 'logo') return
  const bytes = await readMediaFile(line.file)
  line.src = bytes ? await whiteLogo(bytes) : null
}

/** Alto del logo de la línea superior: el doble de lo que ocupa en la historia (la más alta). */
const LOGO_HEIGHT = 160

/**
 * Logo de la línea superior en blanco, como *data URI* PNG: su silueta (lo opaco). Si no tiene transparencia
 * (un logo sobre fondo blanco), lo oscuro pasa a blanco y lo claro desaparece.
 */
export async function whiteLogo(bytes: Buffer): Promise<string | null> {
  const { default: sharp } = await import('sharp')
  const { data, info } = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .rotate()
    .trim()
    .resize({ height: LOGO_HEIGHT, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  if (width === 0 || height === 0) return null
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3] ?? 0
  const opaque = [
    alphaAt(0, 0),
    alphaAt(width - 1, 0),
    alphaAt(0, height - 1),
    alphaAt(width - 1, height - 1),
  ].every((alpha) => alpha >= 240)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0
    const light = (0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)) / 255
    // Sin transparencia: lo que no es casi blanco pasa a blanco pleno (con el borde suavizado).
    data[i + 3] = opaque ? Math.round(alpha * Math.min(1, Math.max(0, (0.92 - light) / 0.25))) : alpha
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
  }
  const png = await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}
