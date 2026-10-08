import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, type RichTextDoc, timestamps } from './_columns'
import { user } from './auth'
import {
  contactTopic,
  documentCategory,
  eventStatus,
  eventType,
  feePeriod,
  inboxStatus,
  memberStatus,
  sponsorTier,
} from './enums'
import { mediaAssets } from './media'
import { venues } from './sport'

export const boardMembers = pgTable(
  'board_members',
  {
    id: id(),
    fullName: text('full_name').notNull(),
    roleTitle: text('role_title').notNull(),
    photoMediaId: uuid('photo_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    publicEmail: text('public_email'),
    termStart: date('term_start'),
    termEnd: date('term_end'),
    isCurrent: boolean('is_current').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [index('board_members_photo_media_id_idx').on(table.photoMediaId)],
)

/** Documentos de transparencia: solo PDF (6.12). */
export const documents = pgTable(
  'documents',
  {
    id: id(),
    title: text('title').notNull(),
    category: documentCategory('category').notNull(),
    periodLabel: text('period_label'),
    documentDate: date('document_date'),
    fileMediaId: uuid('file_media_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    description: text('description'),
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('documents_file_media_id_idx').on(table.fileMediaId),
    index('documents_category_date_idx').on(table.category, table.documentDate.desc()),
  ],
)

export const events = pgTable(
  'events',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    type: eventType('type').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    locationText: text('location_text'),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'restrict' }),
    posterMediaId: uuid('poster_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    description: jsonb('description').$type<RichTextDoc>(),
    priceText: text('price_text'),
    ctaUrl: text('cta_url'),
    status: eventStatus('status').notNull().default('programado'),
    isPublished: boolean('is_published').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('events_slug_uq').on(table.slug),
    index('events_starts_at_idx').on(table.startsAt),
    index('events_venue_id_idx').on(table.venueId),
    index('events_poster_media_id_idx').on(table.posterMediaId),
    check('events_ends_at_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`),
  ],
)

export const sponsors = pgTable(
  'sponsors',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    tier: sponsorTier('tier').notNull(),
    logoMediaId: uuid('logo_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    description: text('description'),
    websiteUrl: text('website_url'),
    instagramUrl: text('instagram_url'),
    whatsappE164: text('whatsapp_e164'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    // Vigencia: un auspicio vencido se oculta solo (6.10).
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('sponsors_slug_uq').on(table.slug),
    index('sponsors_logo_media_id_idx').on(table.logoMediaId),
  ],
)

/** Clics agregados por día: sin datos personales. */
export const sponsorClicksDaily = pgTable(
  'sponsor_clicks_daily',
  {
    sponsorId: uuid('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    clicks: integer('clicks').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.sponsorId, table.day] }),
    check('sponsor_clicks_daily_clicks_check', sql`${table.clicks} >= 0`),
  ],
)

export const productCategories = pgTable(
  'product_categories',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [uniqueIndex('product_categories_slug_uq').on(table.slug)],
)

export const products = pgTable(
  'products',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'restrict' }),
    description: text('description'),
    priceClp: integer('price_clp').notNull(),
    compareAtPriceClp: integer('compare_at_price_clp'),
    trackStock: boolean('track_stock').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('products_slug_uq').on(table.slug),
    index('products_category_id_idx').on(table.categoryId),
    check('products_price_check', sql`${table.priceClp} >= 0`),
    check(
      'products_compare_at_price_check',
      sql`${table.compareAtPriceClp} IS NULL OR ${table.compareAtPriceClp} >= 0`,
    ),
  ],
)

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('product_images_product_media_uq').on(table.productId, table.mediaId),
    index('product_images_media_id_idx').on(table.mediaId),
  ],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sizeLabel: text('size_label').notNull(),
    // NULL = sin control de stock para esta talla.
    stock: integer('stock'),
    isAvailable: boolean('is_available').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('product_variants_product_size_uq').on(table.productId, table.sizeLabel),
    check('product_variants_stock_check', sql`${table.stock} IS NULL OR ${table.stock} >= 0`),
  ],
)

export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: id(),
    name: text('name').notNull(),
    feeClp: integer('fee_clp').notNull(),
    feePeriod: feePeriod('fee_period').notNull(),
    benefits: jsonb('benefits').$type<string[]>(),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [check('membership_plans_fee_check', sql`${table.feeClp} >= 0`)],
)

/** Padrón mínimo: sin login en v1. `user_id` y `qr_token` quedan para el área privada futura (8.8). */
export const members = pgTable(
  'members',
  {
    id: id(),
    memberNumber: integer('member_number').notNull().generatedByDefaultAsIdentity(),
    fullName: text('full_name').notNull(),
    rut: text('rut'),
    email: text('email'),
    phoneE164: text('phone_e164'),
    planId: uuid('plan_id').references(() => membershipPlans.id, { onDelete: 'restrict' }),
    status: memberStatus('status').notNull().default('activo'),
    joinedOn: date('joined_on').notNull().defaultNow(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    qrToken: text('qr_token'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('members_member_number_uq').on(table.memberNumber),
    uniqueIndex('members_qr_token_uq').on(table.qrToken),
    index('members_plan_id_idx').on(table.planId),
    index('members_user_id_idx').on(table.userId),
  ],
)

export const membershipRequests = pgTable(
  'membership_requests',
  {
    id: id(),
    fullName: text('full_name').notNull(),
    rut: text('rut'),
    email: text('email').notNull(),
    phoneE164: text('phone_e164'),
    commune: text('commune'),
    planId: uuid('plan_id').references(() => membershipPlans.id, { onDelete: 'restrict' }),
    message: text('message'),
    privacyConsentAt: timestamp('privacy_consent_at', { withTimezone: true }).notNull(),
    privacyPolicyVersion: text('privacy_policy_version').notNull(),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    status: inboxStatus('status').notNull().default('nueva'),
    internalNotes: text('internal_notes'),
    handledBy: text('handled_by').references(() => user.id, { onDelete: 'set null' }),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    ...timestamps(),
  },
  (table) => [
    index('membership_requests_status_created_idx').on(table.status, table.createdAt.desc()),
    index('membership_requests_plan_id_idx').on(table.planId),
    index('membership_requests_handled_by_idx').on(table.handledBy),
    index('membership_requests_member_id_idx').on(table.memberId),
  ],
)

export const sponsorshipInquiries = pgTable(
  'sponsorship_inquiries',
  {
    id: id(),
    businessName: text('business_name').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    phoneE164: text('phone_e164'),
    tierInterest: sponsorTier('tier_interest'),
    message: text('message'),
    status: inboxStatus('status').notNull().default('nueva'),
    internalNotes: text('internal_notes'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    ...timestamps(),
  },
  (table) => [index('sponsorship_inquiries_status_created_idx').on(table.status, table.createdAt.desc())],
)

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phoneE164: text('phone_e164'),
    topic: contactTopic('topic').notNull().default('general'),
    message: text('message').notNull(),
    status: inboxStatus('status').notNull().default('nueva'),
    internalNotes: text('internal_notes'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    ...timestamps(),
  },
  (table) => [index('contact_messages_status_created_idx').on(table.status, table.createdAt.desc())],
)
