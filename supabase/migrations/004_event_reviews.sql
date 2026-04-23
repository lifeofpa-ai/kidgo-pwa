-- ============================================================
-- Event Reviews table
-- Star ratings (1-5) + optional comment per user per event
-- ============================================================

CREATE TABLE IF NOT EXISTS event_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS event_reviews_event_id_idx ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS event_reviews_user_id_idx ON event_reviews(user_id);

-- Enable RLS
ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "event_reviews_public_read"
  ON event_reviews FOR SELECT
  USING (true);

-- Authenticated users can insert their own review
CREATE POLICY "event_reviews_insert_own"
  ON event_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own review
CREATE POLICY "event_reviews_update_own"
  ON event_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own review
CREATE POLICY "event_reviews_delete_own"
  ON event_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER event_reviews_updated_at
  BEFORE UPDATE ON event_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper view: average rating per event
CREATE OR REPLACE VIEW event_rating_summary AS
SELECT
  event_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*) AS review_count
FROM event_reviews
GROUP BY event_id;
