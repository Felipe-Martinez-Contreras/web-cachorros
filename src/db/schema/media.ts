import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './_columns'
import { user } from './auth'
import { mediaKind } from './enums'

/** Archivos derivados de una imagen subida. Las rutas son relativas a `UPLOADS_DIR` (se sirven en `/media/`). */
export type MediaVariants = {
  /** Original re-codificado (JPEG, o PNG si tiene transparencia). */
  master: string
  /** Variantes WebP en anchos fijos, de menor a mayor. */
  webp: { width: number; height: number; path: string }[]
  /** PNG de 512 px para Satori (escudos y logos). */
  png512?: string
}

/** Biblioteca de medios (especificación 2.7 y 7.5). */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: id(),
    kind: mediaKind('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename'),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    variants: jsonb('variants').$type<MediaVariants>(),
    lqip: text('lqip'),
    altText: text('alt_text'),
    credit: text('credit'),
    focalX: real('focal_x').notNull().default(0.5),
    focalY: real('focal_y').notNull().default(0.5),
    containsMinors: boolean('contains_minors').notNull().default(false),
    minorsConsentConfirmedAt: timestamp('minors_consent_confirmed_at', { withTimezone: true }),
    uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('media_assets_storage_key_uq').on(table.storageKey),
    index('media_assets_uploaded_by_idx').on(table.uploadedBy),
    check('media_assets_bytes_check', sql`${table.bytes} >= 0`),
    check(
      'media_assets_alt_text_check',
      sql`${table.kind} <> 'imagen' OR length(btrim(coalesce(${table.altText}, ''))) > 0`,
    ),
    check(
      'media_assets_focal_check',
      sql`${table.focalX} BETWEEN 0 AND 1 AND ${table.focalY} BETWEEN 0 AND 1`,
    ),
  ],
)
