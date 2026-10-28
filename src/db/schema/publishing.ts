import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './_columns'
import { user } from './auth'
import { publicationKind, publicationStatus, publicationTrigger, socialChannel } from './enums'
import { matches } from './sport'

/**
 * Lo que se programó: el día (Santiago), el rival y los partidos de la tarjeta con su hora y su estado. El seguro
 * lo compara con lo vigente antes de publicar (`scheduleGuard`).
 */
export type ScheduleSnapshot = {
  day: string
  rivalId: string
  matches: { id: string; kickoffAt: string }[]
}

/**
 * Publicaciones en redes (ADR 0009): una fila por canal, tipo y sujeto (partido, fin de semana o jornada). El índice
 * único es la barrera de idempotencia: lo mismo nunca se publica dos veces. Los fallos se reintentan desde
 * la tarea `tick` y quedan visibles en el panel.
 */
export const socialPublications = pgTable(
  'social_publications',
  {
    id: id(),
    channel: socialChannel('channel').notNull(),
    kind: publicationKind('kind').notNull(),
    /** uuid del partido, sábado `YYYY-MM-DD` del fin de semana o clave `AAAA-MM-DD_<rivalId>` de la jornada. */
    subjectKey: text('subject_key').notNull(),
    matchId: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
    weekend: date('weekend'),
    trigger: publicationTrigger('trigger').notNull(),
    /** Texto del post: el editado a mano, o el generado al publicar si es automática. */
    message: text('message'),
    /** Fotos del matchday elegidas para esta publicación (`null`: las de Configuración). */
    photoIds: jsonb('photo_ids').$type<(string | null)[]>(),
    /** Solo «Jornada»: las series marcadas para esta publicación (`null`: todas las de la jornada). */
    seriesIds: jsonb('series_ids').$type<string[]>(),
    imageVersion: text('image_version'),
    status: publicationStatus('status').notNull().default('pendiente'),
    attempts: smallint('attempts').notNull().default(0),
    /** Mensaje del último error, ya saneado (nunca el token). */
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    externalId: text('external_id'),
    externalUrl: text('external_url'),
    requestedBy: text('requested_by').references(() => user.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Solo «programada»: cuándo se publica. */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    scheduledSnapshot: jsonb('scheduled_snapshot').$type<ScheduleSnapshot>(),
    /** Aviso por correo a los administradores cuando un seguro descarta una programada (una sola vez). */
    discardNotifiedAt: timestamp('discard_notified_at', { withTimezone: true }),
    discardNotifyAttempts: integer('discard_notify_attempts').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('social_publications_subject_uq').on(table.channel, table.kind, table.subjectKey),
    index('social_publications_status_next_idx').on(table.status, table.nextAttemptAt),
    index('social_publications_status_scheduled_idx').on(table.status, table.scheduledAt),
    index('social_publications_match_id_idx').on(table.matchId),
    index('social_publications_requested_by_idx').on(table.requestedBy),
    check('social_publications_attempts_check', sql`${table.attempts} between 0 and 20`),
  ],
)
