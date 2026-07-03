# QA-Lauf — 3. Juli 2026

Systematischer Qualitäts-Check über DB-Daten, Supabase-Security/Performance-Advisors,
Scraper/Cron-Zustand und Code. **Reine Bestandsaufnahme** — nichts hiervon wurde
gefixt, das ist Grundlage für die Priorisierung mit dem PO.

## Kritisch

**1. `scrape-kinderthur`: Datums-Bug betrifft 34% aller Zukunfts-Events**
Alle 534 künftigen Events von kinderthur.ch (Circus Knie, Afropfingsten,
BiblioWeekend, ...) tragen exakt dasselbe Datum: `2026-09-15`. Ursache:
`extractDate()` matcht per Regex das erste `TT.MM.JJJJ`-Muster im gesamten
`content.rendered`-HTML der WordPress-API — trifft dabei offenbar auf eine
Boilerplate-/Widget-Textstelle statt das echte Event-Datum. Der Bug ist **aktiv**
(läuft wöchentlich über `kidgo-pipeline-weekly` → `pipeline-orchestrator`):
66 der 534 Zeilen kamen erst letzte Woche neu dazu, alle mit demselben Fake-Datum.
Impact: knapp ein Drittel aller Zukunfts-Events ist im Planer/in "diese Woche"-
Ansichten faktisch unauffindbar bzw. am falschen Tag einsortiert.

## Hoch

**2. 880 von 1861 Events (47%) ohne Bild** (`kategorie_bild_url` leer). Es gibt
eine `assign-event-images`-Function, aber sie taucht in keinem der 4 aktiven
Cron-Jobs auf — unklar, ob/wie regelmässig sie überhaupt läuft. Karten wirken
für fast die Hälfte aller Events leer/unfertig.

**3. 61 vergangene Events noch mit `status = 'approved'`.** Es existiert eine
Funktion `cleanup_past_events()`, die genau das beheben würde — sie ist aber in
keinem Cron-Job eingeplant, läuft also nie automatisch.

**4. Cross-Source-Duplikate:** Dedup läuft ausschliesslich über exakten
`anmelde_link` — nicht über Titel+Datum+Ort. Gefunden: "Schellen-Ursli" doppelt
(einmal über eventfrog, einmal über bybalzer — dieselbe Vorstellung, zwei
Ticketkanäle), "Harry P.Otter und die Zauberprüfung" gleich **7x** am selben Tag
über eventfrog (vermutlich separate Session-/Ticket-IDs für dieselbe Show).
Nutzer sehen dasselbe Event ggf. mehrfach in Listen.

**5. 3 Views mit `SECURITY DEFINER`** (ERROR-Level im Supabase-Security-Advisor):
`events_mit_quelle`, `quellen_dashboard`, `event_rating_summary`. Diese Views
umgehen RLS der abfragenden Person — sollten vor Go-Live auf `SECURITY INVOKER`
umgestellt werden (Standard-Supabase-Empfehlung, [Doku](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)).

## Mittel

**6. eventfrog: 59 zukünftige Events ohne Altersangabe** — bekannte, bereits
dokumentierte Limitation (Quelle liefert nur grobe Rubriken wie "Kindertheater",
keine Zahlen). Kein Fix ohne Text-Heuristik auf Titel/Beschreibung möglich.

**7. RLS-Performance-Schulden:** 22× `auth_rls_initplan` (Policies werten
`auth.uid()` pro Zeile statt einmal aus) + 84× `multiple_permissive_policies`
(mehrere überlappende Policies je Tabelle/Aktion, v.a. auf `events`, `quellen`,
`kategorien`). Bei 2 Nutzern irrelevant, bremst aber jede Query, sobald echter
Traffic kommt — mechanischer, risikoarmer Cleanup.

**8. `pipeline_runs`-Tabelle: RLS aktiv, aber 0 Policies.** Falls ein
Pipeline-Monitoring/Admin-Dashboard darauf zugreifen soll, ist der Zugriff aktuell
für alle (auch Admins) blockiert.

**9. `cleanup_past_events()` ist öffentlich aufrufbar** (SECURITY DEFINER-Funktion,
per RPC von `anon` und `authenticated` ausführbar). Sollte auf Zugriffsbeschränkung
oder `SECURITY INVOKER` geprüft werden — unabhängig davon, ob sie (siehe Punkt 3)
überhaupt sinnvoll genutzt wird.

**10. "Leaked Password Protection" in Supabase Auth ist deaktiviert.** Ein-Klick-
Fix, prüft neue Passwörter gegen HaveIBeenPwned — sinnvoll bevor echte Nutzer sich
registrieren.

## Niedrig

**11.** 11 Funktionen mit "mutable search_path" (WARN, Standard-Hardening,
mechanischer Batch-Fix, z.B. `normalize_age_on_upsert`, `parse_age_range`, u.a.).

**12.** 1 unindexed Foreign Key (`user_bookmarks.event_id`) + 4 ungenutzte
Indizes — bei aktuell 2 Nutzern noch ohne Wirkung, aber günstig vorab zu fixen.

**13.** Zwei tote State-Variablen in `app/page.tsx` (`wochenplanerOpen`,
`challengeAccepted`/`showChallengeEvents` — bereits in Session vom 3. Juli als
Cleanup-Kandidat notiert, nicht entfernt).

**14.** Bestätigt erneut: `git status`/`git diff` über das bash-Tool auf diesem
Repo zeigt Phantom-Diffs (CRLF-Mount-Cache), z.B. gerade eben bei
`lib/analytics.ts` — kein echtes Problem, nur ein Hinweis für die nächste
Session, dem bash-Output hier nicht blind zu vertrauen.

## Nicht neu, aber weiterhin offen (aus vorherigen Sessions)

- Zwei tote State-Variablen (siehe Punkt 13).
- `docs/measurement-plan.md`/`docs/user-interview-guide.md` (Phase 4-Vorbereitung)
  sind fertig, warten auf echten Traffic bzw. Patricks Durchführung.
