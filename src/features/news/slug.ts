import 'server-only'
import { proxySql } from '@/db/proxy-client'
import { type SlugRow, type SlugStatus, toSlugStatus } from '@/lib/slug-status'

/**
 * Estado de `/noticias/[slug]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `news.slug` y `slug_redirects`. Solo existe una noticia publicada cuya fecha de publicación ya llegó.
 */
export async function newsSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<SlugRow[]>`
    select n.slug, false as moved
    from news n
    where n.slug = ${slug} and n.status = 'publicada' and n.published_at <= now()
    union all
    select n.slug, true as moved
    from slug_redirects r
    join news n on n.id = r.entity_id
    where r.entity_type = 'news' and r.old_slug = ${slug}
      and n.status = 'publicada' and n.published_at <= now()
    order by moved
    limit 1`
  return toSlugStatus(row)
}
