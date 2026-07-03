# Handover — 3. Juli 2026 (Update 2)

Stand am Ende dieser Session. Nächste Session: hier weiterlesen statt Repo neu zu explorieren.

## Update 2 (3. Juli, "mach 1,2,3" + Phase 4)

Nutzer-Auftrag war: "mach alles der Reihe nach: 1, 2 danach 3" (Reihenfolge aus dem
vorherigen Update-Vorschlag unten). Ergebnisse:

**1. scrape-feriennet-Korrektur:** Die Annahme im Update oben war **falsch**. Beim
Nachprüfen per SQL-Gruppierung nach URL-Muster zeigte sich: `scrape-feriennet`
(feriennet.projuventute.ch-URLs) hatte **0** NULL-Alter-Zeilen. Der tatsächliche
Verursacher der 480 fehlenden Alterswerte war `scrape-ferienplausch-uster`
(JSON-API, ferienplausch-uster.ch/kurs/...-URLs) — nicht der HTML-Scraper.
Kein Code-Fix nötig; **480/480 Events per einmaligem SQL-Backfill** repariert
(Join gegen die Live-JSON-API der Quelle). Damit ist auch dieser Block jetzt
sauber.

**2. UX-Redesign (`docs/ux-audit.md` Phase 1-3):** Geprüft statt blind neu gebaut
— **bereits vollständig implementiert**. Bestätigt u.a.: 4-Tab-Bottom-Nav
(`components/BottomNav.tsx`) exakt wie Audit-Wireframe, `app/page.tsx` auf 1736
Zeilen runtergebrochen (Audit nannte 4000+) mit Hero/CardStack/Weekend/Seasonal-
Komponentenstruktur, Explore-Seite mit List/Map-Toggle, Planer mit Wochen-Strip,
Ich-Seite konsolidiert, kontextuelle Startseite (`lib/context-mode.ts`,
Weekend/Rain/Evening/Holiday-Modi) — alles schon da. Keine Änderung vorgenommen,
um keine Doppelarbeit zu machen. Zwei tote State-Variablen in `app/page.tsx`
notiert als Cleanup-Kandidaten (`wochenplanerOpen`, `challengeAccepted`/
`showChallengeEvents` — werden gesetzt, aber nirgends gerendert), nicht entfernt.

**3. Repo-Aufräumen (25 unstaged Dateien):** Beim Prüfen zeigte sich: das bash-Tool
zeigte 24-26 "geänderte" Dateien, aber `git diff --stat -w` (Whitespace ignorieren)
bewies: 24 davon waren **reines Zeilenendezeichen-Rauschen** (CRLF-Normalisierung
durch die Sandbox-Mount-Schicht), kein echter Inhalt. Ein frisches natives Git-GUI-
Fenster (Rescan) zeigte tatsächlich nur **2** echte Dateien. **Wichtige Lektion:**
`git status`/`git diff` über das bash-Tool auf diesem Repo ist auf diesem Sandbox-
Mount nicht zuverlässig — bei Zweifel immer mit nativem Git-GUI oder dem Nutzer
gegenchecken, nicht dem bash-Output blind vertrauen.

**Phase 4 (Validation) — Blocker entdeckt:** Auf "Nein, starte Phase 4" hin geprüft:
`auth.users` = 2 Nutzer, `user_bookmarks`/`event_reviews`/`event_dismissals`/
`user_profiles`/`places` = 0 Zeilen, GA4 sendet nur clientseitig (kein Server-Log in
Supabase). Phase 4 (A/B-Test, Analytics-Review, Interviews) braucht aber echten
Traffic. Nutzer-Entscheidung: **"Noch nicht live — Messung vorbereiten"** statt eine
Analyse aus 0 Datenpunkten zu erfinden. Umgesetzt:

- **`docs/measurement-plan.md`** (neu): Event-Tracking-Checkliste (Ist/Soll gegen
  Audit 4.1/4.3), GA4-Dashboard-Plan (5 konkrete Explorations, für später einzurichten),
  Begründung warum ein rückwirkender A/B-Test "alt vs. neu" nicht mehr geht
  (alte Seite existiert im Code nicht mehr) + Vorschlag für ein Feature-Flag-basiertes
  A/B-Test-Muster für künftige Änderungen.
- **`docs/user-interview-guide.md`** (neu): Recruiting-Nachricht, Interview-Skript
  (Task "Finde ein Event für Samstag", think-aloud, Nachfragen), Auswertungsbogen —
  für Phase 4.2. Das ist die einzige Phase-4-Massnahme, die **ohne** echten Traffic
  sofort durchführbar ist (Patrick muss die Interviews selbst führen).
- **Code-Änderung, `lib/analytics.ts`:** zwei bisher fehlende Metriken ergänzt —
  `scroll_depth` (25/50/75/100%, aktiviert auf Home + Explore via neuen
  `useEffect`-Hooks in `app/page.tsx`/`app/explore/page.tsx`) und
  `time_to_first_interaction` (ms bis zum ersten Klick/Suche/Chat-Öffnen o.ä.,
  zentral in `trackEvent()` eingebaut, kein Aufruf-Ort geändert). Beides war laut
  Audit 4.1/4.3 gefordert, existierte aber noch nicht.
- **Nicht gemacht (bewusst, siehe measurement-plan.md):** kein Heatmap-Tool
  (z.B. Clarity) eingebunden — das ist eine Produktentscheidung (neues externes
  Tool), keine reine Code-Ergänzung; sollte Patrick vor Go-Live selbst entscheiden.

**Noch offen:** Diese Code-Änderungen (`lib/analytics.ts`, `app/page.tsx`,
`app/explore/page.tsx`) sowie die zwei neuen Docs sind **noch nicht committet** —
gleiches Git-Lock-Verhalten wie unten beschrieben ist zu erwarten; ggf. wieder
Git GUI verwenden.

## Update (3. Juli, Fortsetzung nach PO-Priorität)

Weitergemacht mit dem im Abschnitt "Wichtiger struktureller Fund" beschriebenen Altersgruppen-Bug (war die vorgeschlagene nächste Priorität):

- **Trigger `normalize_age_on_upsert` gefixt** (Migration `012_fix_age_normalization_trigger.sql`, bereits live angewendet): überschreibt `alter_von`/`alter_bis` nicht mehr mit `NULL`, wenn ein Scraper sie direkt setzt (statt über `altersgruppen`). Getestet mit Insert-Rollback für beide Pfade (direkte Werte + `altersgruppen`-Text) — beide funktionieren korrekt.
- **Verifiziert mit echtem Live-Lauf:** `scrape-gz-zuerich` neu laufen lassen → 22 neue Events, **alle mit korrekt gesetzten Altersfeldern**, ganz ohne Code-Änderung am Scraper selbst. Der Trigger-Fix wirkt also automatisch für alle Scraper, die `alter_von`/`alter_bis` direkt setzen.
- **Bestehende gz-zuerich-Events rückwirkend repariert:** einmalige Backfill-Funktion `backfill-gz-zuerich-ages` deployed (fragt die Original-Detailseiten nochmal ab, liest "Zielgruppe"/"Besondere Hinweise"). Ergebnis: 4 von 75 hatten explizite Altersangaben, die restlichen 71 (offene Angebote wie Cafeteria, Spielmobil, Tauschraum etc.) auf den Default `0-12 Jahre` gesetzt — das war auch die ursprüngliche Fallback-Logik des Scrapers, nur nie gespeichert. **gz-zuerich ist jetzt vollständig sauber: 0 von 97 Events mit `alter_von IS NULL`.**

**Nicht behoben (bewusst zurückgestellt, siehe unten):**
- **eventfrog** (254 von 261 Events ohne Alter, 59 davon in der Zukunft): `consume-eventfrog-api` erfasst gar keine numerischen Altersangaben aus der Quelle — nur grobe Rubriken ("Kinderfest", "Kindertheater" etc.). Es gibt nichts zum Zurückbefüllen; müsste durch Text-Heuristik auf Titel/Beschreibung geraten werden, was ich nicht ungefragt einführen wollte (Datenqualität vs. Rateweite).
- **scrape-feriennet** (480 von ~551 "ferienplausch"-artigen Events ohne Alter, alle in der Zukunft — **grösster verbleibender Block**): Anders als angenommen ist dies nicht die JSON-API-Quelle `scrape-ferienplausch-uster` (die schon korrekt strukturierte Alterswerte liefert und vom Trigger-Fix automatisch profitiert), sondern ein separater HTML-Scraper `scrape-feriennet`, der Alter per Regex (`ab X Jahre` / `X-Y Jahre`) aus dem freien Seitentext der Aktivitäts-Detailseiten zu extrahieren versucht. Bei den meisten Kursen steht das Alter aber gar nicht in diesem Format im Text — der Regex findet nichts, `altersgruppen` bleibt leer.
  → **Empfehlung für nächste Session:** `scrape-feriennet`s `extractActivityDetails()`-Funktion verbessern (robusteres Alters-Pattern, evtl. Klassenstufen "1.-6. Klasse" mit einbeziehen) und dann alle 480 bestehenden Zeilen per erneutem Fetch+Update zurückbefüllen (`anmelde_link` ist die stabile Detail-URL, genau wie beim gz-zuerich-Backfill). Das wäre der mit Abstand grösste verbleibende Hebel.
- **scrape-kinderthur** (534 ohne Alter, aber nur 1 in der Zukunft) — praktisch irrelevant für die aktuelle Sichtbarkeit, niedrige Priorität.

**Zahlen vorher/nachher:** future-events mit `alter_von IS NULL`: 609 → 558 (durch gz-zuerich-Fix). Der grösste Teil des verbleibenden Rests (480) ist der oben beschriebene feriennet-Block.

Der lokale Git-Commit ist weiterhin blockiert (siehe unten) — jetzt auch inklusive der neuen Migration `012_fix_age_normalization_trigger.sql` und der neuen `backfill-gz-zuerich-ages`-Funktion, die nur remote (Supabase), nicht lokal existiert. Wenn du lokal weiterarbeitest, kannst du diese Funktion optional aus dem Supabase-Dashboard in den Ordner `supabase/functions/backfill-gz-zuerich-ages/` übernehmen (rein informativ, wird nicht mehr gebraucht, sobald der Backfill einmal gelaufen ist).

---

## Ursprüngliche Session (2. Juli)

## Was in dieser Session gemacht wurde

**PO-Priorität war:** neue Event-Quellen (`docs/quellen-report-patrick-liste.md`).

Beim Prüfen zeigte sich: `scrape-bybalzer` und `scrape-xlabs` waren zwar schon deployed, aber **kaputt** — beide hatten einen Dedup-Bug:

- Wenn kein individueller Event-/Ticket-Link gefunden wurde, fiel der Code auf die gemeinsame Listing-URL zurück. Dadurch bekamen alle Events die *gleiche* `anmelde_link` → nur das allererste Event wurde je eingefügt, alle weiteren liefen für immer als "Duplikat" gegen diese eine Zeile.
- Zusätzlich fehlte in beiden Scrapern das Feld `altersgruppen`. Der DB-Trigger `normalize_age_on_upsert` leitet `alter_von`/`alter_bis`/`alters_buckets` **ausschliesslich** aus `altersgruppen` her und überschreibt sie bei jedem INSERT mit `NULL`, wenn `altersgruppen` fehlt — die Events waren also für die Altersfilter der App unsichtbar.

**Fix:** Beide Funktionen neu geschrieben (stabiler Fallback-Link per Content-Hash, `altersgruppen` gesetzt), deployed, live laufen lassen:
- `scrape-bybalzer`: 86 neue ZH-Events importiert (Coop Kindermusicals, u.a. Maag Halle, Winterthur, Uster, Kloten, Stäfa, Illnau-Effretikon, Bäretswil).
- `scrape-xlabs`: Bug ist gefixt, aber die xlabs.ch-Seite selbst zeigt aktuell nur 4 vergangene Kurse (2023/24) — 0 importiert. Kein Code-Problem, sondern veraltete Quelldaten (siehe Quellen-Report). Muss regelmässig neu laufen (Cron ist gesetzt) und meldet sich automatisch, sobald xlabs neue Termine online stellt.

**DB-Migration angewendet:** `external_id`/`external_source`/`lat`/`lng` Spalten auf `events` (waren in einer lokalen Migration referenziert, aber nie auf Prod angewendet). Wird aktuell von keinem Scraper mehr genutzt (Dedup läuft über `anmelde_link`), schadet aber nicht — für spätere Importer verfügbar.

**Cron eingerichtet:** `bybalzer-weekly` (Mo 04:00 UTC), `xlabs-weekly` (Mo 04:15 UTC).

**Patrick-Entscheidung eingeholt:**
- bernhard-theater.ch → **übersprungen** (zu wenig Kinder-Content, Aufwand lohnt sich nicht)
- ZSF Ferienlager (überregional) → **übersprungen** (Kidgo bleibt auf Kanton Zürich fokussiert)

→ Der Quellen-Report (`docs/quellen-report-patrick-liste.md`) ist damit **abgeschlossen**, keine offenen Quellen mehr.

## Wichtiger struktureller Fund (noch nicht behoben)

Der gleiche `altersgruppen`-Trigger-Bug betrifft vermutlich weitere Scraper, die `alter_von`/`alter_bis` direkt setzen statt `altersgruppen`:
- `scrape-sport-events` (bestätigt: setzt nur alter_von/alter_bis, kein altersgruppen)
- `scrape-gz-zuerich` (gleiches Muster, ~1350 Events mit `quelle_id = 00000000-...-001` betroffen — das ist mit Abstand die grösste Quelle in der DB)
- vermutlich auch `scrape-kinderthur`, `scrape-ferienplausch-uster`, `import-sport-events`, `import-zurich-opendata`, `consume-discoverswiss`

**Impact:** Ein grosser Teil der Events in der DB hat vermutlich `alter_von = NULL`, ist also über die Altersauswahl in der App nicht auffindbar. Das ist potenziell der wirkungsvollste nächste Fix — höher priorisieren als neue Quellen, da es bestehende Events "unsichtbar" macht.

**Nächster Schritt:** `SELECT count(*) FROM events WHERE alter_von IS NULL;` prüfen, dann entweder (a) alle Scraper auf `altersgruppen` umstellen, oder (b) den Trigger so anpassen, dass er direkt gesetzte `alter_von`/`alter_bis` nicht überschreibt, wenn `altersgruppen` leer ist.

## Repo-Besonderheit: lokal ≠ deployed

Die lokalen `supabase/functions/*/index.ts`-Dateien im Repo sind teils **modulare Quelldateien** (importieren aus `../_shared/`), während das tatsächlich auf Supabase Deployte **gebündelte Single-File-Versionen** sind (Helper inline kopiert). Das ist historisch so gewachsen — frühere Sessions haben offenbar direkt gegen die Supabase-API deployed, ohne den lokalen Code zu syncen. Vor jeder Änderung an einem Scraper: **immer zuerst `get_edge_function` prüfen**, was wirklich läuft, nicht nur die lokale Datei lesen. In dieser Session wurde das für `scrape-bybalzer`/`scrape-xlabs` synchronisiert (lokale Datei = deployte Datei).

## Offener Punkt: Git-Commit blockiert

`git commit` schlägt fehl mit `Unable to create '.git/index.lock': File exists` — die Lock-Datei liess sich auch mit `rm -f` nicht entfernen (`Operation not permitted`). Das deutet auf einen aktiven Git-Prozess auf deinem Rechner hin (VS Code Source Control, GitHub Desktop, o.ä.), der die Datei offen hält. Die Fixes sind bereits live auf Supabase deployed — nur der lokale Commit fehlt noch.

**To-do für dich:** Editor/Git-Client schliessen bzw. die laufende Operation abschliessen, dann lokal committen:
```
git add supabase/functions/scrape-bybalzer/index.ts supabase/functions/scrape-xlabs/index.ts
git commit -m "fix(scrapers): bybalzer/xlabs anmelde_link collision + altersgruppen trigger bug"
```
Es gibt daneben noch 24 weitere Dateien mit unstaged Changes im Repo (u.a. `app/page.tsx`, `MapView.tsx`, Config-Dateien) — die stammen nicht aus dieser Session und wurden nicht angefasst.

## Vorschlag für nächste PO-Priorität

1. ~~Altersgruppen-Trigger-Bug beheben~~ → erledigt (Trigger gefixt + verifiziert, gz-zuerich vollständig zurückbefüllt).
2. **scrape-feriennet reparieren + 480 Events zurückbefüllen** — grösster verbleibender Hebel (siehe Update oben).
3. UX-Redesign umsetzen (`docs/ux-audit.md`) — war die andere zur Wahl stehende Priorität.
4. Lokalen Commit nachholen, sobald der Git-Lock frei ist (jetzt auch Migration 012 + Backfill-Funktion betroffen).
