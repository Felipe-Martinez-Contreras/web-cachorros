import { sql } from 'drizzle-orm'
import {
  check,
  date,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { opsRunKind, opsRunStatus } from './enums'

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())

/** Auditoría de toda creación, edición, publicación, eliminación y exportación (retención: 12 meses). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    userId: text('user_id').references(() => user.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt,
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_user_id_idx').on(table.userId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ],
)

/**
 * Configuración del club: fila única (`id = 1`). Los `jsonb` se tipan con Zod en su dominio.
 * `featured_series_id` y `share_card_sponsor_id` se agregan junto con sus tablas (Fase 1).
 */
export const siteSettings = pgTable(
  'site_settings',
  {
    id: smallint('id').primaryKey().default(1),
    clubName: text('club_name').notNull(),
    shortName: text('short_name').notNull(),
    foundedOn: date('founded_on').notNull(),
    whatsappE164: text('whatsapp_e164'),
    phoneE164: text('phone_e164'),
    publicEmail: text('public_email'),
    notifyRecipients: jsonb('notify_recipients'),
    socialLinks: jsonb('social_links'),
    address: text('address'),
    commune: text('commune'),
    region: text('region'),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    bankDetails: jsonb('bank_details'),
    donationUrl: text('donation_url'),
    hero: jsonb('hero'),
    seoDefaults: jsonb('seo_defaults'),
    createdAt,
    updatedAt,
  },
  (table) => [check('site_settings_single_row', sql`${table.id} = 1`)],
)

/** Ejecuciones del contenedor `ops` (respaldos, pruebas de restauración, limpieza, disco). */
export const opsRuns = pgTable(
  'ops_runs',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    kind: opsRunKind('kind').notNull(),
    status: opsRunStatus('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt,
  },
  (table) => [index('ops_runs_kind_started_at_idx').on(table.kind, table.startedAt.desc())],
)
