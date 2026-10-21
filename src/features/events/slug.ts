import 'server-only'
import { proxySql } from '@/db/proxy-client'
import { type SlugRow, type SlugStatus, toSlugStatus } from '@/lib/slug-status'

/**
 * Estado de `/eventos/[slug]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `events.slug` y `slug_redirects`. Solo existe un evento publicado.
 */
export async function eventSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<SlugRow[]>`
    select e.slug, false as moved
    from events e
    where e.slug = ${slug} and e.is_published
    union all
    select e.slug, true as moved
    from slug_redirects r
    join events e on e.id = r.entity_id
    where r.entity_type = 'event' and r.old_slug = ${slug} and e.is_published
    order by moved
    limit 1`
  return toSlugStatus(row)
}
