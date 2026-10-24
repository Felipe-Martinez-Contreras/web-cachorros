CREATE TYPE "public"."publication_kind" AS ENUM('programacion', 'proximo', 'resultado');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('pendiente', 'publicando', 'publicado', 'error', 'incierto', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."publication_trigger" AS ENUM('automatica', 'manual');--> statement-breakpoint
CREATE TYPE "public"."social_channel" AS ENUM('facebook', 'instagram');--> statement-breakpoint
CREATE TABLE "social_publications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"channel" "social_channel" NOT NULL,
	"kind" "publication_kind" NOT NULL,
	"subject_key" text NOT NULL,
	"match_id" uuid,
	"weekend" date,
	"trigger" "publication_trigger" NOT NULL,
	"message" text,
	"image_version" text,
	"status" "publication_status" DEFAULT 'pendiente' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"external_id" text,
	"external_url" text,
	"requested_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_publications_attempts_check" CHECK ("social_publications"."attempts" between 0 and 20)
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "social_publishing" jsonb;--> statement-breakpoint
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_publications" ADD CONSTRAINT "social_publications_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_publications_subject_uq" ON "social_publications" USING btree ("channel","kind","subject_key");--> statement-breakpoint
CREATE INDEX "social_publications_status_next_idx" ON "social_publications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "social_publications_match_id_idx" ON "social_publications" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "social_publications_requested_by_idx" ON "social_publications" USING btree ("requested_by");