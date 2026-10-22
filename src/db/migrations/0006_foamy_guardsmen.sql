ALTER TABLE "payments" DROP CONSTRAINT "payments_status_check";--> statement-breakpoint
ALTER TABLE "print_jobs" DROP CONSTRAINT "print_jobs_job_type_check";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "queue_number" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "queue_date" varchar(10);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voided_by_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "void_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_queue_date_number_unique" ON "orders" USING btree ("queue_date","queue_number") WHERE queue_number IS NOT NULL AND queue_date IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('PENDING', 'SUCCESS', 'FAILED', 'VOIDED'));--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_job_type_check" CHECK ("print_jobs"."job_type" IN ('KOT_KITCHEN', 'KOT_BAR', 'RECEIPT_TEMP', 'RECEIPT_FINAL', 'Z_REPORT', 'CASH_RECEIPT', 'PICKUP_TICKET'));