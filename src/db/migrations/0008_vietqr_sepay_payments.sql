CREATE TABLE "unmatched_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"gateway" varchar(50) DEFAULT 'SEPAY' NOT NULL,
	"gateway_transaction_id" varchar(100),
	"amount" integer NOT NULL,
	"content" varchar(255),
	"transfer_type" varchar(20) DEFAULT 'IN',
	"order_code" varchar(50),
	"order_id" integer,
	"reason" varchar(255) NOT NULL,
	"raw_payload" text,
	"status" varchar(20) DEFAULT 'UNRESOLVED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" integer,
	"resolution_notes" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_status_check";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "qr_content" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "sepay_transaction_id" varchar(100);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "unmatched_transactions" ADD CONSTRAINT "unmatched_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unmatched_transactions" ADD CONSTRAINT "unmatched_transactions_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unmatched_tx_gateway_id_idx" ON "unmatched_transactions" USING btree ("gateway_transaction_id");--> statement-breakpoint
CREATE INDEX "unmatched_tx_order_code_idx" ON "unmatched_transactions" USING btree ("order_code");--> statement-breakpoint
CREATE INDEX "unmatched_tx_order_id_idx" ON "unmatched_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_sepay_tx_unique" ON "payments" USING btree ("sepay_transaction_id") WHERE sepay_transaction_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('PENDING', 'SUCCESS', 'FAILED', 'VOIDED', 'EXPIRED'));