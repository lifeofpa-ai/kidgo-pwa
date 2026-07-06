-- ============================================================
-- Pipeline-Fix 2026-07-06 (Fortsetzung QA-Lauf, "Korrektur zuerst")
-- Siehe docs/HANDOVER.md, Update 4, für den vollen Kontext.
-- Alle Statements bereits live auf Prod angewendet via execute_sql;
-- diese Datei dokumentiert die Änderungen für lokale/dev-Parität.
-- ============================================================

-- --- Root Cause: kidgo-pipeline-weekly / pipeline-orchestrator lief in EINER
-- Invocation 6 Schritte sequenziell (scrape-batch, scrape-eventfrog,
-- scrape-feriennet-Loop, consume-feed-Loop, assign-images-Loop, Archivierung).
-- Die Edge-Function-Plattform killt eine Invocation nach ca. 150-160s Wandzeit
-- (beobachtet: status_code 546 nach exakt 161081ms) -- unabhaengig von im Code
-- gesetzten AbortSignal.timeout()-Werten. scrape-batch allein brauchte schon
-- ~126s (330 aktive Quellen sequenziell), liess praktisch kein Budget fuer den
-- Rest. Ausserdem waren Schritte 2/5/6 bereits durch eigene Crons abgedeckt
-- (eventfrog-daily, assign-event-images-daily, cleanup-past-events-daily).
--
-- Fix: kidgo-pipeline-weekly läuft nur noch die nicht-redundanten Schritte
-- (scrape-feriennet + consume-feed) via skip_steps-Parameter (den
-- pipeline-orchestrator schon unterstützte -- kein Code-Change nötig).
-- scrape-batch bekommt einen eigenen, neuen Cron mit vollem Zeitbudget.
-- Beide Crons haben jetzt timeout_milliseconds gesetzt (fehlte vorher komplett
-- -> Default 5000ms, viel zu kurz fuer net._http_response-Sichtbarkeit).
--
-- HINWEIS: cron.alter_job/cron.schedule enthalten den Supabase anon-JWT dieses
-- Projekts im Klartext (wie bei den bereits bestehenden Crons aus Update 3) --
-- das ist der bestehenden Konvention in diesem Projekt entsprechend, da der
-- anon key ohnehin öffentlich im Frontend-Bundle liegt.

SELECT cron.alter_job(
  job_id := 3,  -- kidgo-pipeline-weekly
  command := $cmd$
  SELECT net.http_post(
    url := 'https://wfkzxqscskppfivqsgno.supabase.co/functions/v1/pipeline-orchestrator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma3p4cXNjc2twcGZpdnFzZ25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcxMjUsImV4cCI6MjA5MDA0MzEyNX0.lvuYvSzbZ-SfU2IEFiFBWSKmo6eBAqNez4tSIptjxnI"}'::jsonb,
    body := '{"dry_run": false, "skip_steps": ["scrape-batch", "scrape-eventfrog", "assign-images", "archive"]}'::jsonb,
    timeout_milliseconds := 140000
  );
  $cmd$
);

SELECT cron.schedule(
  'scrape-batch-weekly',
  '45 5 * * 1',
  $cmd$
  SELECT net.http_post(
    url := 'https://wfkzxqscskppfivqsgno.supabase.co/functions/v1/scrape-batch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma3p4cXNjc2twcGZpdnFzZ25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcxMjUsImV4cCI6MjA5MDA0MzEyNX0.lvuYvSzbZ-SfU2IEFiFBWSKmo6eBAqNez4tSIptjxnI"}'::jsonb,
    body := '{"limit": 50, "delay_ms": 1500, "dry_run": false}'::jsonb,
    timeout_milliseconds := 140000
  );
  $cmd$
);

-- --- Datenqualität: 43 quellen mit bestätigtem Netzwerkfehler (DNS nicht
-- auflösbar, ungültiges SSL-Zertifikat, oder Timeout nach 8s TCP/SSL-Handshake)
-- auf Pausiert gesetzt -- reversibel, nichts gelöscht. Ermittelt per
-- net.http_get gegen jede aktive quelle mit Browser-Headern (siehe Session-Log
-- für die vollständige Liste). Die 87 Quellen mit 404 wurden NICHT pausiert --
-- Stichprobe (zoo.ch) zeigte, dass es sich meist um verschobene URLs nach
-- Website-Relaunches handelt, nicht um tote Quellen; das braucht manuelle
-- URL-Recherche pro Quelle, kein automatischer Fix.
--
-- Die konkreten UPDATE-Statements sind hier bewusst NICHT reproduziert (die
-- betroffenen IDs sind eine Momentaufnahme vom 2026-07-06 und würden bei
-- erneuter Ausführung ggf. andere/veraltete Quellen treffen). Siehe
-- docs/HANDOVER.md Update 4 für die Zusammenfassung; die IDs stehen im
-- Session-Verlauf.

-- --- Offen, nicht in dieser Session automatisiert ---------------------------
-- 87 quellen mit 404: brauchen manuelle URL-Recherche (vermutlich grösstenteils
-- Website-Relaunches, z.B. Zoo Zürich, Technorama Winterthur, PBZ Bibliotheken,
-- GZ Zürich, diverse Gemeinden).
-- "Leaked Password Protection" (aus Update 3): weiterhin nur manuell im
-- Supabase-Dashboard aktivierbar.
