ALTER TABLE "users" ADD COLUMN "login_failed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_percent_check" CHECK ("orders"."discount_percent" IS NULL OR ("orders"."discount_percent" >= 0 AND "orders"."discount_percent" <= 100));