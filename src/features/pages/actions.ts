'use server'

import { pageBlocks } from '@/db/schema'
import { assertRichTextMedia } from '@/features/media/rich-text-images'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { mutate, Rejection } from '@/lib/entity-action'
import { isPageBlockKey, PAGE_BLOCKS } from './blocks'
import { pageBlockSchema } from './schemas'

/** Guarda el texto de una página. Solo existen las claves de `PAGE_BLOCKS`. */
export async function guardarTextoDePagina(
  key: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'page_block.update',
    permission: 'pages:write',
    entityType: 'page_block',
    schema: pageBlockSchema,
    input,
    tags: [tags.pages()],
    write: async (tx, data) => {
      if (!isPageBlockKey(key)) throw new Rejection('Ese texto no existe.')
      await assertRichTextMedia(tx, data.body, 'body')
      const [row] = await tx
        .insert(pageBlocks)
        .values({ key, title: data.title, body: data.body })
        .onConflictDoUpdate({
          target: pageBlocks.key,
          set: { title: data.title, body: data.body, updatedAt: new Date() },
        })
        .returning({ id: pageBlocks.id })
      if (!row) throw new Error('El texto no se guardó.')
      return { id: row.id, summary: `Editó el texto «${PAGE_BLOCKS[key].label}»`, meta: { key } }
    },
  })
}
