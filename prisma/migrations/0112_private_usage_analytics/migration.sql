CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "actor_hash" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "outcome" TEXT,
    "app_version" TEXT,
    "duration_bucket" TEXT,
    "session_hash" TEXT,
    "properties" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_events_occurred_at_idx" ON "product_events"("occurred_at");
CREATE INDEX "product_events_event_name_occurred_at_idx" ON "product_events"("event_name", "occurred_at");
CREATE INDEX "product_events_platform_occurred_at_idx" ON "product_events"("platform", "occurred_at");
CREATE INDEX "product_events_surface_occurred_at_idx" ON "product_events"("surface", "occurred_at");
CREATE INDEX "product_events_actor_hash_occurred_at_idx" ON "product_events"("actor_hash", "occurred_at");
