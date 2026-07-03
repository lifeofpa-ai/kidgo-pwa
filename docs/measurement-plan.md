# Messungs-Plan — Phase 4 (Validation), Vorbereitung

Stand: 3. Juli 2026. Kontext: `docs/ux-audit.md` Phase 4 (A/B-Test, User-Interviews,
Analytics-Review) verlangt echten Nutzungstraffic. Aktueller Stand der DB:
`auth.users` = 2, `user_bookmarks`/`event_reviews`/`event_dismissals`/`user_profiles`
= 0 Zeilen. Es gibt also nichts, das man auswerten könnte — dieses Dokument bereitet
die Messung vor, statt eine Analyse aus 0 Datenpunkten zu erfinden.

**Wann ist Phase 4 sinnvoll durchführbar?** Als grober Richtwert: erst ab ~30-50
aktiven Nutzern über mind. 2 Wochen, damit Scroll-Tiefe/Time-to-first-click/
Feature-Nutzung statistisch überhaupt etwas hergeben. Bei 2 Nutzern ist jede Zahl
Rauschen.

## 1. Event-Tracking-Checkliste

Was `lib/analytics.ts` aktuell an GA4 sendet (Stand vor dieser Session), abgeglichen
gegen das, was Phase 4.1/4.3 des Audits braucht:

| Metrik (Audit-Anforderung) | Vorher getrackt? | Jetzt |
|---|---|---|
| Event-Klicks (`event_click`, Quelle: hero/sub/explore/similar/chat) | Ja | unverändert |
| Tab-Wechsel (`tab_switch`) | Ja | unverändered |
| Suche, Filter (`search`, `explore_filter`) | Ja | unverändert |
| Bookmark, Rating, Share, Dismiss | Ja | unverändert |
| Chat-Interaktionen (`chat_open`, `chat_message`, `chat_suggestion_click`) | Ja | unverändert |
| Onboarding-Funnel (`onboarding_start/step/skip/complete`) | Ja | unverändert |
| **Scroll-Tiefe** (Audit 4.1 + 4.3) | **Nein — Lücke** | **Neu:** `scroll_depth` (25/50/75/100%) auf Home + Explore, siehe `initScrollDepthTracking()` in `lib/analytics.ts` |
| **Time-to-first-click** (Audit 4.1) | **Nein — Lücke** | **Neu:** `time_to_first_interaction` (ms seit Seitenaufruf bis zur ersten von: event_click, search, chat_open, tab_switch, explore_filter) |
| Event-Detail-Views (Audit 4.1) | Indirekt via `event_click` | Reicht — jeder Klick führt zur Detailseite |
| Heatmaps (Audit 4.3) | Nein | **Nicht selbst gebaut** — siehe Abschnitt 3 (Empfehlung: GA4 reicht nicht für Heatmaps, dafür separates Tool nötig) |
| Feature-Nutzungsraten (Audit 4.3) | Teilweise (einzelne Events ja, aber keine Auswertung/Dashboard) | Siehe Abschnitt 2 (GA4-Dashboard-Plan) |

Code-Änderungen dieser Session: `lib/analytics.ts` (zwei neue Funktionen,
`trackEvent` erweitert), `app/page.tsx` und `app/explore/page.tsx` (je ein
`useEffect` zum Aktivieren des Scroll-Trackings). Kein Tracking auf der
Event-Detailseite oder im Planer ergänzt — bei Bedarf gleiches Muster
(`initScrollDepthTracking("event_detail")` etc.) übernehmen.

## 2. GA4-Dashboard-Plan (einrichten, sobald echte Sessions reinkommen)

Konkrete Explorations, die in GA4 angelegt werden sollten (heute noch nicht
gemacht, da 0 Sessions vorhanden sind — Anleitung für später):

1. **Funnel-Exploration "Für-dich-Nutzung":** `page_view` (Home) → `event_click`
   (Quelle `home_hero`/`home_sub`) → Detailseite → `event_bookmark`. Zeigt, wie viele
   Nutzer von der Startseite überhaupt zu einer Aktion kommen.
2. **Freiform-Exploration "Scroll-Tiefe pro Seite":** Dimension `page` (home/explore),
   Metrik = Ereignisanzahl von `scroll_depth`, aufgeschlüsselt nach `depth`. Zeigt, ob
   Nutzer über die Hero-Card hinaus scrollen oder abspringen.
3. **Freiform-Exploration "Time-to-first-interaction":** Durchschnitt/Median von `ms`
   aus `time_to_first_interaction`, gruppiert nach `source`. Achtung: Wert ist nur für
   echte Erstaufrufe sauber (SPA-Navigation innerhalb der Session zählt nicht neu,
   siehe Code-Kommentar in `lib/analytics.ts`) — als Trend über Zeit lesen, nicht als
   exakte Einzelzahl.
4. **Feature-Nutzungsraten-Tabelle:** Ereignisanzahl je Event-Name
   (`chat_open`, `explore_filter`, `map_view`, `event_share`, `event_rating`, ...)
   geteilt durch aktive Nutzer im Zeitraum → Prozentsatz, der ein Feature überhaupt
   anfasst. Das ist die direkte Antwort auf die Audit-Frage "Welche Features werden
   tatsächlich genutzt?".
5. **Retention/Wiederkehr:** GA4-Standardbericht "Kohorten" — sobald >2 Nutzer,
   zeigt das, ob die kontextuelle Startseite (Phase 3.5) Leute zum Wiederkommen bringt.

**Heatmaps (Audit 4.3):** GA4 selbst kann keine visuellen Heatmaps. Wenn das
gewünscht ist, braucht es ein Zusatz-Tool (z.B. Microsoft Clarity — kostenlos,
kein Zusatz-Consent-Aufwand nennenswert). Nicht eingerichtet in dieser Session,
da das eine Produktentscheidung ist (neues Tool/Skript einbinden) — sollte
Patrick vor dem Go-Live entscheiden, kein reiner Code-Fix.

## 3. A/B-Test (Audit 4.1) — warum "alt vs. neu" nicht mehr geht

Der Audit-Vorschlag war: alte Hauptseite vs. neue "Für dich"-Seite vergleichen.
Das **ist nicht mehr möglich** — die alte Seite existiert im Code nicht mehr, sie
wurde in den Phasen 1-3 vollständig durch das neue Design ersetzt (bestätigt bei
der UX-Redesign-Prüfung in dieser Session). Ein rückwirkender A/B-Test gegen eine
Version, die es nicht mehr gibt, würde Daten erfinden.

**Empfehlung für die Zukunft:** kein rückwirkender Vergleich, sondern
Infrastruktur für *künftige* Experimente:

- Für die nächste grössere Änderung (z.B. an Hero-Card, Onboarding-Flow) einen
  simplen Feature-Flag/Prozent-Split einbauen (z.B. Nutzer-ID-Hash mod 2), Variante
  als GA4-User-Property mitschicken (`ab_variant: "a" | "b"`).
  Alle bestehenden Tracking-Events (Scroll-Tiefe, Time-to-first-click,
  Event-Detail-Views) lassen sich dann automatisch nach Variante aufschlüsseln — ohne
  weiteren Code, da GA4 User-Properties auf jedes Event angewendet werden.
- Bis dahin dient der aktuelle Stand als **Baseline**: Sobald echte Nutzer da sind,
  liefern die in Abschnitt 2 beschriebenen Dashboards die Ausgangswerte
  (Time-to-first-click, Scroll-Tiefe, Feature-Nutzung), gegen die jede künftige
  Änderung verglichen werden kann.

## 4. Nächste Schritte (nicht Teil dieser Session, zur Priorisierung)

- Vor Go-Live: Clarity o.ä. für Heatmaps einbinden (Produktentscheidung, siehe oben).
- Nach den ersten ~30-50 aktiven Nutzern: GA4-Explorations aus Abschnitt 2 anlegen
  und tatsächlich Phase 4.3 (Analytics-Review) durchführen.
- Vor der nächsten grösseren UI-Änderung: Feature-Flag-Muster aus Abschnitt 3
  einbauen, damit die Änderung sich selbst A/B-testet statt nur "vorher/nachher"
  ohne Kontrollgruppe zu vergleichen.
- Siehe `docs/user-interview-guide.md` für Phase 4.2 (User-Interviews) — die
  brauchen keine Nutzungsdaten und können unabhängig vom Traffic-Stand
  durchgeführt werden.
