'use server'

import { and, count, eq, ne } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { boardMembers, documents, mediaAssets } from '@/db/schema'
import { removeMediaFiles } from '@/features/media/files'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod'
import { boardMemberSchema, documentSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const nothing = z.unknown()

// ── Directiva ───────────────────────────────────────────────────────────────────────────────────

export async function crearIntegrante(input: unknown): Result {
  return mutate({
    action: 'board_member.create',
    permission: 'club:write',
    entityType: 'board_member',
    schema: boardMemberSchema,
    input,
    tags: [tags.club()],
    write: async (tx, data) => {
      await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
      const [row] = await tx.insert(boardMembers).values(data).returning({ id: boardMembers.id })
      if (!row) throw new Error('El integrante no se creó.')
      return { id: row.id, summary: `Agregó a la directiva el cargo ${data.roleTitle}` }
    },
  })
}

export async function actualizarIntegrante(id: string, input: unknown): Result {
  return mutate({
    action: 'board_member.update',
    permission: 'club:write',
    entityType: 'board_member',
    schema: boardMemberSchema,
    input,
    tags: [tags.club()],
    write: async (tx, data) => {
      const memberId = assertId(id, 'No encontramos a ese integrante.')
      await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
      const [row] = await tx
        .update(boardMembers)
        .set(data)
        .where(eq(boardMembers.id, memberId))
        .returning({ id: boardMembers.id })
      if (!row) throw new Rejection('No encontramos a ese integrante. Puede que lo hayan eliminado.')
      return {
        id: memberId,
        summary: `Editó el cargo ${data.roleTitle} de la directiva`,
        meta: { isCurrent: data.isCurrent },
      }
    },
  })
}

export async function eliminarIntegrante(id: string): Result {
  return mutate({
    action: 'board_member.delete',
    permission: 'club:write',
    entityType: 'board_member',
    schema: nothing,
    input: null,
    tags: [tags.club()],
    write: async (tx) => {
      const memberId = assertId(id, 'No encontramos a ese integrante.')
      const [row] = await tx
        .delete(boardMembers)
        .where(eq(boardMembers.id, memberId))
        .returning({ roleTitle: boardMembers.roleTitle })
      if (!row) throw new Rejection('No encontramos a ese integrante. Puede que ya lo hayan eliminado.')
      return { id: memberId, summary: `Quitó de la directiva el cargo ${row.roleTitle}` }
    },
  })
}

// ── Documentos ──────────────────────────────────────────────────────────────────────────────────

/** El archivo de un documento tiene que ser un PDF de la biblioteca (las imágenes no sirven). */
async function assertDocumentFile(tx: Tx, mediaId: string): Promise<void> {
  const [media] = await tx
    .select({ kind: mediaAssets.kind, mime: mediaAssets.mime })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
  if (!media) throw new Rejection('Ese PDF ya no está en la biblioteca. Súbelo de nuevo.', 'fileMediaId')
  if (media.kind !== 'documento' || media.mime !== 'application/pdf') {
    throw new Rejection('El archivo de un documento tiene que ser un PDF.', 'fileMediaId')
  }
}

/**
 * Un PDF que ya no usa ningún documento se borra de la biblioteca (la biblioteca del panel solo muestra
 * imágenes: quedaría huérfano). Devuelve su carpeta, que se borra después de confirmar la transacción.
 */
async function dropUnusedFile(tx: Tx, mediaId: string, exceptDocumentId?: string): Promise<string | null> {
  const [usage] = await tx
    .select({ n: count() })
    .from(documents)
    .where(
      and(
        eq(documents.fileMediaId, mediaId),
        exceptDocumentId ? ne(documents.id, exceptDocumentId) : undefined,
      ),
    )
  if ((usage?.n ?? 0) > 0) return null
  const [row] = await tx
    .delete(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.kind, 'documento')))
    .returning({ storageKey: mediaAssets.storageKey })
  return row?.storageKey ?? null
}

async function removeFiles(storageKey: string | null) {
  if (!storageKey) return
  // Si falla, queda basura en el disco pero no datos rotos.
  await removeMediaFiles(storageKey).catch((error: unknown) => {
    logger.error({ err: error, storageKey }, 'no se pudo borrar el PDF de un documento')
  })
}

export async function crearDocumento(input: unknown): Result {
  return mutate({
    action: 'document.create',
    permission: 'club:write',
    entityType: 'document',
    schema: documentSchema,
    input,
    tags: [tags.club()],
    write: async (tx, data) => {
      await assertDocumentFile(tx, data.fileMediaId)
      const [row] = await tx
        .insert(documents)
        .values({ ...data, publishedAt: data.isPublished ? new Date() : null })
        .returning({ id: documents.id })
      if (!row) throw new Error('El documento no se creó.')
      return {
        id: row.id,
        summary: `Agregó el documento ${data.title}`,
        meta: { category: data.category, isPublished: data.isPublished },
      }
    },
  })
}

export async function actualizarDocumento(id: string, input: unknown): Result {
  let replaced: string | null = null
  const result = await mutate({
    action: 'document.update',
    permission: 'club:write',
    entityType: 'document',
    schema: documentSchema,
    input,
    tags: [tags.club()],
    write: async (tx, data) => {
      const documentId = assertId(id, 'No encontramos ese documento.')
      await assertDocumentFile(tx, data.fileMediaId)
      const [current] = await tx
        .select({ publishedAt: documents.publishedAt, fileMediaId: documents.fileMediaId })
        .from(documents)
        .where(eq(documents.id, documentId))
        .for('update')
      if (!current) throw new Rejection('No encontramos ese documento. Puede que lo hayan eliminado.')
      // La fecha de publicación es la primera vez que se publicó: no cambia al editarlo.
      const publishedAt = data.isPublished ? (current.publishedAt ?? new Date()) : current.publishedAt
      await tx
        .update(documents)
        .set({ ...data, publishedAt })
        .where(eq(documents.id, documentId))
      // Si se subió otro PDF, el anterior ya no sirve.
      if (current.fileMediaId !== data.fileMediaId) replaced = await dropUnusedFile(tx, current.fileMediaId)
      return {
        id: documentId,
        summary: `Editó el documento ${data.title}`,
        meta: { category: data.category, isPublished: data.isPublished },
      }
    },
  })
  if (result.ok) await removeFiles(replaced)
  return result
}

export async function eliminarDocumento(id: string): Result {
  let removed: string | null = null
  const result = await mutate({
    action: 'document.delete',
    permission: 'club:write',
    entityType: 'document',
    schema: nothing,
    input: null,
    tags: [tags.club()],
    write: async (tx) => {
      const documentId = assertId(id, 'No encontramos ese documento.')
      const [row] = await tx
        .delete(documents)
        .where(eq(documents.id, documentId))
        .returning({ title: documents.title, fileMediaId: documents.fileMediaId })
      if (!row) throw new Rejection('No encontramos ese documento. Puede que ya lo hayan eliminado.')
      removed = await dropUnusedFile(tx, row.fileMediaId)
      return { id: documentId, summary: `Eliminó el documento ${row.title}` }
    },
  })
  if (result.ok) await removeFiles(removed)
  return result
}
