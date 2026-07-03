-- ============================================================
-- QA-Lauf 2026-07-03 (Qualitätsmanager-Pass) — siehe docs/qa-befunde-2026-07-03.md
-- Alle Statements bereits live auf Prod angewendet via execute_sql;
-- diese Datei dokumentiert die Änderungen für lokale/dev-Parität.
-- ============================================================

-- --- HOCH: SECURITY DEFINER Views -> SECURITY INVOKER -------------------
-- Diese Views enthielten keine privilegierten Operationen, liefen aber mit
-- den Rechten der Ersteller-Rolle statt der abfragenden Person (RLS-Bypass).
ALTER VIEW public.events_mit_quelle SET (security_invoker = true);
ALTER VIEW public.quellen_dashboard SET (security_invoker = true);
ALTER VIEW public.event_rating_summary SET (security_invoker = true);

-- --- HOCH: Geo-Filter deckte nur andere CH-Kantone ab, keine DE/AT -------
-- Fund: consume-eventfrog-api setzt region IMMER auf 'Zürich', unabhängig
-- vom echten Ort ("Harry P.Otter"-Rätseltour z.B. lief zeitgleich in
-- München/Mannheim/Linz/Wolfsberg/Zeltweg u.a., alle mit region='Zürich').
-- Der bestehende geo_filter_non_zh-Trigger kannte nur andere Schweizer
-- Kantone als Ausschlussliste. Erweitert um DE/AT-Grossstädte + Länderworte.
CREATE OR REPLACE FUNCTION public.geo_filter_non_zh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  o TEXT;
BEGIN
  IF NEW.ort IS NULL OR trim(NEW.ort) = '' THEN
    RETURN NEW;
  END IF;

  o := lower(trim(NEW.ort));

  IF o ~* '\m(thurgau|aargau|schwyz|solothurn|graubünden|tessin|wallis|waadt|fribourg|jura|neuenburg|appenzell|glarus|nidwalden|obwalden)\M'
    OR o ~* '\m(frauenfeld|kreuzlingen|arbon|romanshorn|weinfelden|müllheim|amriswil|bischofszell|sirnach)\M'
    OR o ~* '\m(aarau|lenzburg|brugg|wohlen|rheinfelden|zofingen|olten|turgi)\M'
    OR o ~* '\m(luzern|emmen|kriens|horw|meggen|ebikon)\M'
    OR o ~* '\m(cham|baar|steinhausen)\M'
    OR o ~* '\m(rapperswil-jona)\M'
    OR o ~* 'st\.?\s*gallen'
    OR o ~* '\m(thun|biel|burgdorf|langenthal|interlaken)\M'
    OR o ~* '\mberner\s+oberland\M'
    OR o ~* '\m(basel|liestal|allschwil|muttenz)\M'
    OR o ~* '\m(schaffhausen)\M'
    OR o ~* '\m(chur|davos|arosa|klosters|laax|flims)\M'
    OR o ~* '\m(lausanne|genève|genf|lugano|bellinzona|locarno|montreux|sion|neuchâtel|bienne)\M'
    -- QA-Fix 2026-07-03: Ausland (DE/AT)
    OR o ~* '\m(deutschland|germany|österreich|austria)\M'
    OR o ~* '\m(münchen|munich|berlin|hamburg|köln|frankfurt|stuttgart|düsseldorf|dortmund|essen|leipzig|bremen|dresden|hannover|nürnberg|mannheim|karlsruhe|wiesbaden|bielefeld|bonn|münster|augsburg|ingolstadt)\M'
    OR o ~* '\m(wien|vienna|graz|linz|salzburg|innsbruck|klagenfurt|wolfsberg|zeltweg)\M'
  THEN
    NEW.status := 'rejected';
    NEW.review_comment := 'Geo-Filter: Nicht Kanton ZH (' || left(NEW.ort, 100) || ')';
    RETURN NEW;
  END IF;

  IF o ~ ',\s*zug\s*$' OR o ~ '^\s*zug\s*$' OR o ~ ',\s*zug\s*,' THEN
    NEW.status := 'rejected';
    NEW.review_comment := 'Geo-Filter: Nicht Kanton ZH (' || left(NEW.ort, 100) || ')';
    RETURN NEW;
  END IF;

  IF o ~ ',\s*baden\s*$' OR o ~ '^\s*baden\s*$' THEN
    NEW.status := 'rejected';
    NEW.review_comment := 'Geo-Filter: Nicht Kanton ZH (' || left(NEW.ort, 100) || ')';
    RETURN NEW;
  END IF;

  IF o ~ ',\s*bern\s*$' OR o ~ '^\s*bern\s*$' OR o ~ ',\s*bern\s*,' THEN
    NEW.status := 'rejected';
    NEW.review_comment := 'Geo-Filter: Nicht Kanton ZH (' || left(NEW.ort, 100) || ')';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- One-off cleanup: 111 bereits importierte DE/AT-Events (u.a. "Harry P.Otter"
-- Rätseltour, diverse "Neueröffnung"/generische München-Listings) nachträglich
-- auf rejected gesetzt (Trigger feuert nur bei INSERT, nicht bei UPDATE).
-- Siehe docs/qa-befunde-2026-07-03.md für die betroffenen IDs.

-- --- HOCH: cleanup_past_events in Cron + Zugriff eingeschränkt -----------
-- Erst REVOKE FROM anon/authenticated allein reichte nicht -- Postgres grantet
-- EXECUTE per Default an PUBLIC, davon erben anon/authenticated egal was man
-- ihnen einzeln entzieht. Erst REVOKE FROM PUBLIC hat den Advisor wirklich
-- geloescht (verifiziert erneut per get_advisors nach diesem Fix).
REVOKE EXECUTE ON FUNCTION public.cleanup_past_events() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_past_events() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_past_events() TO service_role;
-- cron.schedule('cleanup-past-events-daily', '30 3 * * *', 'SELECT public.cleanup_past_events();')

-- --- MITTEL: pipeline_runs hatte RLS aktiv, aber 0 Policies --------------
CREATE POLICY "pipeline_runs_service_role_only" ON public.pipeline_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- --- MITTEL/NIEDRIG: search_path für 11 Functions gehärtet ---------------
ALTER FUNCTION public.cleanup_past_events() SET search_path = public;
ALTER FUNCTION public.auto_kategorisiere_event() SET search_path = public;
ALTER FUNCTION public.block_unwanted_events() SET search_path = public;
ALTER FUNCTION public.flag_short_description() SET search_path = public;
ALTER FUNCTION public.geo_filter_non_zh() SET search_path = public;
ALTER FUNCTION public.is_event_blocked(titel text) SET search_path = public;
ALTER FUNCTION public.is_event_blocked(titel text, beschreibung text) SET search_path = public;
ALTER FUNCTION public.normalize_age_on_upsert() SET search_path = public;
ALTER FUNCTION public.parse_age_range(val text) SET search_path = public;
ALTER FUNCTION public.prevent_past_event_insert() SET search_path = public;
ALTER FUNCTION public.reject_teen_only_events() SET search_path = public;

-- --- NIEDRIG: fehlender FK-Index -----------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_event_id ON public.user_bookmarks(event_id);

-- --- MITTEL: RLS-Performance — Duplikate entfernt + auth.uid()/auth.role() ---
-- in Subselects gewrappt (Supabase auth_rls_initplan-Fix: wird pro Query statt
-- pro Zeile ausgewertet; funktional identisch, nur schneller).
DROP POLICY IF EXISTS "anon_select_approved_events" ON public.events;
DROP POLICY IF EXISTS "events_all_read" ON public.events;
DROP POLICY IF EXISTS "events_public_read" ON public.events;
DROP POLICY IF EXISTS "service_role_all_events" ON public.events;
DROP POLICY IF EXISTS "events_auth_update" ON public.events;
DROP POLICY IF EXISTS "quellen_public_read" ON public.quellen;

ALTER POLICY "events_auth_all" ON public.events USING ((select auth.role()) = 'authenticated');
ALTER POLICY "events_service_write" ON public.events USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');

ALTER POLICY "quellen_auth_write" ON public.quellen USING ((select auth.role()) = 'authenticated');
ALTER POLICY "quellen_service_write" ON public.quellen USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');

ALTER POLICY "kategorien_auth_write" ON public.kategorien USING ((select auth.role()) = 'authenticated');
ALTER POLICY "kategorien_service_write" ON public.kategorien USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');

ALTER POLICY "event_blocklist_service_only" ON public.event_blocklist USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');

ALTER POLICY "user_bookmarks_delete_own" ON public.user_bookmarks USING ((select auth.uid()) = user_id);
ALTER POLICY "user_bookmarks_insert_own" ON public.user_bookmarks WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "user_bookmarks_select_own" ON public.user_bookmarks USING ((select auth.uid()) = user_id);

ALTER POLICY "user_profiles_insert_own" ON public.user_profiles WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "user_profiles_select_own" ON public.user_profiles USING ((select auth.uid()) = user_id);
ALTER POLICY "user_profiles_update_own" ON public.user_profiles USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "event_reviews_delete_own" ON public.event_reviews USING ((select auth.uid()) = user_id);
ALTER POLICY "event_reviews_insert_own" ON public.event_reviews WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "event_reviews_update_own" ON public.event_reviews USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own dismissals" ON public.event_dismissals USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own dismissals" ON public.event_dismissals WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can read own dismissals" ON public.event_dismissals USING ((select auth.uid()) = user_id);

ALTER POLICY "Service write places" ON public.places USING ((select auth.role()) = 'service_role');

-- --- Offen, nicht via SQL/MCP-Tools automatisierbar ----------------------
-- "Leaked Password Protection" (Supabase Auth) ist deaktiviert (WARN-Advisor).
-- Kein SQL/Management-API-Tool dafür verfügbar in dieser Session -- manuelles
-- Umlegen im Supabase-Dashboard unter Authentication > Policies erforderlich.
