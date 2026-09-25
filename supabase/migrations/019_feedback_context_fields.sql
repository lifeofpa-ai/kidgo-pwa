-- Kontext-Feedback (25.09.2026): Meldungen direkt von der Event-Seite und
-- "Nichts gefunden"-Hinweise aus der Suche. Rein additiv, bestehende Zeilen
-- und der bisherige Code bleiben unberuehrt.
-- (Bereits auf Supabase angewendet als Migration `feedback_context_fields`.)
alter table public.feedback_submissions
  add column if not exists event_id uuid,
  add column if not exists reason text,
  add column if not exists search_query text,
  add column if not exists search_filters text[],
  add column if not exists page_path text;

create index if not exists feedback_submissions_event_id_idx
  on public.feedback_submissions (event_id) where event_id is not null;

create index if not exists feedback_submissions_category_idx
  on public.feedback_submissions (category, created_at desc);

-- Neue Kategorien fuer Kontext-Feedback zulassen
-- (auf Supabase angewendet als Migration `feedback_category_context_values`)
alter table public.feedback_submissions drop constraint if exists feedback_submissions_category_check;
alter table public.feedback_submissions add constraint feedback_submissions_category_check
  check (category = any (array['idea','bug','other','event_problem','search_miss']));
