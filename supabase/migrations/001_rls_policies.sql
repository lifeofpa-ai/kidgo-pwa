-- ============================================================
-- RLS Policies for existing tables
-- Run via: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quellen ENABLE ROW LEVEL SECURITY;

-- Allow public read on events
CREATE POLICY "events_public_read"
  ON events FOR SELECT
  USING (true);

-- Allow public read on quellen
CREATE POLICY "quellen_public_read"
  ON quellen FOR SELECT
  USING (true);

-- Allow service_role full access on events
CREATE POLICY "events_service_write"
  ON events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow service_role full access on quellen
CREATE POLICY "quellen_service_write"
  ON quellen FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- kategorien table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kategorien') THEN
    ALTER TABLE kategorien ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "kategorien_public_read" ON kategorien FOR SELECT USING (true);
    CREATE POLICY "kategorien_service_write" ON kategorien FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- event_blocklist table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_blocklist') THEN
    ALTER TABLE event_blocklist ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "event_blocklist_service_only" ON event_blocklist FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
