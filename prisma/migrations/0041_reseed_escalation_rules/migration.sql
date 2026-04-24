-- Remove old timing buckets that no longer match the schedule
DELETE FROM "escalation_rules"
WHERE "type" IN ('checkout_due_reminder', 'checkout_overdue_2h', 'checkout_overdue_6h', 'checkout_overdue_12h');

-- Update kept types with new titles and sort order
UPDATE "escalation_rules"
SET "title" = 'Due back now', "sort_order" = 1, "updated_at" = NOW()
WHERE "type" = 'checkout_due_now';

UPDATE "escalation_rules"
SET "title" = '1 day overdue', "sort_order" = 5, "updated_at" = NOW()
WHERE "type" = 'checkout_overdue_24h';

-- Insert new timing buckets (ON CONFLICT = safe re-run)
INSERT INTO "escalation_rules" ("id", "hours_from_due", "type", "title", "notify_requester", "notify_admins", "enabled", "sort_order", "created_at", "updated_at")
VALUES
  ('esc_due_1h',      -1, 'checkout_due_1h',     'Due back in 1 hour', true,  false, true, 0, NOW(), NOW()),
  ('esc_overdue_1h',   1, 'checkout_overdue_1h',  '1 hour overdue',     true,  false, true, 2, NOW(), NOW()),
  ('esc_overdue_3h',   3, 'checkout_overdue_3h',  '3 hours overdue',    true,  false, true, 3, NOW(), NOW()),
  ('esc_overdue_8h',   8, 'checkout_overdue_8h',  '8 hours overdue',    true,  true,  true, 4, NOW(), NOW())
ON CONFLICT ("type") DO NOTHING;
