ALTER TYPE "public"."publication_status" ADD VALUE 'programada';--> statement-breakpoint
ALTER TABLE "social_publications" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_publications" ADD COLUMN "scheduled_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "social_publications" ADD COLUMN "discard_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_publications" ADD COLUMN "discard_notify_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "social_publications_status_scheduled_idx" ON "social_publications" USING btree ("status","scheduled_at");