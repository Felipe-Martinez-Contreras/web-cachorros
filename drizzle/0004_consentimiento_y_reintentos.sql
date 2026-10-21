ALTER TABLE "contact_messages" ADD COLUMN "privacy_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "privacy_policy_version" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "notify_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_requests" ADD COLUMN "notify_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsorship_inquiries" ADD COLUMN "privacy_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sponsorship_inquiries" ADD COLUMN "privacy_policy_version" text;--> statement-breakpoint
ALTER TABLE "sponsorship_inquiries" ADD COLUMN "notify_attempts" integer DEFAULT 0 NOT NULL;