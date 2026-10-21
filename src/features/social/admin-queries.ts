import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, socialPosts } from '@/db/schema'
import { toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual. Mismo orden que el sitio.

export async function listSocialPostsAdmin() {
  const rows = await db
    .select({
      id: socialPosts.id,
      platform: socialPosts.platform,
      permalink: socialPosts.permalink,
      excerpt: socialPosts.excerpt,
      postedOn: socialPosts.postedOn,
      sortOrder: socialPosts.sortOrder,
      isPinned: socialPosts.isPinned,
      embedEnabled: socialPosts.embedEnabled,
      isPublished: socialPosts.isPublished,
      imageId: mediaAssets.id,
      imageVariants: mediaAssets.variants,
      imageAlt: mediaAssets.altText,
      imageMinors: mediaAssets.containsMinors,
    })
    .from(socialPosts)
    .leftJoin(mediaAssets, eq(mediaAssets.id, socialPosts.imageMediaId))
    .orderBy(desc(socialPosts.isPinned), asc(socialPosts.sortOrder), desc(socialPosts.postedOn))
  return rows.map(({ imageId, imageVariants, imageAlt, imageMinors, ...row }) => ({
    ...row,
    image: imageId
      ? toMediaThumbDTO({
          id: imageId,
          variants: imageVariants,
          altText: imageAlt,
          containsMinors: imageMinors ?? false,
        })
      : null,
  }))
}

export type SocialPostAdmin = Awaited<ReturnType<typeof listSocialPostsAdmin>>[number]

export async function getSocialPostAdmin(id: string): Promise<SocialPostAdmin | null> {
  const rows = await listSocialPostsAdmin()
  return rows.find((row) => row.id === id) ?? null
}
