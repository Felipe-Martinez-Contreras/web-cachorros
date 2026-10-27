CREATE TYPE "public"."crest_card_style" AS ENUM('color', 'blanco', 'grises');--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "focal_zoom" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "card_crest_style" "crest_card_style" DEFAULT 'color' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_focal_zoom_check" CHECK ("media_assets"."focal_zoom" BETWEEN 1 AND 2.5);