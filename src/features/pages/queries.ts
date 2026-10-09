import 'server-only'
import { eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { pageBlocks } from '@/db/schema'
import type { RichTextDoc } from '@/db/schema/_columns'
import { loadRichTextImages } from '@/features/media/rich-text-images'
import { tags } from '@/lib/cache-tags'
import type { ImageDTO } from '@/lib/images/dto'
import { isRichTextEmpty } from '@/lib/rich-text/document'
import { PAGE_BLOCKS, type PageBlockKey } from './blocks'

export type PageBlockDTO = {
  title: string | null
  body: RichTextDoc
  images: Record<string, ImageDTO>
}

/** Texto público de una página; `null` si todavía no se escribe. Se invalida con el tag `pages`. */
export async function getPageBlock(key: PageBlockKey): Promise<PageBlockDTO | null> {
  'use cache'
  cacheTag(tags.pages(), tags.media())
  cacheLife('hours')

  const [row] = await db
    .select({ title: pageBlocks.title, body: pageBlocks.body })
    .from(pageBlocks)
    .where(eq(pageBlocks.key, key))
    .limit(1)
  if (!row?.body || isRichTextEmpty(row.body)) return null
  return { title: row.title, body: row.body, images: await loadRichTextImages(row.body) }
}

// Lecturas del panel: sin caché.

export async function listPageBlocksAdmin() {
  const rows = await db
    .select({
      key: pageBlocks.key,
      title: pageBlocks.title,
      body: pageBlocks.body,
      updatedAt: pageBlocks.updatedAt,
    })
    .from(pageBlocks)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  return (Object.keys(PAGE_BLOCKS) as PageBlockKey[]).map((key) => {
    const row = byKey.get(key)
    return {
      key,
      ...PAGE_BLOCKS[key],
      isEmpty: !row?.body || isRichTextEmpty(row.body),
      // El seed deja marcadores `[COMPLETAR: …]` donde falta el texto real del club.
      isPending: JSON.stringify(row?.body ?? '').includes('[COMPLETAR'),
      updatedAt: row?.updatedAt ?? null,
    }
  })
}

export async function getPageBlockAdmin(key: PageBlockKey) {
  const [row] = await db
    .select({ title: pageBlocks.title, body: pageBlocks.body })
    .from(pageBlocks)
    .where(eq(pageBlocks.key, key))
    .limit(1)
  return { key, ...PAGE_BLOCKS[key], title: row?.title ?? null, body: row?.body ?? null }
}
