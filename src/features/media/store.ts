import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/db/client'
import { mediaAssets } from '@/db/schema'
import { audit } from '@/lib/audit'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { type MediaThumbDTO, toMediaThumbDTO } from './dto'
import { removeMediaFiles, uploadsDir } from './files'
import { createSerialQueue, DOCUMENT_FILENAME, isPdf, sniffImageFormat } from './lib/upload-rules'

/** Un solo archivo a la vez en todo el proceso: sharp no compite consigo mismo por la memoria de la VM. */
const enqueue = createSerialQueue()

export class UploadError extends Error {
  readonly status: 400 | 413 | 415

  constructor(status: 400 | 413 | 415, message: string) {
    super(message)
    this.name = 'UploadError'
    this.status = status
  }
}

type StoreInput = {
  bytes: Buffer
  filename: string | null
  altText: string
  credit: string | null
  kind: 'photo' | 'logo'
  userId: string
}

type StoreDocumentInput = { bytes: Buffer; filename: string | null; altText: string | null; userId: string }

/**
 * Guarda un PDF de transparencia (especificación 6.12 y 9.5): solo si su firma real es la de un PDF. No se
 * re-codifica; se sirve con `Content-Security-Policy: sandbox` y `nosniff`, sin ejecutar nada.
 */
export async function storeUploadedDocument(input: StoreDocumentInput): Promise<MediaThumbDTO> {
  const maxBytes = (env.MAX_UPLOAD_MB ?? 12) * 1024 * 1024
  if (input.bytes.byteLength === 0) throw new UploadError(400, 'El archivo llegó vacío. Vuelve a elegirlo.')
  if (input.bytes.byteLength > maxBytes) {
    throw new UploadError(413, `El PDF pesa más de ${env.MAX_UPLOAD_MB ?? 12} MB. Elige uno más liviano.`)
  }
  if (!(await isPdf(input.bytes))) {
    throw new UploadError(415, 'Ese archivo no es un PDF. Los documentos se suben solo en PDF.')
  }

  const storageKey = randomUUID()
  const dir = path.join(/* turbopackIgnore: true */ uploadsDir(), storageKey)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, DOCUMENT_FILENAME), input.bytes)
  const filename = input.filename?.slice(0, 200) ?? null
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(mediaAssets)
        .values({
          kind: 'documento',
          storageKey,
          originalFilename: filename,
          mime: 'application/pdf',
          bytes: input.bytes.byteLength,
          altText: input.altText,
          uploadedBy: input.userId,
        })
        .returning({ id: mediaAssets.id })
      if (!row) throw new Error('La biblioteca no devolvió el archivo creado.')
      await audit(tx, { id: input.userId }, 'media.create', {
        entityType: 'media_asset',
        entityId: row.id,
        summary: 'Subió un documento PDF',
        meta: { bytes: input.bytes.byteLength },
      })
      return { id: row.id, thumb: null, alt: filename ?? 'documento.pdf', containsMinors: false }
    })
  } catch (error) {
    await removeMediaFiles(storageKey)
    throw error
  }
}

/**
 * Valida la firma real del archivo, lo re-codifica (sin EXIF ni GPS), genera las variantes y lo registra
 * en la biblioteca (especificación 2.7 y 9.5). Si falla el registro, no quedan archivos huérfanos.
 */
export async function storeUploadedImage(input: StoreInput): Promise<MediaThumbDTO> {
  const maxBytes = (env.MAX_UPLOAD_MB ?? 12) * 1024 * 1024
  if (input.bytes.byteLength === 0) throw new UploadError(400, 'El archivo llegó vacío. Vuelve a elegirlo.')
  if (input.bytes.byteLength > maxBytes) {
    throw new UploadError(413, `La imagen pesa más de ${env.MAX_UPLOAD_MB ?? 12} MB. Elige una más liviana.`)
  }
  const format = await sniffImageFormat(input.bytes)
  if (!format) {
    throw new UploadError(415, 'Ese archivo no es una imagen que podamos usar. Sube un JPG, PNG, WebP o SVG.')
  }

  return enqueue(async () => {
    // sharp se carga recién al procesar una imagen: subir un PDF no lo necesita.
    const { processImage } = await import('@/lib/images/process')
    let processed: Awaited<ReturnType<typeof processImage>>
    try {
      processed = await processImage(input.bytes, { uploadsDir: uploadsDir(), kind: input.kind })
    } catch (error) {
      // Casi siempre es una imagen dañada, pero también puede ser el disco o los permisos de la carpeta:
      // la causa queda en el log para poder distinguirlo.
      logger.warn(
        { err: error, format, bytes: input.bytes.byteLength },
        'no se pudo procesar una imagen subida',
      )
      throw new UploadError(400, 'No pudimos leer la imagen. Puede estar dañada: prueba con otra.')
    }
    try {
      return await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(mediaAssets)
          .values({
            kind: 'imagen',
            storageKey: processed.storageKey,
            originalFilename: input.filename?.slice(0, 200) ?? null,
            mime: processed.mime,
            bytes: processed.bytes,
            width: processed.width,
            height: processed.height,
            variants: processed.variants,
            lqip: processed.lqip,
            altText: input.altText,
            credit: input.credit,
            uploadedBy: input.userId,
          })
          .returning({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            altText: mediaAssets.altText,
            containsMinors: mediaAssets.containsMinors,
          })
        if (!row) throw new Error('La biblioteca no devolvió el archivo creado.')
        await audit(tx, { id: input.userId }, 'media.create', {
          entityType: 'media_asset',
          entityId: row.id,
          summary: `Subió la imagen «${input.altText.slice(0, 80)}»`,
          meta: { width: processed.width, height: processed.height, format },
        })
        return toMediaThumbDTO(row)
      })
    } catch (error) {
      await removeMediaFiles(processed.storageKey)
      throw error
    }
  })
}
