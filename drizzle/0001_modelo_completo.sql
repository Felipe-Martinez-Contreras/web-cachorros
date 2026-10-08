CREATE TYPE "public"."club_side" AS ENUM('local', 'visita', 'ninguno');--> statement-breakpoint
CREATE TYPE "public"."competition_kind" AS ENUM('liga', 'copa', 'regional', 'nacional', 'amistoso', 'verano');--> statement-breakpoint
CREATE TYPE "public"."contact_topic" AS ENUM('general', 'socios', 'auspicios', 'formativas', 'prensa', 'historia');--> statement-breakpoint
CREATE TYPE "public"."date_precision" AS ENUM('dia', 'mes', 'anio');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('acta', 'balance', 'rendicion', 'estatutos', 'reglamento', 'memoria', 'otro');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('programado', 'realizado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('completada', 'bingo', 'rifa', 'aniversario', 'campeonato_verano', 'asamblea', 'actividad_social', 'otro');--> statement-breakpoint
CREATE TYPE "public"."fee_period" AS ENUM('mensual', 'trimestral', 'semestral', 'anual', 'unico');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('nueva', 'en_revision', 'respondida', 'aprobada', 'rechazada', 'archivada');--> statement-breakpoint
CREATE TYPE "public"."lineup_role" AS ENUM('titular', 'suplente');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('gol', 'gol_penal', 'autogol', 'penal_errado', 'tarjeta_amarilla', 'segunda_amarilla', 'tarjeta_roja', 'cambio', 'comentario');--> statement-breakpoint
CREATE TYPE "public"."match_period" AS ENUM('previa', 'primer_tiempo', 'entretiempo', 'segundo_tiempo', 'alargue', 'penales', 'terminado');--> statement-breakpoint
CREATE TYPE "public"."match_resolution" AS ENUM('normal', 'penales', 'walkover', 'secretaria');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('programado', 'en_vivo', 'finalizado', 'suspendido', 'postergado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('imagen', 'documento');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('activo', 'suspendido', 'baja');--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('borrador', 'programada', 'publicada', 'archivada');--> statement-breakpoint
CREATE TYPE "public"."news_type" AS ENUM('noticia', 'cronica', 'comunicado', 'entrevista', 'galeria');--> statement-breakpoint
CREATE TYPE "public"."player_position" AS ENUM('arquero', 'defensa', 'mediocampista', 'delantero');--> statement-breakpoint
CREATE TYPE "public"."position_detail" AS ENUM('central', 'lateral_derecho', 'lateral_izquierdo', 'volante_contencion', 'volante_mixto', 'volante_creativo', 'extremo_derecho', 'extremo_izquierdo', 'centrodelantero');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('activo', 'lesionado', 'baja');--> statement-breakpoint
CREATE TYPE "public"."series_kind" AS ENUM('adulta', 'senior', 'juvenil', 'formativa');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('instagram', 'facebook', 'tiktok', 'youtube', 'x');--> statement-breakpoint
CREATE TYPE "public"."sponsor_tier" AS ENUM('principal', 'oficial', 'colaborador');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('director_tecnico', 'ayudante_tecnico', 'preparador_fisico', 'preparador_arqueros', 'kinesiologo', 'delegado', 'utilero', 'coordinador_formativas');--> statement-breakpoint
CREATE TYPE "public"."standings_mode" AS ENUM('manual', 'calculada');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('youtube', 'facebook');--> statement-breakpoint
CREATE TABLE "board_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"full_name" text NOT NULL,
	"role_title" text NOT NULL,
	"photo_media_id" uuid,
	"public_email" text,
	"term_start" date,
	"term_end" date,
	"is_current" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone_e164" text,
	"topic" "contact_topic" DEFAULT 'general' NOT NULL,
	"message" text NOT NULL,
	"status" "inbox_status" DEFAULT 'nueva' NOT NULL,
	"internal_notes" text,
	"notified_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"category" "document_category" NOT NULL,
	"period_label" text,
	"document_date" date,
	"file_media_id" uuid NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"type" "event_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location_text" text,
	"venue_id" uuid,
	"poster_media_id" uuid,
	"description" jsonb,
	"price_text" text,
	"cta_url" text,
	"status" "event_status" DEFAULT 'programado' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_ends_at_check" CHECK ("events"."ends_at" IS NULL OR "events"."ends_at" >= "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_number" integer GENERATED BY DEFAULT AS IDENTITY (sequence name "members_member_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"full_name" text NOT NULL,
	"rut" text,
	"email" text,
	"phone_e164" text,
	"plan_id" uuid,
	"status" "member_status" DEFAULT 'activo' NOT NULL,
	"joined_on" date DEFAULT now() NOT NULL,
	"user_id" text,
	"qr_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"fee_clp" integer NOT NULL,
	"fee_period" "fee_period" NOT NULL,
	"benefits" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_plans_fee_check" CHECK ("membership_plans"."fee_clp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"full_name" text NOT NULL,
	"rut" text,
	"email" text NOT NULL,
	"phone_e164" text,
	"commune" text,
	"plan_id" uuid,
	"message" text,
	"privacy_consent_at" timestamp with time zone NOT NULL,
	"privacy_policy_version" text NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"status" "inbox_status" DEFAULT 'nueva' NOT NULL,
	"internal_notes" text,
	"handled_by" text,
	"member_id" uuid,
	"notified_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"size_label" text NOT NULL,
	"stock" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_stock_check" CHECK ("product_variants"."stock" IS NULL OR "product_variants"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid,
	"description" text,
	"price_clp" integer NOT NULL,
	"compare_at_price_clp" integer,
	"track_stock" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_check" CHECK ("products"."price_clp" >= 0),
	CONSTRAINT "products_compare_at_price_check" CHECK ("products"."compare_at_price_clp" IS NULL OR "products"."compare_at_price_clp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sponsor_clicks_daily" (
	"sponsor_id" uuid NOT NULL,
	"day" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sponsor_clicks_daily_sponsor_id_day_pk" PRIMARY KEY("sponsor_id","day"),
	CONSTRAINT "sponsor_clicks_daily_clicks_check" CHECK ("sponsor_clicks_daily"."clicks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tier" "sponsor_tier" NOT NULL,
	"logo_media_id" uuid,
	"description" text,
	"website_url" text,
	"instagram_url" text,
	"whatsapp_e164" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsorship_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_e164" text,
	"tier_interest" "sponsor_tier",
	"message" text,
	"status" "inbox_status" DEFAULT 'nueva' NOT NULL,
	"internal_notes" text,
	"notified_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"album_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"taken_on" date,
	"cover_media_id" uuid,
	"match_id" uuid,
	"event_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"contains_minors" boolean DEFAULT false NOT NULL,
	"minors_consent_confirmed_by" text,
	"minors_consent_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "albums_minors_consent_check" CHECK (NOT ("albums"."is_published" AND "albums"."contains_minors" AND "albums"."minors_consent_confirmed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "hall_of_fame" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"full_name" text NOT NULL,
	"nickname" text,
	"era_label" text,
	"position" text,
	"bio" text,
	"photo_media_id" uuid,
	"player_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historic_kits" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"year_from" smallint,
	"year_to" smallint,
	"description" text NOT NULL,
	"image_media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_milestones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"occurred_on" date NOT NULL,
	"date_precision" date_precision DEFAULT 'anio' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"image_media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "honours" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"year" smallint,
	"series_id" uuid,
	"competition_name" text,
	"description" text,
	"image_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"type" "news_type" DEFAULT 'noticia' NOT NULL,
	"excerpt" text,
	"body" jsonb,
	"body_text" text,
	"cover_media_id" uuid,
	"category_id" uuid,
	"status" "news_status" DEFAULT 'borrador' NOT NULL,
	"published_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"author_id" text,
	"match_id" uuid,
	"album_id" uuid,
	"seo_title" text,
	"seo_description" text,
	"og_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_cronica_match_check" CHECK ("news"."type" <> 'cronica' OR "news"."match_id" IS NOT NULL),
	CONSTRAINT "news_galeria_album_check" CHECK ("news"."type" <> 'galeria' OR "news"."album_id" IS NOT NULL),
	CONSTRAINT "news_published_at_check" CHECK ("news"."status" NOT IN ('publicada', 'programada') OR "news"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "news_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_series" (
	"news_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	CONSTRAINT "news_series_news_id_series_id_pk" PRIMARY KEY("news_id","series_id")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"platform" "social_platform" NOT NULL,
	"permalink" text NOT NULL,
	"image_media_id" uuid,
	"excerpt" text,
	"posted_on" date,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"provider" "video_provider" NOT NULL,
	"url" text NOT NULL,
	"external_id" text,
	"thumbnail_media_id" uuid,
	"published_on" date,
	"match_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" "media_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"variants" jsonb,
	"lqip" text,
	"alt_text" text,
	"credit" text,
	"focal_x" real DEFAULT 0.5 NOT NULL,
	"focal_y" real DEFAULT 0.5 NOT NULL,
	"contains_minors" boolean DEFAULT false NOT NULL,
	"minors_consent_confirmed_at" timestamp with time zone,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_bytes_check" CHECK ("media_assets"."bytes" >= 0),
	CONSTRAINT "media_assets_alt_text_check" CHECK ("media_assets"."kind" <> 'imagen' OR length(btrim(coalesce("media_assets"."alt_text", ''))) > 0),
	CONSTRAINT "media_assets_focal_check" CHECK ("media_assets"."focal_x" BETWEEN 0 AND 1 AND "media_assets"."focal_y" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "competition_kind" DEFAULT 'liga' NOT NULL,
	"organizer" text,
	"points_win" smallint DEFAULT 3 NOT NULL,
	"points_draw" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_points_check" CHECK ("competitions"."points_win" >= 0 AND "competitions"."points_draw" >= 0)
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"match_id" uuid NOT NULL,
	"type" "match_event_type" NOT NULL,
	"period" "match_period" NOT NULL,
	"minute" smallint,
	"stoppage_minute" smallint,
	"team_id" uuid,
	"player_id" uuid,
	"related_player_id" uuid,
	"free_text_name" text,
	"comment" text,
	"client_event_id" uuid DEFAULT uuidv7() NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_events_minute_check" CHECK (coalesce("match_events"."minute", 0) >= 0 AND coalesce("match_events"."stoppage_minute", 0) >= 0),
	CONSTRAINT "match_events_comment_check" CHECK (length(coalesce("match_events"."comment", '')) <= 280),
	CONSTRAINT "match_events_team_check" CHECK ("match_events"."type" = 'comentario' OR "match_events"."team_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "match_lineups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" "lineup_role" DEFAULT 'titular' NOT NULL,
	"shirt_number" smallint,
	"played" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"season_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"round_number" smallint,
	"round_label" text,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"venue_id" uuid,
	"kickoff_at" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'programado' NOT NULL,
	"period" "match_period" DEFAULT 'previa' NOT NULL,
	"period_started_at" timestamp with time zone,
	"home_score" smallint DEFAULT 0 NOT NULL,
	"away_score" smallint DEFAULT 0 NOT NULL,
	"home_penalties" smallint,
	"away_penalties" smallint,
	"resolution" "match_resolution" DEFAULT 'normal' NOT NULL,
	"score_locked" boolean DEFAULT false NOT NULL,
	"club_side" "club_side" DEFAULT 'ninguno' NOT NULL,
	"slug" text NOT NULL,
	"report" jsonb,
	"album_id" uuid,
	"share_version" integer DEFAULT 1 NOT NULL,
	"finished_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_distinct_teams_check" CHECK ("matches"."home_team_id" <> "matches"."away_team_id"),
	CONSTRAINT "matches_score_check" CHECK ("matches"."home_score" >= 0 AND "matches"."away_score" >= 0),
	CONSTRAINT "matches_penalties_check" CHECK (coalesce("matches"."home_penalties", 0) >= 0 AND coalesce("matches"."away_penalties", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_stat_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"appearances" integer DEFAULT 0 NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"yellow_cards" integer DEFAULT 0 NOT NULL,
	"red_cards" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"nickname" text,
	"slug" text NOT NULL,
	"birth_date" date,
	"photo_media_id" uuid,
	"primary_position" "player_position" NOT NULL,
	"position_detail" "position_detail",
	"bio" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_name" text NOT NULL,
	"kind" "series_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"contains_minors" boolean DEFAULT false NOT NULL,
	"half_length_minutes" smallint DEFAULT 45 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_half_length_check" CHECK ("series"."half_length_minutes" BETWEEN 5 AND 60)
);
--> statement-breakpoint
CREATE TABLE "squad_registrations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"shirt_number" smallint,
	"is_captain" boolean DEFAULT false NOT NULL,
	"status" "registration_status" DEFAULT 'activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "squad_registrations_shirt_check" CHECK ("squad_registrations"."shirt_number" IS NULL OR "squad_registrations"."shirt_number" BETWEEN 1 AND 99)
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"staff_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"full_name" text NOT NULL,
	"photo_media_id" uuid,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standings_rows" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"table_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"position" smallint,
	"won" smallint DEFAULT 0 NOT NULL,
	"drawn" smallint DEFAULT 0 NOT NULL,
	"lost" smallint DEFAULT 0 NOT NULL,
	"goals_for" smallint DEFAULT 0 NOT NULL,
	"goals_against" smallint DEFAULT 0 NOT NULL,
	"points_adjustment" smallint DEFAULT 0 NOT NULL,
	"note" text,
	"played" smallint GENERATED ALWAYS AS (won + drawn + lost) STORED,
	"goal_diff" smallint GENERATED ALWAYS AS (goals_for - goals_against) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standings_rows_counts_check" CHECK ("standings_rows"."won" >= 0 AND "standings_rows"."drawn" >= 0 AND "standings_rows"."lost" >= 0 AND "standings_rows"."goals_for" >= 0 AND "standings_rows"."goals_against" >= 0)
);
--> statement-breakpoint
CREATE TABLE "standings_tables" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"competition_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"group_label" text DEFAULT '' NOT NULL,
	"mode" "standings_mode" DEFAULT 'manual' NOT NULL,
	"as_of" date,
	"source_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"slug" text NOT NULL,
	"crest_media_id" uuid,
	"commune" text,
	"is_own_club" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_schedules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"series_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"venue_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_schedules_weekday_check" CHECK ("training_schedules"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "training_schedules_time_check" CHECK ("training_schedules"."ends_at" > "training_schedules"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"commune" text,
	"geo_lat" double precision,
	"geo_lng" double precision,
	"is_home" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_blocks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"title" text,
	"body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"entity_type" text NOT NULL,
	"old_slug" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "featured_series_id" uuid;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "share_card_sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_media_id_media_assets_id_fk" FOREIGN KEY ("file_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_poster_media_id_media_assets_id_fk" FOREIGN KEY ("poster_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_clicks_daily" ADD CONSTRAINT "sponsor_clicks_daily_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_items" ADD CONSTRAINT "album_items_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_items" ADD CONSTRAINT "album_items_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_minors_consent_confirmed_by_user_id_fk" FOREIGN KEY ("minors_consent_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hall_of_fame" ADD CONSTRAINT "hall_of_fame_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hall_of_fame" ADD CONSTRAINT "hall_of_fame_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historic_kits" ADD CONSTRAINT "historic_kits_image_media_id_media_assets_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_milestones" ADD CONSTRAINT "history_milestones_image_media_id_media_assets_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honours" ADD CONSTRAINT "honours_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honours" ADD CONSTRAINT "honours_image_media_id_media_assets_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_category_id_news_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."news_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_series" ADD CONSTRAINT "news_series_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_series" ADD CONSTRAINT "news_series_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_image_media_id_media_assets_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_thumbnail_media_id_media_assets_id_fk" FOREIGN KEY ("thumbnail_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_related_player_id_players_id_fk" FOREIGN KEY ("related_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stat_adjustments" ADD CONSTRAINT "player_stat_adjustments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stat_adjustments" ADD CONSTRAINT "player_stat_adjustments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stat_adjustments" ADD CONSTRAINT "player_stat_adjustments_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_registrations" ADD CONSTRAINT "squad_registrations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_registrations" ADD CONSTRAINT "squad_registrations_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "squad_registrations" ADD CONSTRAINT "squad_registrations_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_rows" ADD CONSTRAINT "standings_rows_table_id_standings_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."standings_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_rows" ADD CONSTRAINT "standings_rows_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_tables" ADD CONSTRAINT "standings_tables_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_tables" ADD CONSTRAINT "standings_tables_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_crest_media_id_media_assets_id_fk" FOREIGN KEY ("crest_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_schedules" ADD CONSTRAINT "training_schedules_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_schedules" ADD CONSTRAINT "training_schedules_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_members_photo_media_id_idx" ON "board_members" USING btree ("photo_media_id");--> statement-breakpoint
CREATE INDEX "contact_messages_status_created_idx" ON "contact_messages" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_file_media_id_idx" ON "documents" USING btree ("file_media_id");--> statement-breakpoint
CREATE INDEX "documents_category_date_idx" ON "documents" USING btree ("category","document_date" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uq" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "events_venue_id_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "events_poster_media_id_idx" ON "events" USING btree ("poster_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_number_uq" ON "members" USING btree ("member_number");--> statement-breakpoint
CREATE UNIQUE INDEX "members_qr_token_uq" ON "members" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "members_plan_id_idx" ON "members" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "members_user_id_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_requests_status_created_idx" ON "membership_requests" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "membership_requests_plan_id_idx" ON "membership_requests" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "membership_requests_handled_by_idx" ON "membership_requests" USING btree ("handled_by");--> statement-breakpoint
CREATE INDEX "membership_requests_member_id_idx" ON "membership_requests" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_uq" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_media_uq" ON "product_images" USING btree ("product_id","media_id");--> statement-breakpoint
CREATE INDEX "product_images_media_id_idx" ON "product_images" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_product_size_uq" ON "product_variants" USING btree ("product_id","size_label");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uq" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsors_slug_uq" ON "sponsors" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sponsors_logo_media_id_idx" ON "sponsors" USING btree ("logo_media_id");--> statement-breakpoint
CREATE INDEX "sponsorship_inquiries_status_created_idx" ON "sponsorship_inquiries" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "album_items_album_media_uq" ON "album_items" USING btree ("album_id","media_id");--> statement-breakpoint
CREATE INDEX "album_items_media_id_idx" ON "album_items" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "albums_slug_uq" ON "albums" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "albums_cover_media_id_idx" ON "albums" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "albums_match_id_idx" ON "albums" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "albums_event_id_idx" ON "albums" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "albums_minors_consent_confirmed_by_idx" ON "albums" USING btree ("minors_consent_confirmed_by");--> statement-breakpoint
CREATE INDEX "hall_of_fame_photo_media_id_idx" ON "hall_of_fame" USING btree ("photo_media_id");--> statement-breakpoint
CREATE INDEX "hall_of_fame_player_id_idx" ON "hall_of_fame" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "historic_kits_image_media_id_idx" ON "historic_kits" USING btree ("image_media_id");--> statement-breakpoint
CREATE INDEX "history_milestones_occurred_on_idx" ON "history_milestones" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "history_milestones_image_media_id_idx" ON "history_milestones" USING btree ("image_media_id");--> statement-breakpoint
CREATE INDEX "honours_series_id_idx" ON "honours" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "honours_image_media_id_idx" ON "honours" USING btree ("image_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_slug_uq" ON "news" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_status_published_at_idx" ON "news" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "news_cover_media_id_idx" ON "news" USING btree ("cover_media_id");--> statement-breakpoint
CREATE INDEX "news_category_id_idx" ON "news" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "news_author_id_idx" ON "news" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "news_match_id_idx" ON "news" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "news_album_id_idx" ON "news" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "news_og_media_id_idx" ON "news" USING btree ("og_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_categories_slug_uq" ON "news_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_series_series_id_idx" ON "news_series" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "social_posts_image_media_id_idx" ON "social_posts" USING btree ("image_media_id");--> statement-breakpoint
CREATE INDEX "videos_thumbnail_media_id_idx" ON "videos" USING btree ("thumbnail_media_id");--> statement-breakpoint
CREATE INDEX "videos_match_id_idx" ON "videos" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_uq" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "media_assets_uploaded_by_idx" ON "media_assets" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_season_name_uq" ON "competitions" USING btree ("season_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "match_events_client_event_id_uq" ON "match_events" USING btree ("client_event_id");--> statement-breakpoint
CREATE INDEX "match_events_match_minute_idx" ON "match_events" USING btree ("match_id","minute");--> statement-breakpoint
CREATE INDEX "match_events_team_id_idx" ON "match_events" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "match_events_player_id_idx" ON "match_events" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "match_events_related_player_id_idx" ON "match_events" USING btree ("related_player_id");--> statement-breakpoint
CREATE INDEX "match_events_created_by_idx" ON "match_events" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "match_lineups_match_player_uq" ON "match_lineups" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE INDEX "match_lineups_player_id_idx" ON "match_lineups" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_slug_uq" ON "matches" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "matches_series_season_kickoff_idx" ON "matches" USING btree ("series_id","season_id","kickoff_at");--> statement-breakpoint
CREATE INDEX "matches_live_idx" ON "matches" USING btree ("status") WHERE "matches"."status" = 'en_vivo';--> statement-breakpoint
CREATE INDEX "matches_kickoff_at_idx" ON "matches" USING btree ("kickoff_at");--> statement-breakpoint
CREATE INDEX "matches_season_id_idx" ON "matches" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "matches_competition_id_idx" ON "matches" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "matches_home_team_id_idx" ON "matches" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "matches_away_team_id_idx" ON "matches" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX "matches_venue_id_idx" ON "matches" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "matches_album_id_idx" ON "matches" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "player_stat_adjustments_player_idx" ON "player_stat_adjustments" USING btree ("player_id","season_id","series_id");--> statement-breakpoint
CREATE INDEX "player_stat_adjustments_season_id_idx" ON "player_stat_adjustments" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "player_stat_adjustments_series_id_idx" ON "player_stat_adjustments" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_slug_uq" ON "players" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "players_photo_media_id_idx" ON "players" USING btree ("photo_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_name_uq" ON "seasons" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_current_uq" ON "seasons" USING btree ("is_current") WHERE "seasons"."is_current";--> statement-breakpoint
CREATE UNIQUE INDEX "series_slug_uq" ON "series" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "squad_registrations_player_season_series_uq" ON "squad_registrations" USING btree ("player_id","season_id","series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "squad_registrations_shirt_uq" ON "squad_registrations" USING btree ("season_id","series_id","shirt_number") WHERE "squad_registrations"."shirt_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "squad_registrations_series_id_idx" ON "squad_registrations" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_assignments_uq" ON "staff_assignments" USING btree ("staff_id","season_id","series_id","role");--> statement-breakpoint
CREATE INDEX "staff_assignments_season_series_idx" ON "staff_assignments" USING btree ("season_id","series_id");--> statement-breakpoint
CREATE INDEX "staff_assignments_series_id_idx" ON "staff_assignments" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "staff_members_photo_media_id_idx" ON "staff_members" USING btree ("photo_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standings_rows_table_team_uq" ON "standings_rows" USING btree ("table_id","team_id");--> statement-breakpoint
CREATE INDEX "standings_rows_team_id_idx" ON "standings_rows" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standings_tables_uq" ON "standings_tables" USING btree ("competition_id","series_id","group_label");--> statement-breakpoint
CREATE INDEX "standings_tables_series_id_idx" ON "standings_tables" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_slug_uq" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_own_club_uq" ON "teams" USING btree ("is_own_club") WHERE "teams"."is_own_club";--> statement-breakpoint
CREATE INDEX "teams_crest_media_id_idx" ON "teams" USING btree ("crest_media_id");--> statement-breakpoint
CREATE INDEX "training_schedules_series_id_idx" ON "training_schedules" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "training_schedules_venue_id_idx" ON "training_schedules" USING btree ("venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_blocks_key_uq" ON "page_blocks" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_redirects_type_slug_uq" ON "slug_redirects" USING btree ("entity_type","old_slug");--> statement-breakpoint
CREATE INDEX "slug_redirects_entity_idx" ON "slug_redirects" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_featured_series_id_series_id_fk" FOREIGN KEY ("featured_series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_share_card_sponsor_id_sponsors_id_fk" FOREIGN KEY ("share_card_sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_settings_featured_series_id_idx" ON "site_settings" USING btree ("featured_series_id");--> statement-breakpoint
CREATE INDEX "site_settings_share_card_sponsor_id_idx" ON "site_settings" USING btree ("share_card_sponsor_id");