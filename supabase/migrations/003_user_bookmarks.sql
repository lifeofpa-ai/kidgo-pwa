-- ============================================================
-- User Bookmarks table
-- Syncs localStorage bookmarks to Supabase for logged-in users
-- ============================================================

CREATE TABLE IF NOT EXISTS user_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS user_bookmarks_user_id_idx ON user_bookmarks(user_id);

-- Enable RLS
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only access their own bookmarks
CREATE POLICY "user_bookmarks_select_own"
  ON user_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_bookmarks_insert_own"
  ON user_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_bookmarks_delete_own"
  ON user_bookmarks FOR DELETE
  USING (auth.uid() = user_id);
