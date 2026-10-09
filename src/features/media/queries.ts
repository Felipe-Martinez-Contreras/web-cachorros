import 'server-only'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db, sql } from '@/db/client'
import { mediaAssets } from '@/db/schema'
import {
  type MediaDetailDTO,
  type MediaListItemDTO,
  type MediaUsageDTO,
  toMediaDetailDTO,
  toMediaListItemDTO,
} from './dto'

// Lecturas del panel: sin caché, siempre el estado actual.

export const MEDIA_PAGE_SIZE = 24

export async function listMedia(options: {
  q?: string
  page?: number
}): Promise<{ items: MediaListItemDTO[]; page: number; totalPages: number; total: number }> {
  const term = options.q?.trim()
  const where = term
    ? or(ilike(mediaAssets.altText, `%${term}%`), ilike(mediaAssets.originalFilename, `%${term}%`))
    : undefined
  const filter = and(eq(mediaAssets.kind, 'imagen'), where)

  const [totals] = await db.select({ total: count() }).from(mediaAssets).where(filter)
  const total = totals?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE))
  const page = Math.min(Math.max(1, options.page ?? 1), totalPages)

  const rows = await db
    .select({
      id: mediaAssets.id,
      variants: mediaAssets.variants,
      altText: mediaAssets.altText,
      containsMinors: mediaAssets.containsMinors,
      width: mediaAssets.width,
      height: mediaAssets.height,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .where(filter)
    .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
    .limit(MEDIA_PAGE_SIZE)
    .offset((page - 1) * MEDIA_PAGE_SIZE)
  return { items: rows.map(toMediaListItemDTO), page, totalPages, total }
}

export async function getMediaById(id: string): Promise<MediaDetailDTO | null> {
  const [row] = await db
    .select({
      id: mediaAssets.id,
      variants: mediaAssets.variants,
      altText: mediaAssets.altText,
      containsMinors: mediaAssets.containsMinors,
      width: mediaAssets.width,
      height: mediaAssets.height,
      createdAt: mediaAssets.createdAt,
      lqip: mediaAssets.lqip,
      credit: mediaAssets.credit,
      focalX: mediaAssets.focalX,
      focalY: mediaAssets.focalY,
      minorsConsentConfirmedAt: mediaAssets.minorsConsentConfirmedAt,
      bytes: mediaAssets.bytes,
      originalFilename: mediaAssets.originalFilename,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1)
  return row ? toMediaDetailDTO(row) : null
}

/** Nombre visible de cada lugar donde puede usarse un archivo de la biblioteca. */
const USAGE_LABELS: Record<string, string> = {
  teams: 'Escudos de equipos',
  players: 'Fotos de jugadores',
  staff_members: 'Fotos del cuerpo técnico',
  news: 'Noticias',
  albums: 'Portadas de álbumes',
  album_items: 'Fotos de álbumes',
  videos: 'Miniaturas de videos',
  social_posts: 'Publicaciones de redes',
  history_milestones: 'Hitos de la historia',
  honours: 'Títulos',
  hall_of_fame: 'Salón de la fama',
  historic_kits: 'Camisetas históricas',
  board_members: 'Directiva',
  documents: 'Documentos',
  events: 'Afiches de eventos',
  sponsors: 'Logos de auspiciadores',
  product_images: 'Fotos de productos',
  site_settings: 'Configuración del sitio (portada o imagen para redes)',
}

/**
 * Dónde se usa un archivo (especificación 7.5). Las columnas que apuntan a `media_assets` se leen del
 * catálogo de PostgreSQL: una tabla nueva con una imagen queda cubierta sin tocar esta función.
 */
export async function getMediaUsage(id: string): Promise<MediaUsageDTO[]> {
  const references = await sql<{ tbl: string; col: string }[]>`
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'media_assets'::regclass`
  const counts = new Map<string, number>()
  if (references.length > 0) {
    // Los identificadores vienen del catálogo, no del usuario; el id va como parámetro.
    const query = references
      .map((ref) => `select '${ref.tbl}' as tbl, count(*)::int as n from ${ref.tbl} where "${ref.col}" = $1`)
      .join(' union all ')
    for (const row of await sql.unsafe<{ tbl: string; n: number }[]>(query, [id])) {
      counts.set(row.tbl, (counts.get(row.tbl) ?? 0) + row.n)
    }
  }
  // Referencias guardadas dentro de un jsonb (no tienen clave foránea).
  const [settings] = await sql<{ n: number }[]>`
    select count(*)::int as n from site_settings
    where hero->>'mediaId' = ${id} or hero->>'mobileMediaId' = ${id} or seo_defaults->>'ogMediaId' = ${id}`
  if (settings?.n) counts.set('site_settings', settings.n)

  return [...counts.entries()]
    .filter(([, n]) => n > 0)
    .map(([table, n]) => ({ label: USAGE_LABELS[table] ?? table, count: n }))
}
