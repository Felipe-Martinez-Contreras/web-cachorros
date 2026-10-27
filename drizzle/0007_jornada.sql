ALTER TYPE "public"."publication_kind" ADD VALUE 'jornada';--> statement-breakpoint
ALTER TABLE "social_publications" ADD COLUMN "series_ids" jsonb;