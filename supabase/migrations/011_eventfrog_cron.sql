-- ============================================================
-- Sprint 24: Daily pg_cron job for consume-eventfrog-api
-- Runs daily at 05:00 UTC via pg_cron + pg_net
--
-- Prerequisites (enable once in Supabase Dashboard → Database → Extensions):
--   1. pg_cron
--   2. pg_net
--
-- BEFORE RUNNING: replace <SUPABASE_SERVICE_ROLE_KEY> with your
-- actual service_role key (Dashboard → Settings → API).
--
-- To verify after running:
--   SELECT jobid, jobname, schedule, command FROM cron.job;
-- ============================================================

-- Extensions: no-op when already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Create the daily cron job only when it does not yet exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eventfrog-daily') THEN
    RAISE NOTICE 'Cron job "eventfrog-daily" already exists — skipping.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'eventfrog-daily',   -- unique job name
    '0 5 * * *',         -- daily at 05:00 UTC
    $$
      SELECT net.http_post(
        url     := 'https://wfkzxqscskppfivqsgno.supabase.co/functions/v1/consume-eventfrog-api',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer <SUPABASE_SERVICE_ROLE_KEY>"}'::jsonb,
        body    := '{}'::jsonb
      ) AS request_id;
    $$
  );

  RAISE NOTICE 'Cron job "eventfrog-daily" created: daily at 05:00 UTC.';
END $$;
