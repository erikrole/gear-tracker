-- Add low-effort operational indexes for scan/notification query paths
CREATE INDEX IF NOT EXISTS "bulk_stock_balances_bulk_sku_id_idx"
  ON "bulk_stock_balances"("bulk_sku_id");

CREATE INDEX IF NOT EXISTS "override_events_created_at_idx"
  ON "override_events"("created_at");

CREATE INDEX IF NOT EXISTS "notifications_sent_at_idx"
  ON "notifications"("sent_at");
