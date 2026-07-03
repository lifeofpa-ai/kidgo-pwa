# User-Interview-Leitfaden — Phase 4.2 (Validation)

Stand: 3. Juli 2026. Aus `docs/ux-audit.md` 4.2: "5–8 Eltern aus Zielgruppe. Task:
'Finde ein Event für Samstag.' Vergleich alt vs. neu."

**Anpassung ggü. Audit-Wortlaut:** Ein Vergleich "alt vs. neu" ist nicht mehr möglich
— die alte Seite existiert nicht mehr im Code (siehe `docs/measurement-plan.md`,
Abschnitt 3, gleicher Befund). Dieser Leitfaden testet stattdessen den *aktuellen*
Stand als Baseline (Task-Erfolg, Denkweise, Stolpersteine). Diese Interviews können
**unabhängig von echtem Nutzungstraffic** durchgeführt werden — im Gegensatz zu
Phase 4.1/4.3 brauchst du hierfür nur die 5-8 Testpersonen, keine Datenbank-Zahlen.
Das macht das hier am ehesten sofort umsetzbar.

Ich (Claude) kann die Interviews nicht selbst führen — das ist an dir. Unten das
Recruiting, das Skript und der Auswertungsbogen.

## 1. Recruiting — Zielgruppe & Nachricht

**Zielgruppe:** 5-8 Eltern mit Kind(ern) im Alter 0-12, wohnhaft/aktiv im Kanton
Zürich, unterschiedlicher Technik-Affinität (nicht nur Early Adopters — mind. 2-3
Personen, die selten neue Apps ausprobieren).

**Recruiting-Nachricht (Vorlage, per WhatsApp/Mail an Bekannte oder Eltern-Gruppen):**

> Hoi! Ich baue gerade Kidgo, eine App, die Familien-Events im Kanton Zürich
> vorschlägt (Bastelkurse, Ausflüge, Theater etc. für Kinder). Ich suche 15-20 Minuten
> mit dir am Handy — du bekommst eine kleine Aufgabe ("Finde ein Event für Samstag"),
> ich schaue nur zu und höre zu, wie du denkst. Es gibt nichts falsch zu machen, mich
> interessiert nur, was für dich intuitiv ist. Passt dir [Tag/Zeit]? Video-Call oder
> persönlich, wie's dir lieber ist.

**Screening (kurz vorab abfragen, keine Vorauswahl nach "Erfahrung mit Apps"):**
- Kind(er) im Alter 0-12? Wohnort/Aktivität im Kanton Zürich?
- Schon mal aktiv nach Freizeitaktivitäten für Kinder gesucht (Google, Instagram,
  Mundpropaganda, etc.)?

## 2. Interview-Skript (ca. 15-20 Min. pro Person)

**Setup:** Bildschirm teilen lassen oder Handy zuschauen (nicht selbst bedienen).
Aufnehmen (Ton reicht, mit Einverständnis), Notizen parallel.

### a) Intro (2 Min.)
- "Danke, dass du dir Zeit nimmst. Es gibt kein richtig oder falsch — ich teste die
  App, nicht dich. Sag laut, was du denkst, auch wenn's dir komisch vorkommt oder
  du nicht weiterkommst — das ist für mich das Wichtigste."
- "Ich greife nicht ein, auch wenn's harzt. Wenn du wirklich nicht weiterkommst,
  sag Bescheid, dann helfe ich."

### b) Haupttask (5-8 Min., think-aloud)
- App öffnen lassen (frisch, ohne Vorwissen falls möglich — sonst Startzustand
  notieren, z.B. schon Onboarding durchlaufen oder nicht).
- Aufgabe: **"Finde ein Event für kommenden Samstag, das zu deinem Kind passen
  würde."**
- Nicht helfen. Beobachten und mitschreiben:
  - Wo klickt die Person zuerst? (Startseite-Karte, Tab-Leiste, Suche?)
  - Nutzt sie Filter (Alter, Kategorie, Indoor/Outdoor)? Findet sie diese?
  - Stockt sie irgendwo? Wo genau, wie lange?
  - Versteht sie die Empfehlungs-Badges ("Grund"-Tags auf der Hero-Card)?
  - Kommt sie zu einem Ergebnis, das sie überzeugt — merkt sie es / klickt sie
    weiter zum Detail?

### c) Nachfragen (5 Min.)
- "Was dachtest du, als du [Screen X] gesehen hast?"
- "War etwas überraschend oder unklar?"
- "Hättest du erwartet, dass [Feature Y] woanders ist?"
- "Auf einer Skala 1-5: Wie sicher warst du, dass das jetzt gefundene Event
  wirklich passt?"
- "Was hat dir gefehlt, um dich zu entscheiden?"

### d) Zweite Mini-Aufgabe, falls Zeit (3 Min.)
- **"Merk dir das Event für später"** (Bookmark) oder **"Schau, ob es auch am
  Sonntag noch was gäbe"** (Planer/Explore-Wechsel) — testet Cross-Tab-Navigation.

### e) Abschluss (2 Min.)
- "Würdest du das für echt nutzen? Was müsste anders sein, damit du's öfter
  aufmachst?"
- Danken, ggf. kleines Dankeschön (Gutschein o.ä. — deine Entscheidung).

## 3. Auswertungsbogen (nach jedem Interview ausfüllen)

Pro Person notieren:
- Task erfolgreich gelöst? (ja / mit Umweg / nein)
- Zeit bis zum ersten sinnvollen Klick (grob)
- Wo genau war der grösste Stolperstein (Screen + Beschreibung)
- Zitat, das die Reaktion am besten einfängt
- Feature, das unbemerkt blieb (falls eins)

Nach allen 5-8 Interviews: Muster suchen — taucht derselbe Stolperstein bei
mehreren Personen auf? Das sind die konkreten Kandidaten für die nächste
UX-Iteration, nicht Einzelmeinungen.
