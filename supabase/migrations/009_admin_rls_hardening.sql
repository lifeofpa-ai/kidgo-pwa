-- ============================================================
-- Sprint 25 Security: Lock down events & quellen mutations
-- ============================================================
-- Goal: anon role can SELECT freely and INSERT only "pending" rows
-- (public submission flow). UPDATE / DELETE and any non-pending INSERT
-- must go through the admin-mutations Edge Function (service_role).
--
-- Idempotent: drops any policies that would grant wider anon write
-- access, then re-asserts the intended state. Safe to re-run.
-- ============================================================

ALTER TABLE events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quellen ENABLE ROW LEVEL SECURITY;

-- Defensive cleanup: drop any policy that may grant anon UPDATE/DELETE
-- or unrestricted INSERT. Drops are no-ops if the policies don't exist.
DROP POLICY IF EXISTS "events_anon_insert"          ON events;
DROP POLICY IF EXISTS "events_anon_update"          ON events;
DROP POLICY IF EXISTS "events_anon_delete"          ON events;
DROP POLICY IF EXISTS "events_public_write"         ON events;
DROP POLICY IF EXISTS "events_authenticated_write"  ON events;

DROP POLICY IF EXISTS "quellen_anon_insert"         ON quellen;
DROP POLICY IF EXISTS "quellen_anon_update"         ON quellen;
DROP POLICY IF EXISTS "quellen_anon_delete"         ON quellen;
DROP POLICY IF EXISTS "quellen_public_write"        ON quellen;
DROP POLICY IF EXISTS "quellen_authenticated_write" ON quellen;

-- Public SELECT (re-asserted from migration 001 in case it has drifted).
DROP POLICY IF EXISTS "events_public_read"  ON events;
DROP POLICY IF EXISTS "quellen_public_read" ON quellen;

CREATE POLICY "events_public_read"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "quellen_public_read"
  ON quellen FOR SELECT
  USING (true);

-- Public submission: anon may INSERT but only with status='pending'.
-- Approval (status='approved') and any UPDATE / DELETE are reserved for
-- service_role via the admin-mutations Edge Function.
DROP POLICY IF EXISTS "events_anon_submit"  ON events;
DROP POLICY IF EXISTS "quellen_anon_submit" ON quellen;

CREATE POLICY "events_anon_submit"
  ON events FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

CREATE POLICY "quellen_anon_submit"
  ON quellen FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

-- Service role full access (re-asserted from migration 001).
DROP POLICY IF EXISTS "events_service_write"  ON events;
DROP POLICY IF EXISTS "quellen_service_write" ON quellen;

CREATE POLICY "events_service_write"
  ON events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "quellen_service_write"
  ON quellen FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
