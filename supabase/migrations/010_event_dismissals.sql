-- ============================================================
-- event_dismissals — tracks why users dismiss events
-- ============================================================

CREATE TABLE event_dismissals (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id   UUID        REFERENCES events(id)     ON DELETE CASCADE,
  reasons    JSONB       NOT NULL DEFAULT '[]',
  event_meta JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dismissals_user_select" ON event_dismissals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "dismissals_user_insert" ON event_dismissals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dismissals_user_delete" ON event_dismissals
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX event_dismissals_user_idx  ON event_dismissals (user_id);
CREATE INDEX event_dismissals_event_idx ON event_dismissals (event_id);
