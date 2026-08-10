-- Replace the noisy six-stage overdue schedule with the accepted five-stage
-- policy. `checkout_overdue_grace` uses the configured checkout grace period;
-- the remaining offsets are exact relative to bookings.ends_at.
DELETE FROM "escalation_rules"
WHERE "type" IN (
  'checkout_due_1h',
  'checkout_overdue_1h',
  'checkout_overdue_3h',
  'checkout_overdue_8h'
);

UPDATE "escalation_rules"
SET
  "hours_from_due" = 0,
  "title" = 'Due back now',
  "notify_requester" = true,
  "notify_admins" = false,
  "enabled" = true,
  "sort_order" = 1,
  "updated_at" = NOW()
WHERE "type" = 'checkout_due_now';

UPDATE "escalation_rules"
SET
  "hours_from_due" = 24,
  "title" = '1 day overdue',
  "notify_requester" = true,
  "notify_admins" = true,
  "enabled" = true,
  "sort_order" = 4,
  "updated_at" = NOW()
WHERE "type" = 'checkout_overdue_24h';

INSERT INTO "escalation_rules" (
  "id",
  "hours_from_due",
  "type",
  "title",
  "notify_requester",
  "notify_admins",
  "enabled",
  "sort_order",
  "created_at",
  "updated_at"
)
VALUES
  ('esc_due_2h', -2, 'checkout_due_2h', 'Due back in 2 hours', true, false, true, 0, NOW(), NOW()),
  ('esc_overdue_grace', 0, 'checkout_overdue_grace', 'Checkout overdue', true, false, true, 2, NOW(), NOW()),
  ('esc_overdue_4h', 4, 'checkout_overdue_4h', '4 hours overdue', true, false, true, 3, NOW(), NOW())
ON CONFLICT ("type") DO UPDATE SET
  "hours_from_due" = EXCLUDED."hours_from_due",
  "title" = EXCLUDED."title",
  "notify_requester" = EXCLUDED."notify_requester",
  "notify_admins" = EXCLUDED."notify_admins",
  "enabled" = EXCLUDED."enabled",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = NOW();

-- Split requester fatigue from staff/admin fanout. Preserve unrelated JSON
-- fields while retiring the old recipient-row cap.
UPDATE "system_config"
SET
  "value" = ("value" - 'maxNotificationsPerBooking') || jsonb_build_object(
    'maxRequesterNotificationsPerDueDate', 5,
    'maxOperationalNotificationsPerDueDate', 20
  ),
  "updated_at" = NOW()
WHERE "key" = 'escalation';

INSERT INTO "system_config" ("key", "value", "updated_at")
VALUES (
  'escalation',
  '{"maxRequesterNotificationsPerDueDate":5,"maxOperationalNotificationsPerDueDate":20}'::jsonb,
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
