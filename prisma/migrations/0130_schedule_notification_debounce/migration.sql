-- Move the ten-minute quiet period from the edit to the notification.
--
-- Assignments now commit immediately, and `notify_after` is the debounce: every
-- worker-visible edit pushes it forward, and the flush that fires at that time
-- diffs live state against `last_published_snapshot` -- the high-water mark of
-- what workers have actually been told -- so churn inside the window collapses
-- to its net effect instead of sending a message per click.
--
-- `notify_error` records a flush that could not deliver. The snapshot is left
-- where it was in that case, so the next flush picks up the whole backlog, and
-- the `notify_after` index lets a sweeper find groups whose flush never ran.

ALTER TABLE "shift_groups"
  ADD COLUMN "notify_after" TIMESTAMP(3),
  ADD COLUMN "notify_attempted_at" TIMESTAMP(3),
  ADD COLUMN "notify_error" TEXT;

CREATE INDEX "shift_groups_notify_after_idx" ON "shift_groups"("notify_after");
