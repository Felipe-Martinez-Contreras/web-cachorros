import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, type RichTextDoc, timestamps } from './_columns'
import { user } from './auth'
import { events } from './club'
import { datePrecision, newsStatus, newsType, socialPlatform, videoProvider } from './enums'
import { mediaAssets } from './media'
import { matches, players, series } from './sport'

export const newsCategories = pgTable(
  'news_categories',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [uniqueIndex('news_categories_slug_uq').on(table.slug)],
)

export const albums = pgTable(
  'albums',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    takenOn: date('taken_on'),
    coverMediaId: uuid('cover_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    matchId: uuid('match_id').references((): AnyPgColumn => matches.id, { onDelete: 'set null' }),
    eventId: uuid('event_id').references((): AnyPgColumn => events.id, { onDelete: 'set null' }),
    isPublished: boolean('is_published').notNull().default(false),
    containsMinors: boolean('contains_minors').notNull().default(false),
    minorsConsentConfirmedBy: text('minors_consent_confirmed_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    minorsConsentConfirmedAt: timestamp('minors_consent_confirmed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('albums_slug_uq').on(table.slug),
    index('albums_cover_media_id_idx').on(table.coverMediaId),
    index('albums_match_id_idx').on(table.matchId),
    index('albums_event_id_idx').on(table.eventId),
    index('albums_minors_consent_confirmed_by_idx').on(table.minorsConsentConfirmedBy),
    // Un álbum con menores no se publica sin la confirmación de autorizaciones (9.6).
    check(
      'albums_minors_consent_check',
      sql`NOT (${table.isPublished} AND ${table.containsMinors} AND ${table.minorsConsentConfirmedAt} IS NULL)`,
    ),
  ],
)

export const albumItems = pgTable(
  'album_items',
  {
    id: id(),
    albumId: uuid('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    caption: text('caption'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('album_items_album_media_uq').on(table.albumId, table.mediaId),
    index('album_items_media_id_idx').on(table.mediaId),
  ],
)

export const news = pgTable(
  'news',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    type: newsType('type').notNull().default('noticia'),
    excerpt: text('excerpt'),
    body: jsonb('body').$type<RichTextDoc>(),
    // Texto plano del cuerpo, para extractos y búsqueda.
    bodyText: text('body_text'),
    coverMediaId: uuid('cover_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => newsCategories.id, { onDelete: 'restrict' }),
    status: newsStatus('status').notNull().default('borrador'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    isFeatured: boolean('is_featured').notNull().default(false),
    isPinned: boolean('is_pinned').notNull().default(false),
    authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
    matchId: uuid('match_id').references(() => matches.id, { onDelete: 'restrict' }),
    albumId: uuid('album_id').references(() => albums.id, { onDelete: 'restrict' }),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    ogMediaId: uuid('og_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('news_slug_uq').on(table.slug),
    index('news_status_published_at_idx').on(table.status, table.publishedAt.desc()),
    index('news_cover_media_id_idx').on(table.coverMediaId),
    index('news_category_id_idx').on(table.categoryId),
    index('news_author_id_idx').on(table.authorId),
    index('news_match_id_idx').on(table.matchId),
    index('news_album_id_idx').on(table.albumId),
    index('news_og_media_id_idx').on(table.ogMediaId),
    check('news_cronica_match_check', sql`${table.type} <> 'cronica' OR ${table.matchId} IS NOT NULL`),
    check('news_galeria_album_check', sql`${table.type} <> 'galeria' OR ${table.albumId} IS NOT NULL`),
    // Lo publicado o programado siempre tiene fecha de publicación.
    check(
      'news_published_at_check',
      sql`${table.status} NOT IN ('publicada', 'programada') OR ${table.publishedAt} IS NOT NULL`,
    ),
  ],
)

export const newsSeries = pgTable(
  'news_series',
  {
    newsId: uuid('news_id')
      .notNull()
      .references(() => news.id, { onDelete: 'cascade' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.newsId, table.seriesId] }),
    index('news_series_series_id_idx').on(table.seriesId),
  ],
)

export const videos = pgTable(
  'videos',
  {
    id: id(),
    title: text('title').notNull(),
    provider: videoProvider('provider').notNull(),
    url: text('url').notNull(),
    externalId: text('external_id'),
    thumbnailMediaId: uuid('thumbnail_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    publishedOn: date('published_on'),
    matchId: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
    isPublished: boolean('is_published').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    index('videos_thumbnail_media_id_idx').on(table.thumbnailMediaId),
    index('videos_match_id_idx').on(table.matchId),
  ],
)

/** Feed de redes curado a mano (2.9). */
export const socialPosts = pgTable(
  'social_posts',
  {
    id: id(),
    platform: socialPlatform('platform').notNull(),
    permalink: text('permalink').notNull(),
    imageMediaId: uuid('image_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    excerpt: text('excerpt'),
    postedOn: date('posted_on'),
    isPinned: boolean('is_pinned').notNull().default(false),
    embedEnabled: boolean('embed_enabled').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(false),
    ...timestamps(),
  },
  (table) => [index('social_posts_image_media_id_idx').on(table.imageMediaId)],
)

export const historyMilestones = pgTable(
  'history_milestones',
  {
    id: id(),
    occurredOn: date('occurred_on').notNull(),
    datePrecision: datePrecision('date_precision').notNull().default('anio'),
    title: text('title').notNull(),
    body: text('body'),
    imageMediaId: uuid('image_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    // Hito no confirmado por el club: se muestra marcado y aparece en los pendientes.
    isPlaceholder: boolean('is_placeholder').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    index('history_milestones_occurred_on_idx').on(table.occurredOn),
    index('history_milestones_image_media_id_idx').on(table.imageMediaId),
  ],
)

/** Títulos y campeonatos. */
export const honours = pgTable(
  'honours',
  {
    id: id(),
    name: text('name').notNull(),
    year: smallint('year'),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'restrict' }),
    competitionName: text('competition_name'),
    description: text('description'),
    imageMediaId: uuid('image_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (table) => [
    index('honours_series_id_idx').on(table.seriesId),
    index('honours_image_media_id_idx').on(table.imageMediaId),
  ],
)

export const hallOfFame = pgTable(
  'hall_of_fame',
  {
    id: id(),
    fullName: text('full_name').notNull(),
    nickname: text('nickname'),
    eraLabel: text('era_label'),
    position: text('position'),
    bio: text('bio'),
    photoMediaId: uuid('photo_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    playerId: uuid('player_id').references(() => players.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index('hall_of_fame_photo_media_id_idx').on(table.photoMediaId),
    index('hall_of_fame_player_id_idx').on(table.playerId),
  ],
)

export const historicKits = pgTable(
  'historic_kits',
  {
    id: id(),
    yearFrom: smallint('year_from'),
    yearTo: smallint('year_to'),
    description: text('description').notNull(),
    imageMediaId: uuid('image_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [index('historic_kits_image_media_id_idx').on(table.imageMediaId)],
)
