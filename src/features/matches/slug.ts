import 'server-only'
import { proxySql } from '@/db/proxy-client'
import { type SlugRow, type SlugStatus, toSlugStatus } from '@/lib/slug-status'

/**
 * Estado de `/partidos/[slug]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `matches.slug` y `slug_redirects`. Misma regla que `getMatchDetail`: solo partidos del club.
 */
export async function matchSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<SlugRow[]>`
    select m.slug, false as moved
    from matches m
    where m.slug = ${slug} and m.club_side <> 'ninguno'
    union all
    select m.slug, true as moved
    from slug_redirects r
    join matches m on m.id = r.entity_id
    where r.entity_type = 'match' and r.old_slug = ${slug} and m.club_side <> 'ninguno'
    order by moved
    limit 1`
  return toSlugStatus(row)
}
