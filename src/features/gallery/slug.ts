import 'server-only'
import { proxySql } from '@/db/proxy-client'
import { type SlugRow, type SlugStatus, toSlugStatus } from '@/lib/slug-status'

/**
 * Estado de `/galeria/[slug]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `albums.slug` y `slug_redirects`. Solo existe un álbum publicado.
 */
export async function albumSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<SlugRow[]>`
    select a.slug, false as moved
    from albums a
    where a.slug = ${slug} and a.is_published
    union all
    select a.slug, true as moved
    from slug_redirects r
    join albums a on a.id = r.entity_id
    where r.entity_type = 'album' and r.old_slug = ${slug} and a.is_published
    order by moved
    limit 1`
  return toSlugStatus(row)
}
