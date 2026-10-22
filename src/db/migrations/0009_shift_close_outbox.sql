-- Clear outbox table before schema alterations (outbox was unused prior to Phase 09 and schema is being redesigned)
DELETE FROM "outbox";--> statement-breakpoint
ALTER TABLE "outbox" ALTER COLUMN "payload" SET DATA TYPE jsonb USING "payload"::jsonb;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "type" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "outbox_type_idx" ON "outbox" USING btree ("type");--> statement-breakpoint
CREATE INDEX "outbox_next_attempt_at_idx" ON "outbox" USING btree ("next_attempt_at");--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "event_type";--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "aggregate_id";--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "retry_count";--> statement-breakpoint
ALTER TABLE "outbox" DROP COLUMN "processed_at";--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_idempotency_key_unique" UNIQUE("idempotency_key");
