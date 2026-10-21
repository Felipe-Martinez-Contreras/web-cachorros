import 'server-only'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { boardMembers, documents, mediaAssets } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual.

export async function listBoardAdmin() {
  const rows = await db
    .select({
      id: boardMembers.id,
      fullName: boardMembers.fullName,
      roleTitle: boardMembers.roleTitle,
      publicEmail: boardMembers.publicEmail,
      termStart: boardMembers.termStart,
      termEnd: boardMembers.termEnd,
      isCurrent: boardMembers.isCurrent,
      sortOrder: boardMembers.sortOrder,
      photoId: mediaAssets.id,
      photoVariants: mediaAssets.variants,
      photoAlt: mediaAssets.altText,
      photoMinors: mediaAssets.containsMinors,
    })
    .from(boardMembers)
    .leftJoin(mediaAssets, eq(mediaAssets.id, boardMembers.photoMediaId))
    .orderBy(desc(boardMembers.isCurrent), asc(boardMembers.sortOrder), asc(boardMembers.fullName))
  return rows.map(({ photoId, photoVariants, photoAlt, photoMinors, ...row }) => ({
    ...row,
    photo: photoId
      ? toMediaThumbDTO({
          id: photoId,
          variants: photoVariants,
          altText: photoAlt,
          containsMinors: photoMinors ?? false,
        })
      : (null as MediaThumbDTO | null),
  }))
}
export type BoardMemberAdmin = Awaited<ReturnType<typeof listBoardAdmin>>[number]

export async function getBoardMemberAdmin(id: string): Promise<BoardMemberAdmin | null> {
  return (await listBoardAdmin()).find((row) => row.id === id) ?? null
}

export async function listDocumentsAdmin() {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      category: documents.category,
      periodLabel: documents.periodLabel,
      documentDate: documents.documentDate,
      description: documents.description,
      isPublished: documents.isPublished,
      fileId: mediaAssets.id,
      fileName: mediaAssets.originalFilename,
      bytes: mediaAssets.bytes,
    })
    .from(documents)
    .innerJoin(mediaAssets, eq(mediaAssets.id, documents.fileMediaId))
    .orderBy(
      desc(sql`coalesce(${documents.documentDate}, ${documents.createdAt}::date)`),
      asc(documents.title),
    )
  return rows.map(({ fileId, fileName, ...row }) => ({
    ...row,
    // En el selector, el PDF ya guardado se muestra por su nombre de archivo.
    file: {
      id: fileId,
      thumb: null,
      alt: fileName ?? 'documento.pdf',
      containsMinors: false,
    } as MediaThumbDTO,
  }))
}
export type DocumentAdmin = Awaited<ReturnType<typeof listDocumentsAdmin>>[number]

export async function getDocumentAdmin(id: string): Promise<DocumentAdmin | null> {
  return (await listDocumentsAdmin()).find((row) => row.id === id) ?? null
}
