-- Backfill existing users into allowed_emails as pre-claimed entries.
-- This covers users who existed before registration gating was introduced.
-- Each entry is marked as claimed (claimedAt = user.createdAt, claimedById = user.id).
-- Erik Role (erole@) is used as createdById since he is the system admin.

DO $$
DECLARE
  admin_id TEXT;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'erole@athletics.wisc.edu' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'erole@athletics.wisc.edu not found — skipping allowed_emails backfill';
    RETURN;
  END IF;

  INSERT INTO allowed_emails (id, email, role, created_by_id, claimed_at, claimed_by_id, created_at)
  SELECT
    'c' || substring(md5(u.email), 1, 24),
    u.email,
    u.role,
    admin_id,
    u.created_at,
    u.id,
    u.created_at
  FROM users u
  WHERE u.email IN (
    'erole@athletics.wisc.edu',
    'jrb@athletics.wisc.edu',
    'jmao@athletics.wisc.edu',
    'rdean1024@gmail.com'
  )
  ON CONFLICT (email) DO NOTHING;

  RAISE NOTICE 'allowed_emails backfill complete';
END $$;
