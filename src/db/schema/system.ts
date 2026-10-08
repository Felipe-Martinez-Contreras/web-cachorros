import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  date,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, type RichTextDoc, timestamps } from './_columns'
import { user } from './auth'
import { sponsors } from './club'
import { opsRunKind, opsRunStatus } from './enums'
import { series } from './sport'

/** Auditoría de toda creación, edición, publicación, eliminación y exportación (retención: 12 meses). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    userId: text('user_id').references(() => user.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_user_id_idx').on(table.userId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ],
)

/** Destinatarios de las notificaciones de cada formulario. */
export type NotifyRecipients = { socios?: string[]; auspicios?: string[]; contacto?: string[] }
export type SocialLinks = Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x', string>>
export type BankDetails = {
  holder: string
  rut: string
  bank: string
  accountType: string
  accountNumber: string
  email?: string
}
/** Hero de la portada (5.3): textos, CTA y fotos (la de celular es opcional). */
export type HeroSettings = {
  title?: string
  subtitle?: string
  ctaLabel?: string
  ctaHref?: string
  mediaId?: string
  mobileMediaId?: string
}
export type SeoDefaults = { description?: string; ogMediaId?: string }

/** Configuración del club: fila única (`id = 1`). Los `jsonb` se validan con Zod en su dominio. */
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
    notifyRecipients: jsonb('notify_recipients').$type<NotifyRecipients>(),
    socialLinks: jsonb('social_links').$type<SocialLinks>(),
    address: text('address'),
    commune: text('commune'),
    region: text('region'),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    bankDetails: jsonb('bank_details').$type<BankDetails>(),
    donationUrl: text('donation_url'),
    hero: jsonb('hero').$type<HeroSettings>(),
    featuredSeriesId: uuid('featured_series_id').references((): AnyPgColumn => series.id, {
      onDelete: 'set null',
    }),
    shareCardSponsorId: uuid('share_card_sponsor_id').references((): AnyPgColumn => sponsors.id, {
      onDelete: 'set null',
    }),
    seoDefaults: jsonb('seo_defaults').$type<SeoDefaults>(),
    ...timestamps(),
  },
  (table) => [
    check('site_settings_single_row', sql`${table.id} = 1`),
    index('site_settings_featured_series_id_idx').on(table.featuredSeriesId),
    index('site_settings_share_card_sponsor_id_idx').on(table.shareCardSponsorId),
  ],
)

/** Textos de páginas editables desde el panel (`historia.intro`, `socios.beneficios`, …). */
export const pageBlocks = pgTable(
  'page_blocks',
  {
    id: id(),
    key: text('key').notNull(),
    title: text('title'),
    body: jsonb('body').$type<RichTextDoc>(),
    ...timestamps(),
  },
  (table) => [uniqueIndex('page_blocks_key_uq').on(table.key)],
)

/** Al cambiar un slug se guarda el anterior para responder con una redirección 301 (3.9). */
export const slugRedirects = pgTable(
  'slug_redirects',
  {
    id: id(),
    entityType: text('entity_type').notNull(),
    oldSlug: text('old_slug').notNull(),
    entityId: uuid('entity_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('slug_redirects_type_slug_uq').on(table.entityType, table.oldSlug),
    index('slug_redirects_entity_idx').on(table.entityType, table.entityId),
  ],
)

/** Ejecuciones del contenedor `ops` (respaldos, pruebas de restauración, limpieza, disco). */
export const opsRuns = pgTable(
  'ops_runs',
  {
    id: id(),
    kind: opsRunKind('kind').notNull(),
    status: opsRunStatus('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [index('ops_runs_kind_started_at_idx').on(table.kind, table.startedAt.desc())],
)
