import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  pgView,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, type RichTextDoc, timestamps } from './_columns'
import { user } from './auth'
import { albums } from './content'
import {
  clubSide,
  competitionKind,
  lineupRole,
  matchEventType,
  matchPeriod,
  matchResolution,
  matchStatus,
  playerPosition,
  positionDetail,
  registrationStatus,
  seriesKind,
  staffRole,
  standingsMode,
} from './enums'
import { mediaAssets } from './media'

export const seasons = pgTable(
  'seasons',
  {
    id: id(),
    name: text('name').notNull(),
    year: integer('year').notNull(),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    isCurrent: boolean('is_current').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('seasons_name_uq').on(table.name),
    // Una sola temporada actual (8.6).
    uniqueIndex('seasons_current_uq').on(table.isCurrent).where(sql`${table.isCurrent}`),
  ],
)

/** Series del club: editables desde el panel, nunca fijas en el código (6.6). */
export const series = pgTable(
  'series',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    shortName: text('short_name').notNull(),
    kind: seriesKind('kind').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    containsMinors: boolean('contains_minors').notNull().default(false),
    halfLengthMinutes: smallint('half_length_minutes').notNull().default(45),
    description: text('description'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('series_slug_uq').on(table.slug),
    check('series_half_length_check', sql`${table.halfLengthMinutes} BETWEEN 5 AND 60`),
  ],
)

export const competitions = pgTable(
  'competitions',
  {
    id: id(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: competitionKind('kind').notNull().default('liga'),
    organizer: text('organizer'),
    pointsWin: smallint('points_win').notNull().default(3),
    pointsDraw: smallint('points_draw').notNull().default(1),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('competitions_season_name_uq').on(table.seasonId, table.name),
    check('competitions_points_check', sql`${table.pointsWin} >= 0 AND ${table.pointsDraw} >= 0`),
  ],
)

/** Rivales y el propio club (`is_own_club`). */
export const teams = pgTable(
  'teams',
  {
    id: id(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    slug: text('slug').notNull(),
    crestMediaId: uuid('crest_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    commune: text('commune'),
    isOwnClub: boolean('is_own_club').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('teams_slug_uq').on(table.slug),
    // Un solo club propio (8.6).
    uniqueIndex('teams_own_club_uq').on(table.isOwnClub).where(sql`${table.isOwnClub}`),
    index('teams_crest_media_id_idx').on(table.crestMediaId),
  ],
)

export const venues = pgTable('venues', {
  id: id(),
  name: text('name').notNull(),
  address: text('address'),
  commune: text('commune'),
  geoLat: doublePrecision('geo_lat'),
  geoLng: doublePrecision('geo_lng'),
  isHome: boolean('is_home').notNull().default(false),
  notes: text('notes'),
  ...timestamps(),
})

export const matches = pgTable(
  'matches',
  {
    id: id(),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'restrict' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'restrict' }),
    roundNumber: smallint('round_number'),
    roundLabel: text('round_label'),
    homeTeamId: uuid('home_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    awayTeamId: uuid('away_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'restrict' }),
    kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
    status: matchStatus('status').notNull().default('programado'),
    period: matchPeriod('period').notNull().default('previa'),
    periodStartedAt: timestamp('period_started_at', { withTimezone: true }),
    // Marcador derivado de los eventos (8.6); manual solo con `score_locked`.
    homeScore: smallint('home_score').notNull().default(0),
    awayScore: smallint('away_score').notNull().default(0),
    homePenalties: smallint('home_penalties'),
    awayPenalties: smallint('away_penalties'),
    resolution: matchResolution('resolution').notNull().default('normal'),
    scoreLocked: boolean('score_locked').notNull().default(false),
    // Lo fija la app según cuál de los dos equipos es el club.
    clubSide: clubSide('club_side').notNull().default('ninguno'),
    slug: text('slug').notNull(),
    report: jsonb('report').$type<RichTextDoc>(),
    albumId: uuid('album_id').references((): AnyPgColumn => albums.id, { onDelete: 'set null' }),
    shareVersion: integer('share_version').notNull().default(1),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('matches_slug_uq').on(table.slug),
    index('matches_series_season_kickoff_idx').on(table.seriesId, table.seasonId, table.kickoffAt),
    index('matches_live_idx').on(table.status).where(sql`${table.status} = 'en_vivo'`),
    index('matches_kickoff_at_idx').on(table.kickoffAt),
    index('matches_season_id_idx').on(table.seasonId),
    index('matches_competition_id_idx').on(table.competitionId),
    index('matches_home_team_id_idx').on(table.homeTeamId),
    index('matches_away_team_id_idx').on(table.awayTeamId),
    index('matches_venue_id_idx').on(table.venueId),
    index('matches_album_id_idx').on(table.albumId),
    check('matches_distinct_teams_check', sql`${table.homeTeamId} <> ${table.awayTeamId}`),
    check('matches_score_check', sql`${table.homeScore} >= 0 AND ${table.awayScore} >= 0`),
    check(
      'matches_penalties_check',
      sql`coalesce(${table.homePenalties}, 0) >= 0 AND coalesce(${table.awayPenalties}, 0) >= 0`,
    ),
  ],
)

export const players = pgTable(
  'players',
  {
    id: id(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    nickname: text('nickname'),
    slug: text('slug').notNull(),
    // Privada: nunca sale en DTOs públicos (6.3).
    birthDate: date('birth_date'),
    photoMediaId: uuid('photo_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    primaryPosition: playerPosition('primary_position').notNull(),
    positionDetail: positionDetail('position_detail'),
    bio: jsonb('bio').$type<RichTextDoc>(),
    isActive: boolean('is_active').notNull().default(true),
    imageConsentAt: timestamp('image_consent_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('players_slug_uq').on(table.slug),
    index('players_photo_media_id_idx').on(table.photoMediaId),
  ],
)

export const matchEvents = pgTable(
  'match_events',
  {
    id: id(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    type: matchEventType('type').notNull(),
    period: matchPeriod('period').notNull(),
    minute: smallint('minute'),
    stoppageMinute: smallint('stoppage_minute'),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'restrict' }),
    playerId: uuid('player_id').references(() => players.id, { onDelete: 'restrict' }),
    // Asistencia (en goles) o jugador que entra (en cambios).
    relatedPlayerId: uuid('related_player_id').references(() => players.id, { onDelete: 'restrict' }),
    // Nombre libre para jugadores rivales.
    freeTextName: text('free_text_name'),
    comment: text('comment'),
    // Idempotencia de la consola en vivo (7.3): el servidor ignora duplicados.
    clientEventId: uuid('client_event_id').notNull().default(sql`uuidv7()`),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('match_events_client_event_id_uq').on(table.clientEventId),
    index('match_events_match_minute_idx').on(table.matchId, table.minute),
    index('match_events_team_id_idx').on(table.teamId),
    index('match_events_player_id_idx').on(table.playerId),
    index('match_events_related_player_id_idx').on(table.relatedPlayerId),
    index('match_events_created_by_idx').on(table.createdBy),
    check(
      'match_events_minute_check',
      sql`coalesce(${table.minute}, 0) >= 0 AND coalesce(${table.stoppageMinute}, 0) >= 0`,
    ),
    check('match_events_comment_check', sql`length(coalesce(${table.comment}, '')) <= 280`),
    // Todo evento que no sea un comentario pertenece a un equipo.
    check('match_events_team_check', sql`${table.type} = 'comentario' OR ${table.teamId} IS NOT NULL`),
  ],
)

export const matchLineups = pgTable(
  'match_lineups',
  {
    id: id(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    role: lineupRole('role').notNull().default('titular'),
    shirtNumber: smallint('shirt_number'),
    played: boolean('played').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('match_lineups_match_player_uq').on(table.matchId, table.playerId),
    index('match_lineups_player_id_idx').on(table.playerId),
  ],
)

export const squadRegistrations = pgTable(
  'squad_registrations',
  {
    id: id(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'restrict' }),
    shirtNumber: smallint('shirt_number'),
    isCaptain: boolean('is_captain').notNull().default(false),
    status: registrationStatus('status').notNull().default('activo'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('squad_registrations_player_season_series_uq').on(
      table.playerId,
      table.seasonId,
      table.seriesId,
    ),
    // Número de camiseta único por temporada y serie (8.6).
    uniqueIndex('squad_registrations_shirt_uq')
      .on(table.seasonId, table.seriesId, table.shirtNumber)
      .where(sql`${table.shirtNumber} IS NOT NULL`),
    index('squad_registrations_series_id_idx').on(table.seriesId),
    check(
      'squad_registrations_shirt_check',
      sql`${table.shirtNumber} IS NULL OR ${table.shirtNumber} BETWEEN 1 AND 99`,
    ),
  ],
)

export const staffMembers = pgTable(
  'staff_members',
  {
    id: id(),
    fullName: text('full_name').notNull(),
    photoMediaId: uuid('photo_media_id').references(() => mediaAssets.id, { onDelete: 'restrict' }),
    bio: text('bio'),
    ...timestamps(),
  },
  (table) => [index('staff_members_photo_media_id_idx').on(table.photoMediaId)],
)

export const staffAssignments = pgTable(
  'staff_assignments',
  {
    id: id(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffMembers.id, { onDelete: 'cascade' }),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'restrict' }),
    role: staffRole('role').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('staff_assignments_uq').on(table.staffId, table.seasonId, table.seriesId, table.role),
    index('staff_assignments_season_series_idx').on(table.seasonId, table.seriesId),
    index('staff_assignments_series_id_idx').on(table.seriesId),
  ],
)

/** Estadísticas históricas sin crear partidos ficticios: se suman en `v_player_season_stats`. */
export const playerStatAdjustments = pgTable(
  'player_stat_adjustments',
  {
    id: id(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    seasonId: uuid('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'restrict' }),
    appearances: integer('appearances').notNull().default(0),
    goals: integer('goals').notNull().default(0),
    yellowCards: integer('yellow_cards').notNull().default(0),
    redCards: integer('red_cards').notNull().default(0),
    note: text('note'),
    ...timestamps(),
  },
  (table) => [
    index('player_stat_adjustments_player_idx').on(table.playerId, table.seasonId, table.seriesId),
    index('player_stat_adjustments_season_id_idx').on(table.seasonId),
    index('player_stat_adjustments_series_id_idx').on(table.seriesId),
  ],
)

export const standingsTables = pgTable(
  'standings_tables',
  {
    id: id(),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'restrict' }),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'restrict' }),
    // Cadena vacía = tabla única (sin grupos); así la unicidad no depende de NULL.
    groupLabel: text('group_label').notNull().default(''),
    mode: standingsMode('mode').notNull().default('manual'),
    asOf: date('as_of'),
    sourceNote: text('source_note'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('standings_tables_uq').on(table.competitionId, table.seriesId, table.groupLabel),
    index('standings_tables_series_id_idx').on(table.seriesId),
  ],
)

/** Filas de una tabla manual. Los puntos se calculan con `points_win` / `points_draw` de la competencia. */
export const standingsRows = pgTable(
  'standings_rows',
  {
    id: id(),
    tableId: uuid('table_id')
      .notNull()
      .references(() => standingsTables.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    // Ajuste manual de posición (desempate final).
    position: smallint('position'),
    won: smallint('won').notNull().default(0),
    drawn: smallint('drawn').notNull().default(0),
    lost: smallint('lost').notNull().default(0),
    goalsFor: smallint('goals_for').notNull().default(0),
    goalsAgainst: smallint('goals_against').notNull().default(0),
    pointsAdjustment: smallint('points_adjustment').notNull().default(0),
    note: text('note'),
    played: smallint('played').generatedAlwaysAs(sql`won + drawn + lost`),
    goalDiff: smallint('goal_diff').generatedAlwaysAs(sql`goals_for - goals_against`),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('standings_rows_table_team_uq').on(table.tableId, table.teamId),
    index('standings_rows_team_id_idx').on(table.teamId),
    check(
      'standings_rows_counts_check',
      sql`${table.won} >= 0 AND ${table.drawn} >= 0 AND ${table.lost} >= 0 AND ${table.goalsFor} >= 0 AND ${table.goalsAgainst} >= 0`,
    ),
  ],
)

export const trainingSchedules = pgTable(
  'training_schedules',
  {
    id: id(),
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    // 1 = lunes … 7 = domingo.
    weekday: smallint('weekday').notNull(),
    startsAt: time('starts_at').notNull(),
    endsAt: time('ends_at').notNull(),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'restrict' }),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (table) => [
    index('training_schedules_series_id_idx').on(table.seriesId),
    index('training_schedules_venue_id_idx').on(table.venueId),
    check('training_schedules_weekday_check', sql`${table.weekday} BETWEEN 1 AND 7`),
    check('training_schedules_time_check', sql`${table.endsAt} > ${table.startsAt}`),
  ],
)

/**
 * Estadísticas por jugador, temporada y serie (8.6). La vista se crea en una migración SQL escrita a mano
 * (`drizzle/0002_vista_estadisticas.sql`); aquí solo se declara su forma para tipar las consultas.
 */
export const playerSeasonStats = pgView('v_player_season_stats', {
  playerId: uuid('player_id').notNull(),
  seasonId: uuid('season_id').notNull(),
  seriesId: uuid('series_id').notNull(),
  appearances: integer('appearances').notNull(),
  goals: integer('goals').notNull(),
  yellowCards: integer('yellow_cards').notNull(),
  redCards: integer('red_cards').notNull(),
}).existing()
