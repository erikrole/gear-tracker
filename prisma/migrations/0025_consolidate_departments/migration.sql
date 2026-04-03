-- Consolidate Video and Photography departments into Creative.
-- This is a data-only migration (no schema changes).

-- Step 1: Create "Creative" department if it doesn't already exist.
INSERT INTO departments (id, name, active, created_at, updated_at)
SELECT gen_random_uuid()::text, 'Creative', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Creative');

-- Step 2: Reassign all assets from Video/Photography to Creative.
UPDATE assets
SET department_id = (SELECT id FROM departments WHERE name = 'Creative'),
    updated_at = NOW()
WHERE department_id IN (
  SELECT id FROM departments WHERE name IN ('Video', 'Photography')
);

-- Step 3: Delete the old departments (safe — no FK references remain).
DELETE FROM departments WHERE name IN ('Video', 'Photography');
