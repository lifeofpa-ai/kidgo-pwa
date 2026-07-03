-- ============================================================
-- Fix: normalize_age_on_upsert wiped alter_von/alter_bis/alters_buckets
-- to NULL on every INSERT whenever `altersgruppen` was not set —
-- which is the case for most scrapers (gz-zuerich, sport-events,
-- kinderthur, ferienplausch-uster, eventfrog, ...), since they set
-- alter_von/alter_bis directly instead of altersgruppen.
--
-- Impact before this fix: 1402 of 1839 events (76%) had alter_von IS NULL,
-- including 609 of 983 future events (62%) — invisible to the app's
-- age-filter.
--
-- Fix: if altersgruppen is empty/missing but alter_von is already set
-- directly on the row, keep it (and derive alters_buckets from it)
-- instead of nulling it out. altersgruppen-based derivation (existing
-- behavior) is unchanged and still takes priority when present.
--
-- Applied directly to prod on 2026-07-03 via execute_sql; this file
-- documents the change for local/dev parity.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_age_on_upsert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  min_age int;
  max_age int;
  buckets text[] := '{}';
BEGIN
  IF NEW.altersgruppen IS NULL OR array_length(NEW.altersgruppen, 1) IS NULL THEN
    IF NEW.alter_von IS NOT NULL THEN
      min_age := NEW.alter_von;
      max_age := LEAST(COALESCE(NEW.alter_bis, NEW.alter_von), 12);
    ELSE
      NEW.alter_von := NULL;
      NEW.alter_bis := NULL;
      NEW.alters_buckets := NULL;
      RETURN NEW;
    END IF;
  ELSE
    SELECT MIN(p.age_min), MAX(p.age_max)
    INTO min_age, max_age
    FROM unnest(NEW.altersgruppen) AS ag(val)
    CROSS JOIN LATERAL parse_age_range(ag.val) AS p
    WHERE p.age_min IS NOT NULL;

    IF min_age IS NULL THEN
      IF NEW.alter_von IS NOT NULL THEN
        min_age := NEW.alter_von;
        max_age := LEAST(COALESCE(NEW.alter_bis, NEW.alter_von), 12);
      ELSE
        NEW.alter_von := NULL;
        NEW.alter_bis := NULL;
        NEW.alters_buckets := NULL;
        RETURN NEW;
      END IF;
    ELSE
      max_age := LEAST(max_age, 12);
    END IF;
  END IF;

  NEW.alter_von := min_age;
  NEW.alter_bis := max_age;

  IF min_age <= 3  AND max_age >= 0  THEN buckets := buckets || '{0-3}';  END IF;
  IF min_age <= 6  AND max_age >= 4  THEN buckets := buckets || '{4-6}';  END IF;
  IF min_age <= 9  AND max_age >= 7  THEN buckets := buckets || '{7-9}';  END IF;
  IF min_age <= 12 AND max_age >= 10 THEN buckets := buckets || '{10-12}'; END IF;

  NEW.alters_buckets := buckets;
  RETURN NEW;
END;
$function$;
