import 'server-only'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { boardMembers, documents, mediaAssets } from '@/db/schema'
import { DOCUMENT_FILENAME } from '@/features/media/lib/upload-rules'
import { tags } from '@/lib/cache-tags'
import { toIsoDate } from '@/lib/format'
import { mediaUrl, toImageDTO } from '@/lib/images/dto'
import type { BoardMemberDTO, DocumentCategory, TransparencyDocumentDTO, TransparencyDTO } from './dto'

/** Integrantes vigentes de la directiva, en su orden (especificación 6.12). */
export async function getCurrentBoard(): Promise<BoardMemberDTO[]> {
  'use cache'
  cacheTag(tags.club(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: boardMembers.id,
      fullName: boardMembers.fullName,
      roleTitle: boardMembers.roleTitle,
      publicEmail: boardMembers.publicEmail,
      termStart: boardMembers.termStart,
      termEnd: boardMembers.termEnd,
      photo: {
        variants: mediaAssets.variants,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        lqip: mediaAssets.lqip,
        credit: mediaAssets.credit,
        focalX: mediaAssets.focalX,
        focalY: mediaAssets.focalY,
        containsMinors: mediaAssets.containsMinors,
      },
    })
    .from(boardMembers)
    .leftJoin(mediaAssets, eq(mediaAssets.id, boardMembers.photoMediaId))
    .where(eq(boardMembers.isCurrent, true))
    .orderBy(asc(boardMembers.sortOrder), asc(boardMembers.fullName))

  return rows.map(({ photo, ...row }) => ({
    ...row,
    photo: photo?.containsMinors ? null : toImageDTO(photo),
  }))
}

// Año del documento: el de su fecha o, si no tiene, el de su publicación (en Chile).
const documentYear = sql<
  number | null
>`extract(year from coalesce(${documents.documentDate}, (${documents.publishedAt} at time zone 'America/Santiago')::date))::int`

/**
 * Documentos publicados para `/club/transparencia`, filtrados por categoría y año (formulario GET), con
 * las categorías y los años que existen para armar los filtros.
 */
export async function getTransparency(filters: {
  category: DocumentCategory | null
  year: number | null
}): Promise<TransparencyDTO> {
  'use cache'
  cacheTag(tags.club(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      category: documents.category,
      periodLabel: documents.periodLabel,
      documentDate: documents.documentDate,
      publishedAt: documents.publishedAt,
      description: documents.description,
      year: documentYear,
      storageKey: mediaAssets.storageKey,
      bytes: mediaAssets.bytes,
    })
    .from(documents)
    .innerJoin(mediaAssets, eq(mediaAssets.id, documents.fileMediaId))
    .where(and(eq(documents.isPublished, true), eq(mediaAssets.mime, 'application/pdf')))
    .orderBy(
      desc(sql`coalesce(${documents.documentDate}, ${documents.publishedAt}::date)`),
      asc(documents.title),
    )

  const all: TransparencyDocumentDTO[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    periodLabel: row.periodLabel,
    date: row.documentDate ?? (row.publishedAt ? toIsoDate(row.publishedAt) : null),
    year: row.year,
    description: row.description,
    url: mediaUrl(`${row.storageKey}/${DOCUMENT_FILENAME}`),
    bytes: row.bytes,
  }))
  return {
    documents: all.filter(
      (document) =>
        (!filters.category || document.category === filters.category) &&
        (!filters.year || document.year === filters.year),
    ),
    categories: [...new Set(all.map((document) => document.category))],
    years: [
      ...new Set(all.map((document) => document.year).filter((year): year is number => year !== null)),
    ].sort((a, b) => b - a),
  }
}
