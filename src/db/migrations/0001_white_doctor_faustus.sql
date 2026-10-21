ALTER TABLE "cash_entries" ALTER COLUMN "performed_by" SET DATA TYPE integer USING (CASE WHEN performed_by ~ '^[0-9]+$' THEN performed_by::integer ELSE 1 END);--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_entries_shift_id_idx" ON "cash_entries" USING btree ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_cashier_active_unique" ON "shifts" USING btree ("cashier_id") WHERE status = 'DANG_MO';--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_table_active_unique" ON "orders" USING btree ("table_id") WHERE status = 'DANG_PHUC_VU' AND table_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_shift_id_idx" ON "orders" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "orders_table_id_idx" ON "orders" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "print_jobs_status_idx" ON "print_jobs" USING btree ("status");--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_area_id_name_unique" UNIQUE("area_id","name");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('QUAN_LY', 'THU_NGAN', 'PHUC_VU'));--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_capacity_check" CHECK ("tables"."capacity" > 0);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_status_check" CHECK ("tables"."status" IN ('TRONG', 'DANG_DUNG', 'CHO_THANH_TOAN'));--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_price_check" CHECK ("menu_items"."price" >= 0);--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_status_check" CHECK ("menu_items"."status" IN ('DANG_BAN', 'HET_HANG'));--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_target_printer_check" CHECK ("menu_items"."target_printer" IN ('KITCHEN', 'BAR'));--> statement-breakpoint
ALTER TABLE "toppings" ADD CONSTRAINT "toppings_price_check" CHECK ("toppings"."price" >= 0);--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_entry_type_check" CHECK ("cash_entries"."entry_type" IN ('THU', 'CHI'));--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_amount_check" CHECK ("cash_entries"."amount" > 0);--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_initial_cash_check" CHECK ("shifts"."initial_cash" >= 0);--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_status_check" CHECK ("shifts"."status" IN ('DANG_MO', 'CHO_DUYET', 'DA_DONG'));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_check" CHECK ("order_items"."unit_price" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_type_check" CHECK ("orders"."order_type" IN ('TAI_BAN', 'MANG_VE'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('DANG_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_amount_check" CHECK ("orders"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_amount_check" CHECK ("orders"."discount_amount" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_final_amount_check" CHECK ("orders"."final_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_check" CHECK ("payments"."payment_method" IN ('TIEN_MAT', 'VIETQR'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('PENDING', 'SUCCESS', 'FAILED'));--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_status_check" CHECK ("outbox"."status" IN ('PENDING', 'SENT', 'FAILED'));--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_job_type_check" CHECK ("print_jobs"."job_type" IN ('KOT_KITCHEN', 'KOT_BAR', 'RECEIPT_TEMP', 'RECEIPT_FINAL', 'Z_REPORT'));--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_status_check" CHECK ("print_jobs"."status" IN ('PENDING', 'SENT', 'FAILED'));