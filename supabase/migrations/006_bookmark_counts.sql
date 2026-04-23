-- Public bookmark counts for social proof on event cards
-- Uses SECURITY DEFINER so anon users can see aggregate counts
CREATE OR REPLACE FUNCTION get_event_bookmark_counts()
RETURNS TABLE(event_id UUID, bookmark_count BIGINT)
SECURITY DEFINER
LANGUAGE SQL
STABLE
AS $$
  SELECT event_id, COUNT(*) AS bookmark_count
  FROM user_bookmarks
  GROUP BY event_id;
$$;

GRANT EXECUTE ON FUNCTION get_event_bookmark_counts() TO anon, authenticated;
