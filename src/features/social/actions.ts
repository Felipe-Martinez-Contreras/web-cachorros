'use server'

import { eq } from 'drizzle-orm'
import { socialPosts } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { z } from '@/lib/zod'
import { detectSocialPost } from './lib/feed'
import { socialPostSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const TAGS = [tags.social()]
const nothing = z.unknown()

/** La red sale del enlace y el enlace se guarda normalizado; un marcador conserva la red elegida. */
function postValues(data: z.output<typeof socialPostSchema>) {
  const detected = detectSocialPost(data.permalink)
  if (!detected) return { ...data, embedEnabled: false }
  return { ...data, permalink: detected.url, platform: detected.platform }
}

export async function crearPublicacion(input: unknown): Result {
  return mutate({
    action: 'social.create',
    permission: 'social:write',
    entityType: 'social_post',
    schema: socialPostSchema,
    input,
    tags: TAGS,
    write: async (tx, data) => {
      await assertPublishableMedia(tx, data.imageMediaId, 'imageMediaId')
      const values = postValues(data)
      const [row] = await tx.insert(socialPosts).values(values).returning({ id: socialPosts.id })
      if (!row) throw new Error('La publicación no se creó.')
      return { id: row.id, summary: `Agregó una publicación de ${values.platform}`, meta: values }
    },
  })
}

export async function actualizarPublicacion(id: string, input: unknown): Result {
  return mutate({
    action: 'social.update',
    permission: 'social:write',
    entityType: 'social_post',
    schema: socialPostSchema,
    input,
    tags: TAGS,
    write: async (tx, data) => {
      const postId = assertId(id, 'No encontramos esa publicación.')
      await assertPublishableMedia(tx, data.imageMediaId, 'imageMediaId')
      const values = postValues(data)
      const [row] = await tx
        .update(socialPosts)
        .set(values)
        .where(eq(socialPosts.id, postId))
        .returning({ id: socialPosts.id })
      if (!row) throw new Rejection('No encontramos esa publicación. Puede que la hayan eliminado.')
      return { id: postId, summary: `Editó una publicación de ${values.platform}`, meta: values }
    },
  })
}

export async function eliminarPublicacion(id: string): Result {
  return mutate({
    action: 'social.delete',
    permission: 'social:write',
    entityType: 'social_post',
    schema: nothing,
    input: null,
    tags: TAGS,
    write: async (tx) => {
      const postId = assertId(id, 'No encontramos esa publicación.')
      const [row] = await tx
        .delete(socialPosts)
        .where(eq(socialPosts.id, postId))
        .returning({ platform: socialPosts.platform })
      if (!row) throw new Rejection('No encontramos esa publicación. Puede que ya la hayan eliminado.')
      return { id: postId, summary: `Eliminó una publicación de ${row.platform}` }
    },
  })
}
