-- User gamification tracking
CREATE TABLE IF NOT EXISTS user_gamification (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visited_event_ids     JSONB   DEFAULT '[]'::jsonb,
  geheimtipps_found     JSONB   DEFAULT '[]'::jsonb,
  has_reviewed          BOOLEAN DEFAULT FALSE,
  challenge_completed   BOOLEAN DEFAULT FALSE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gamification"
  ON user_gamification FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_gamification_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER gamification_updated
  BEFORE UPDATE ON user_gamification
  FOR EACH ROW EXECUTE FUNCTION update_gamification_timestamp();
