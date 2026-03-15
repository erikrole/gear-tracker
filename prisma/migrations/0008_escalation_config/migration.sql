-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" TEXT NOT NULL,
    "hours_from_due" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notify_requester" BOOLEAN NOT NULL DEFAULT true,
    "notify_admins" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalation_rules_type_key" ON "escalation_rules"("type");

-- Seed default escalation rules
INSERT INTO "escalation_rules" ("id", "hours_from_due", "type", "title", "notify_requester", "notify_admins", "enabled", "sort_order", "created_at", "updated_at")
VALUES
  ('esc_reminder_4h', -4, 'checkout_due_reminder', 'Checkout due in 4 hours', true, false, true, 0, NOW(), NOW()),
  ('esc_due_now', 0, 'checkout_due_now', 'Checkout is due now', true, false, true, 1, NOW(), NOW()),
  ('esc_overdue_2h', 2, 'checkout_overdue_2h', 'Checkout is 2 hours overdue', true, false, true, 2, NOW(), NOW()),
  ('esc_overdue_24h', 24, 'checkout_overdue_24h', 'Checkout is 24 hours overdue', true, true, true, 3, NOW(), NOW());

-- Seed default system config
INSERT INTO "system_config" ("key", "value", "updated_at")
VALUES ('escalation', '{"maxNotificationsPerBooking": 10}', NOW());
