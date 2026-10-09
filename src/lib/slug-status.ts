/**
 * Qué responde una dirección de detalle (ADR 0008): la página existe y se puede ver, cambió de slug
 * (redirección 301 al vigente) o no existe (404). Lo decide `proxy.ts` antes del render.
 */
export type SlugStatus = { kind: 'found' } | { kind: 'moved'; slug: string } | { kind: 'missing' }

/** Fila de una consulta de estado: el slug vigente y si se llegó a él por una dirección antigua. */
export type SlugRow = { slug: string; moved: boolean }

export function toSlugStatus(row: SlugRow | undefined): SlugStatus {
  if (!row) return { kind: 'missing' }
  return row.moved ? { kind: 'moved', slug: row.slug } : { kind: 'found' }
}
