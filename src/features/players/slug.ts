import 'server-only'
import { proxySql } from '@/db/proxy-client'
import { toIsoDate } from '@/lib/format'
import { type SlugRow, type SlugStatus, toSlugStatus } from '@/lib/slug-status'
import { isMinor } from './lib/is-minor'

type PlayerSlugRow = SlugRow & { birthDate: string | null; inMinorsSeries: boolean }

/**
 * Estado de `/jugadores/[slug]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `players.slug` y `slug_redirects`. Misma regla que `getPlayerProfile`: la ficha no existe para jugadores
 * inactivos ni para menores de edad (6.3). Tampoco se redirige hacia la ficha de un menor: su dirección
 * antigua responde 404 sin revelar la vigente.
 */
export async function playerSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<PlayerSlugRow[]>`
    select found.slug, found.moved, found.birth_date::text as "birthDate",
      exists (
        select 1
        from squad_registrations r
        join series s on s.id = r.series_id
        where r.player_id = found.id and s.contains_minors
      ) as "inMinorsSeries"
    from (
      select p.id, p.slug, p.birth_date, false as moved
      from players p
      where p.slug = ${slug} and p.is_active
      union all
      select p.id, p.slug, p.birth_date, true as moved
      from slug_redirects sr
      join players p on p.id = sr.entity_id
      where sr.entity_type = 'player' and sr.old_slug = ${slug} and p.is_active
      order by moved
      limit 1
    ) found`
  if (!row) return { kind: 'missing' }
  const minor = isMinor(row, row.inMinorsSeries ? [{ containsMinors: true }] : [], toIsoDate(new Date()))
  return minor ? { kind: 'missing' } : toSlugStatus(row)
}

/**
 * Estado de `/plantel/[serie]` para el proxy (ADR 0008), con una sola consulta por los índices únicos de
 * `series.slug` y `slug_redirects`. Misma regla que `getSquad`: solo series activas.
 */
export async function seriesSlugStatus(slug: string): Promise<SlugStatus> {
  const [row] = await proxySql<SlugRow[]>`
    select s.slug, false as moved
    from series s
    where s.slug = ${slug} and s.is_active
    union all
    select s.slug, true as moved
    from slug_redirects r
    join series s on s.id = r.entity_id
    where r.entity_type = 'series' and r.old_slug = ${slug} and s.is_active
    order by moved
    limit 1`
  return toSlugStatus(row)
}
