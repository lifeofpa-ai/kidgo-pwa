-- ============================================================
-- Sprint 23: External API imports (Eventfrog, OSM, Stadt ZH, Football-Data)
-- Run via: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) events: dedupe key + coordinates for imports
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7);
ALTER TABLE events ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7);

CREATE UNIQUE INDEX IF NOT EXISTS events_external_uniq
  ON events(external_source, external_id)
  WHERE external_id IS NOT NULL AND external_source IS NOT NULL;

-- 2) places: persistent locations (playgrounds, swimming pools, parks)
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  external_source TEXT NOT NULL,
  name TEXT NOT NULL,
  place_type TEXT NOT NULL,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  address TEXT,
  city TEXT,
  tags JSONB,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_source, external_id)
);

CREATE INDEX IF NOT EXISTS places_type_idx   ON places(place_type);
CREATE INDEX IF NOT EXISTS places_status_idx ON places(status);
CREATE INDEX IF NOT EXISTS places_geo_idx    ON places(lat, lng);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'places' AND policyname = 'places_public_read'
  ) THEN
    CREATE POLICY "places_public_read"   ON places FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'places' AND policyname = 'places_service_write'
  ) THEN
    CREATE POLICY "places_service_write" ON places FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
