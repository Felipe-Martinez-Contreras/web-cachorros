import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { mediaAssets, socialPosts } from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import { safeExternalUrl } from '@/lib/links'
import type { SocialPostDTO } from './dto'

/** Feed curado de redes (especificación 2.9): las fijadas primero, luego en el orden definido en el panel. */
export async function getSocialPosts(limit = 6): Promise<SocialPostDTO[]> {
  'use cache'
  cacheTag(tags.social())
  cacheLife('hours')

  const rows = await db
    .select({
      id: socialPosts.id,
      platform: socialPosts.platform,
      permalink: socialPosts.permalink,
      excerpt: socialPosts.excerpt,
      image: {
        variants: mediaAssets.variants,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        lqip: mediaAssets.lqip,
        credit: mediaAssets.credit,
        focalX: mediaAssets.focalX,
        focalY: mediaAssets.focalY,
      },
    })
    .from(socialPosts)
    .leftJoin(mediaAssets, eq(mediaAssets.id, socialPosts.imageMediaId))
    .where(eq(socialPosts.isPublished, true))
    .orderBy(desc(socialPosts.isPinned), asc(socialPosts.sortOrder), desc(socialPosts.postedOn))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    // Mientras no haya una URL real, la publicación se muestra sin enlace.
    permalink: safeExternalUrl(row.permalink),
    excerpt: row.excerpt,
    image: toImageDTO(row.image),
  }))
}
