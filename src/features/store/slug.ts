import 'server-only'
import { proxySql } from '@/db/proxy-client'
import { type SlugRow, type SlugStatus, toSlugStatus } from '@/lib/slug-status'

/**
 * Estado de `/tienda/[slug]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `products.slug` y `slug_redirects`. Solo existe un producto activo.
 */
export async function productSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<SlugRow[]>`
    select p.slug, false as moved
    from products p
    where p.slug = ${slug} and p.is_active
    union all
    select p.slug, true as moved
    from slug_redirects r
    join products p on p.id = r.entity_id
    where r.entity_type = 'product' and r.old_slug = ${slug} and p.is_active
    order by moved
    limit 1`
  return toSlugStatus(row)
}
