-- ============================================================
-- Personalisierung (Wiedererkennung) + Familienwanderungen-Ausnahme
-- Kidgo, 2026-09-20
-- ============================================================
-- Teil 1: Account-weite Onboarding-Erkennung. Damit ein Intro/Hinweis, der
-- auf einem Gerät bereits weggeklickt wurde, nach Login auf einem NEUEN
-- Gerät nicht erneut erscheint (ergänzt die geräte-lokalen localStorage-
-- Flags, ersetzt sie nicht).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_profiles.onboarding_state IS
  'Client-Onboarding-Flags (flow_completed, walkthrough_seen, swipe_hint_seen, profile_setup_dismissed) - Account-weite Wiedererkennung ueber Geraete hinweg.';

-- Teil 2: Familienwanderungen als bewusste, eng gefasste Ausnahme vom
-- ZH-Einzugsgebiet (max. 2 Autostunden ab Zuerich, Zentral-/Ostschweiz) -
-- siehe Konzept "Familien- & Kinderwanderungen" (2026-09-20). Neuer
-- event_typ-Wert:
ALTER TABLE public.events DROP CONSTRAINT events_event_typ_check;
ALTER TABLE public.events ADD CONSTRAINT events_event_typ_check
  CHECK (event_typ = ANY (ARRAY['event'::text, 'camp'::text, 'wanderung_ausnahme'::text]));

-- Geo-Filter-Trigger: bypass NUR fuer event_typ = 'wanderung_ausnahme'. Alle
-- anderen Events bleiben streng auf Kanton ZH gefiltert - keine generelle
-- Lockerung des Einzugsgebiets. Dieses Muster (eng gefasste Ausnahme +
-- client-seitige Interessen-Freischaltung, siehe lib/interests.ts
-- hikingEventAllowed) lässt sich künftig auf weitere, ähnlich zurückhaltende
-- Expansionsschritte übertragen.
CREATE OR REPLACE FUNCTION public.geo_filter_non_zh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  o TEXT;
BEGIN
  IF NEW.event_typ = 'wanderung_ausnahme' THEN
    RETURN NEW;
  END IF;

  IF NEW.ort IS NULL OR trim(NEW.ort) = '' THEN
    RETURN NEW;
  END IF;

  o := lower(trim(NEW.ort));

  -- Bekannte Nicht-ZH Kantone als Wörter
  IF o ~* '\m(thurgau|aargau|schwyz|solothurn|graubünden|tessin|wallis|waadt|fribourg|jura|neuenburg|appenzell|glarus|nidwalden|obwalden)\M'
  -- Bekannte Nicht-ZH Städte (Thurgau)
    OR o ~* '\m(frauenfeld|kreuzlingen|arbon|romanshorn|weinfelden|müllheim|amriswil|bischofszell|sirnach)\M'
  -- Aargau / Solothurn
    OR o ~* '\m(aarau|lenzburg|brugg|wohlen|rheinfelden|zofingen|olten|turgi)\M'
  -- Luzern
    OR o ~* '\m(luzern|emmen|kriens|horw|meggen|ebikon)\M'
  -- Zug (Gemeinden)
    OR o ~* '\m(cham|baar|steinhausen)\M'
  -- St. Gallen
    OR o ~* '\m(rapperswil-jona)\M'
    OR o ~* 'st\.?\s*gallen'
  -- Bern
    OR o ~* '\m(thun|biel|burgdorf|langenthal|interlaken)\M'
    OR o ~* '\mberner\s+oberland\M'
  -- Basel
    OR o ~* '\m(basel|liestal|allschwil|muttenz)\M'
  -- Schaffhausen
    OR o ~* '\m(schaffhausen)\M'
  -- Graubünden
    OR o ~* '\m(chur|davos|arosa|klosters|laax|flims)\M'
  -- Westschweiz / Tessin
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

ALTER FUNCTION public.geo_filter_non_zh() SET search_path = public;

-- Teil 3: Redaktionelle Quelle fuer die manuell kuratierten Familienwanderungen
-- (10 Trails Zentral-/Ostschweiz, siehe Konzeptdokument 2026-09-20).
INSERT INTO public.quellen (id, name, url, kategorie, status, notizen, created_at)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'Kidgo Redaktion (Familienwanderungen-Ausnahme)',
  'https://app.kidgo.ch',
  'Nische',
  'Aktiv',
  'Manuell kuratierte Familienwanderungen ausserhalb Kanton ZH (Zentral-/Ostschweiz, max. 2 Autostunden ab Zuerich) - bewusste, eng gefasste Expansionsausnahme, siehe Konzept 2026-09-20.',
  now()
)
ON CONFLICT (id) DO NOTHING;
