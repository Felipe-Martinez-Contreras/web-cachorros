import 'server-only'
import { and, eq, like } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { Tx } from '@/db/client'
import { slugRedirects } from '@/db/schema'
import { slugify, uniqueSlug } from '@/lib/slug'

type SlugTable = PgTable & { id: AnyPgColumn; slug: AnyPgColumn }

/** Entidades con slug público; el valor es el `entity_type` de `slug_redirects`. */
export type SlugEntity = 'series' | 'team' | 'match' | 'player' | 'news'

/**
 * Slug único para una entidad (3.9): `base`, o `base-2`, `base-3`… si ya está tomado por otra fila.
 * Se llama dentro de la transacción que escribe la fila.
 */
export async function resolveSlug(
  tx: Tx,
  table: SlugTable,
  base: string,
  currentId?: string,
): Promise<string> {
  const root = slugify(base) || 'sin-titulo'
  // Los candidatos comparten el comienzo (el sufijo puede recortar hasta 4 caracteres del final).
  const prefix = root.slice(0, Math.max(1, root.length - 4))
  const rows = await tx
    .select({ id: table.id, slug: table.slug })
    .from(table)
    .where(like(table.slug, `${prefix}%`))
  const taken = new Set(rows.filter((row) => row.id !== currentId).map((row) => String(row.slug)))
  return uniqueSlug(root, (slug) => taken.has(slug))
}

/**
 * Al cambiar un slug se guarda el anterior para responder con una redirección 301. Si el slug nuevo
 * era una redirección antigua (de esta u otra entidad), se elimina: una dirección vigente no redirige.
 */
export async function recordSlugChange(
  tx: Tx,
  entityType: SlugEntity,
  entityId: string,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (oldSlug === newSlug) return
  await tx
    .delete(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.oldSlug, newSlug)))
  await tx
    .insert(slugRedirects)
    .values({ entityType, oldSlug, entityId })
    .onConflictDoUpdate({
      target: [slugRedirects.entityType, slugRedirects.oldSlug],
      set: { entityId },
    })
}
