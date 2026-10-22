CREATE INDEX IF NOT EXISTS "orders_paid_at_idx" ON "orders" USING btree ("paid_at");
