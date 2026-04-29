# UX-Audit: Kidgo App — Informationsarchitektur & Progressive Disclosure

**Datum:** 28. April 2026
**Scope:** Kidgo Familien-Event-App (PWA), Kanton Zürich
**Zielgruppe:** Tech-affine Eltern mit Kindern 0–12, urbaner Raum Zürich
**Methode:** Heuristische Evaluation basierend auf Codestruktur und Feature-Inventar

---

## 1. Ist-Analyse

### 1.1 Was funktioniert gut

**Starke Positionierung.** Kidgo positioniert sich als "intelligenter Familien-Assistent" statt als reiner Event-Katalog. Das ist differenzierend und erlaubt personalisierte Erlebnisse — ein klarer Vorteil gegenüber statischen Listings wie Zürich für Kinder oder Famigros.

**Personalisierung als Kern.** Die Altersauswahl als Einstiegspunkt und das Scoring-basierte Empfehlungssystem sind die richtigen Entscheidungen. Eltern suchen nicht "alle Events" — sie suchen "das Richtige für mein Kind, jetzt".

**Emotionales Interaction Design.** Der Card-Stack-Swipe (Tinder-Mechanik) macht aus der passiven Event-Suche eine spielerische Entdeckungsreise. Das senkt die Entscheidungsmüdigkeit und erhöht das Engagement.

**Visuelle Qualität.** Teal-Branding mit Glassmorphism, Nunito-Font und hexagonale Icons signalisieren Modernität und Vertrauen. Der Ansatz "elegant, nicht kindisch" trifft die Zielgruppe präzise — Eltern wollen keine Clown-Ästhetik.

**Technische Basis.** Next.js PWA mit Supabase ist eine solide, skalierbare Architektur. Offline-Fähigkeit und native App-Feeling sind für Eltern unterwegs essenziell.

### 1.2 Was nicht funktioniert

**Die Hauptseite ist ein Feature-Buffet.** 4000+ Zeilen in einer einzigen Page-Komponente mit 14+ eigenständigen Feature-Blöcken — das ist kein Screen, das ist eine Produktdemo. Kein Nutzer scrollt durch all diese Sektionen. Die meisten werden nie gesehen, erzeugen aber Ladezeit und kognitive Last.

**Fehlende Informationshierarchie.** Alle Features konkurrieren gleichzeitig um Aufmerksamkeit. Es gibt keinen klaren visuellen "Pfad" durch die Seite. Die Frage "Was soll ich als Erstes tun?" bleibt unbeantwortet.

**Redundante Zugänge zum gleichen Content.** Events sind erreichbar über: Empfehlungen, Card-Stack, Smart Collections, Saisonale Sektionen, Personalisiertes Dashboard, Explore-Seite, Map und Bookmarks. Das sind 8 Wege zum selben Ziel — verwirrend statt hilfreich.

**Feature-Überladung verschleiert den Kern.** Challenges, Badges, Wochenplaner und Community-Dashboard sind Features für Power-User. Auf der Hauptseite stehend, überfordern sie Erstnutzer und verwässern den Kernnutzen: "Finde das perfekte Event für dein Kind."

**Monolithische Komponente.** 4000+ Zeilen in einer Datei sind ein technisches Wartungs- und Performance-Problem. Jede kleine Änderung erfordert das Parsen der gesamten Seite. Code-Splitting und Lazy Loading werden dadurch massiv erschwert.

### 1.3 Informationsarchitektur-Probleme

| Problem | Auswirkung | Schwere |
|---|---|---|
| Kein klarer Primary Action auf der Hauptseite | Nutzer wissen nicht, was sie tun sollen | Kritisch |
| Flache Hierarchie — alles auf einer Ebene | Cognitive Overload, hohe Absprungrate | Kritisch |
| Redundante Navigationsmodelle (Tab, Scroll, Swipe, Chat) | Orientierungslosigkeit | Hoch |
| Gamification (Badges/Challenges) auf der Hauptseite | Ablenkt vom Kernnutzen | Mittel |
| Wochenplaner als Hauptseiten-Feature | Zu komplex für den Einstieg | Mittel |
| Chat ("Frag Kidgo") konkurriert mit Browse | Unclear Mental Model — ist das eine Suchmaschine oder ein Chat? | Hoch |

---

## 2. Cognitive Load Assessment

### 2.1 Cognitive Load Inventar der Hauptseite

Jedes UI-Element auf der Hauptseite erzeugt kognitive Last. Die folgende Bewertung nutzt eine Skala von 1 (niedrig) bis 5 (hoch) für drei Dimensionen: **Intrinsische Last** (Komplexität des Elements), **Extrinsische Last** (unnötige Komplexität durch Darstellung) und **Germane Last** (produktive kognitive Verarbeitung — das Gute).

| Element | Intrinsisch | Extrinsisch | Germane | Bewertung |
|---|---|---|---|---|
| Altersauswahl | 2 | 1 | 5 | Behalten — hoher Nutzen, niedrige Last |
| 3 Empfehlungen mit Scoring | 3 | 2 | 5 | Behalten — Kernfeature |
| Card-Stack Swipe | 3 | 3 | 4 | Behalten, aber verschieben |
| "Frag Kidgo" Chat | 4 | 4 | 3 | Reduzieren — zu prominent für sekundäres Feature |
| Quick Actions | 2 | 2 | 3 | Behalten, konsolidieren |
| Smart Collections | 2 | 3 | 3 | Verschieben nach Explore |
| Wochenplaner | 5 | 4 | 4 | Eigene Seite — zu komplex für Hauptseite |
| Saisonale Sektionen | 2 | 3 | 3 | In Empfehlungen integrieren |
| Dashboard (Heute/WE/Community) | 4 | 4 | 3 | Vereinfachen — drei Tabs sind zu viel |
| Collapsible Sections | 1 | 2 | 1 | Symptombekämpfung — zeigt, dass zu viel da ist |
| Challenges + Badges | 3 | 3 | 2 | Verschieben — Gamification ist kein Einstieg |
| Bookmarks | 1 | 1 | 3 | Eigene Seite (existiert bereits) |
| Pull-to-refresh | 1 | 1 | 2 | Behalten — erwartetes Pattern |
| Wetter-Integration | 1 | 1 | 4 | Behalten — kontextuell wertvoll |

### 2.2 Gesamtbewertung

Die Hauptseite hat eine **kumulierte kognitive Last von ~50 Einheiten** bei einer empfohlenen Obergrenze von ~20 für einen Mobile-Screen. Das ist 2.5x über dem Optimum.

**Miller's Law (7±2 Regel):** Die Hauptseite präsentiert 14+ distinkte Informationsgruppen. Das menschliche Arbeitsgedächtnis verarbeitet 5–9 Chunks gleichzeitig. Kidgo fordert das Doppelte.

**Hick's Law:** Mehr Optionen = längere Entscheidungszeit = höhere Absprungrate. Eine Hauptseite mit 14+ Aktionsmöglichkeiten führt zu Decision Paralysis — besonders bei Eltern, die oft unter Zeitdruck stehen und "schnell was finden" wollen.

### 2.3 Was muss weg von der Hauptseite

**Sofort entfernen oder verschieben:**

- Wochenplaner → eigene Seite/Tab
- Challenges + Badges → eigenes Profil-/Gamification-Tab
- Community-Dashboard → eigene Sektion unter Profil oder Explore
- Smart Collections → integrieren in Explore-Seite
- Collapsible Sections → werden überflüssig, wenn weniger Inhalt da ist

**Was bleiben muss:**

- Altersauswahl (einmalig, dann persistent in Header)
- Personalisierte Empfehlungen (Kern-Value-Proposition)
- Wetter-Kontext (klein, kontextuell)
- Ein schneller Zugang zum Entdecken (Card-Stack ODER Explore, nicht beides)

---

## 3. Progressive Disclosure Konzept

### 3.1 Grundprinzip

Progressive Disclosure bedeutet: **Zeige nur das, was im aktuellen Kontext relevant ist.** Der Nutzer soll bei jedem Schritt genau die Informationen sehen, die er braucht — nicht mehr und nicht weniger.

Für Kidgo übersetze ich das in ein **3-Layer-Modell:**

```
Layer 1: SOFORT SICHTBAR (above the fold)
→ Beantwortet: "Was kann ich JETZT mit meinen Kindern machen?"

Layer 2: EINE INTERAKTION ENTFERNT (Scrollen oder Tippen)
→ Beantwortet: "Was gibt es noch zu entdecken?"

Layer 3: BEWUSSTE NAVIGATION (Tab-Wechsel, Suche)
→ Beantwortet: "Ich will etwas Bestimmtes finden/planen."
```

### 3.2 Layer 1 — Der Einstieg (above the fold, ~600px)

**Ziel:** In 3 Sekunden den Kernnutzen kommunizieren und eine Aktion anbieten.

```
┌─────────────────────────────────┐
│  [Glassmorphism Header]         │
│  Hallo [Name]! ☀️ 18° Zürich    │
│  [Alters-Chips: 0-2 3-5 6-9 …] │
├─────────────────────────────────┤
│                                 │
│  "Perfekt für euch heute"       │
│  ┌─────────────────────────┐    │
│  │  [Hero-Empfehlung #1]   │    │
│  │  Bild, Titel, Alter,    │    │
│  │  Distanz, Wetter-Match  │    │
│  │  [Mehr erfahren →]      │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌──────────┐ ┌──────────┐     │
│  │ Empf. #2 │ │ Empf. #3 │     │
│  └──────────┘ └──────────┘     │
│                                 │
└─────────────────────────────────┘
```

**Begründung:** Eine Hero-Empfehlung plus zwei kleinere Cards folgen dem F-Pattern des Blickverlaufs. Der Nutzer hat sofort etwas Konkretes, das er tun kann. Die Alters-Chips sind persistent und erlauben schnellen Kontextwechsel.

### 3.3 Layer 2 — Entdecken (beim Scrollen)

```
┌─────────────────────────────────┐
│  "Mehr entdecken"               │
│  ┌─────────────────────────┐    │
│  │  [Card-Stack Swipe]     │    │
│  │  Swipe für mehr          │    │
│  │  Vorschläge              │    │
│  └─────────────────────────┘    │
│                                 │
│  ─── Dieses Wochenende ──────  │
│  [Horizontal Scroll: 4-5 Cards] │
│                                 │
│  ─── Beliebt bei [Alter] ────  │
│  [Horizontal Scroll: 4-5 Cards] │
│                                 │
└─────────────────────────────────┘
```

**Begründung:** Horizontale Scroll-Listen (Netflix-Pattern) erlauben das Zeigen vieler Optionen ohne vertikale Überlastung. Jede Liste hat einen klaren kontextuellen Rahmen (Wochenende, Alter, Saison). Der Card-Stack wird hier platziert — als bewusste Exploration, nicht als Einstiegspunkt.

### 3.4 Layer 3 — Tiefere Funktionen (Navigation)

Wochenplaner, Chat, Challenges, Community — all das lebt hinter bewusster Navigation. Der Nutzer findet es, wenn er danach sucht, aber es drängt sich nicht auf.

### 3.5 Erstnutzer vs. Wiederkehrende Nutzer

| Situation | Layer 1 zeigt | Warum |
|---|---|---|
| Erstnutzer, kein Profil | Onboarding-Flow → Altersauswahl → erste Empfehlungen | Kalte Personalisierung vermeiden |
| Wiederkehrend, Wochentag | "Heute Nachmittag"-Empfehlungen | Zeitkontext nutzen |
| Wiederkehrend, Freitag ab 16h | "Dieses Wochenende"-Empfehlungen | Planungskontext antizipieren |
| Power-User mit Bookmarks | "Deine gemerkten Events diese Woche" als erste Karte | Kontinuität belohnen |

---

## 4. Navigation & IA Redesign

### 4.1 Aktuelle Struktur (Probleme)

```
[Home] [Explore] [Map] [Profil]
   │
   └── 14+ Feature-Blöcke auf einer Seite
       (Empfehlungen, Swipe, Chat, Planer,
        Collections, Dashboard, Badges, ...)
```

**Probleme:**
- Home versucht alles zu sein
- Explore und Home-Collections sind redundant
- Kein dedizierter Platz für Planer und Gamification
- Chat hat keinen festen Ort

### 4.2 Vorschlag: Neue Informationsarchitektur

```
Primäre Navigation (Bottom Tabs):
┌──────────────────────────────────────────────┐
│  [Für dich]   [Entdecken]   [Planer]  [Ich] │
└──────────────────────────────────────────────┘

Sekundäre Navigation (innerhalb der Tabs):
├── Für dich (Home)
│   ├── Personalisierte Empfehlungen
│   ├── Card-Stack Swipe
│   ├── Kontextuelle Listen (Wochenende, Saison)
│   └── Wetter-Kontext
│
├── Entdecken
│   ├── Suchfeld + Filter
│   ├── Karte (integriert, Toggle)
│   ├── Smart Collections
│   ├── Kategorien
│   └── Alle Events (Liste)
│
├── Planer
│   ├── Wochenkalender
│   ├── Gebuchte/Gemerkte Events
│   └── Vorschläge für freie Slots
│
└── Ich (Profil)
    ├── Familienprofil + Altersprofile
    ├── Bookmarks
    ├── Besuchte Events (History)
    ├── Challenges + Badges
    ├── Community
    └── Einstellungen
```

### 4.3 Begründung der Änderungen

**"Für dich" statt "Home".** Der Name kommuniziert sofort Personalisierung. Es ist kein generischer Startscreen, sondern ein kuratiertes Erlebnis.

**Explore und Map zusammenführen.** Karte und Liste sind zwei Ansichten desselben Contents — ein Toggle (Liste ↔ Karte) innerhalb von "Entdecken" ist intuitiver als zwei separate Tabs. Das spart einen Tab-Slot.

**Planer als eigener Tab.** Der Wochenplaner ist ein Power-Feature, das seine eigene Umgebung verdient. Auf der Hauptseite überfordert er; als eigener Tab wird er zum differenzierenden Feature.

**"Ich" bündelt alles Persönliche.** Bookmarks, History, Badges, Community — alles, was "mein" ist, lebt hier. Das entlastet die Hauptseite massiv.

### 4.4 "Frag Kidgo" Chat — Floating Action Button

Der Chat wird kein Tab, sondern ein **Floating Action Button (FAB)** unten rechts, verfügbar auf allen Seiten. Begründung:

- Ein Chat ist kein "Ort", sondern ein "Werkzeug" — er gehört nicht in die primäre Navigation
- FAB-Pattern ist etabliert (WhatsApp, Google Maps, Intercom)
- Kontextuell: Der Chat kann den aktuellen Screen-Kontext nutzen ("Ich bin auf der Event-Detail-Seite → der Chat weiss, welches Event gemeint ist")

```
┌─────────────────────┐
│                     │
│    [Screen]         │
│                     │
│              ┌───┐  │
│              │ 💬│  │ ← FAB, expandiert zu Chat-Sheet
│              └───┘  │
├─────────────────────┤
│ [Für dich] [...] .. │
└─────────────────────┘
```

---

## 5. Wireframe-Beschreibungen

### 5.1 "Für dich" — Redesigned Home Screen

```
┌─────────────────────────────────────┐
│ ░░░░ GLASSMORPHISM HEADER ░░░░░░░░ │
│ Hallo Patrick!        ☀️ 18° │ 🔔  │
│ ┌─────┐┌─────┐┌─────┐┌─────┐      │
│ │ 0-2 ││ 3-5 ││ 6-9 ││10-12│      │
│ └─────┘└─────┘└─────┘└─────┘      │
├─────────────────────────────────────┤
│                                     │
│ Perfekt für euch heute              │
│ ┌─────────────────────────────────┐ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │                             │ │ │
│ │ │   [HERO IMAGE]              │ │ │
│ │ │                             │ │ │
│ │ │   Wildnispark Langenberg    │ │ │
│ │ │   🎯 98% Match · 📍 12 Min  │ │ │
│ │ │   ☀️ Perfektes Wetter       │ │ │
│ │ │                             │ │ │
│ │ │   [Details ansehen →]       │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌───────────────┐ ┌───────────────┐ │
│ │ [Empf. #2]    │ │ [Empf. #3]    │ │
│ │ Kinderzoo     │ │ Naturmuseum   │ │
│ │ 92% · 8 Min   │ │ 89% · 15 Min  │ │
│ └───────────────┘ └───────────────┘ │
│                                     │
│ ─── scroll indicator ────────────── │
│                                     │
│ ✨ Mehr entdecken                   │
│ ┌─────────────────────────────────┐ │
│ │      CARD STACK SWIPE           │ │
│ │   (Top-Karte sichtbar,         │ │
│ │    gestapelte Karten dahinter)  │ │
│ │                                 │ │
│ │   [← Nein]    [Ja! →]          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Dieses Wochenende  [Alle →]        │
│ ┌──────┐┌──────┐┌──────┐┌──────┐  │
│ │Card 1││Card 2││Card 3││Card 4│→ │
│ └──────┘└──────┘└──────┘└──────┘  │
│                                     │
│ Beliebt bei 3–5-Jährigen [Alle →]  │
│ ┌──────┐┌──────┐┌──────┐┌──────┐  │
│ │Card 1││Card 2││Card 3││Card 4│→ │
│ └──────┘└──────┘└──────┘└──────┘  │
│                                     │
│                          ┌───────┐  │
│                          │  💬   │  │
│                          │Kidgo  │  │
│                          └───────┘  │
├─────────────────────────────────────┤
│ [Für dich] [Entdecken] [Planer] [Ich]│
└─────────────────────────────────────┘
```

**Design-Entscheidungen:**

- **Hero-Card dominant:** Eine grosse Empfehlung ist überzeugender als drei gleichgrosse. Die Hero-Card beantwortet sofort: "Was soll ich heute machen?"
- **Match-Score prominent:** "98% Match" schafft Vertrauen in die Personalisierung und Neugier.
- **Wetter-Integration inline:** Keine separate Sektion, sondern kontextuell in der Empfehlung ("Perfektes Wetter" als Nudge).
- **Card-Stack erst nach Scrollen:** Wer die Top-3 nicht überzeugend findet, kann spielerisch weiter entdecken.
- **Horizontale Listen für zeitlichen Kontext:** "Dieses Wochenende" und altersbasierte Listen nutzen das Netflix-Pattern — bewährt und platzeffizient.
- **FAB für Chat:** Immer erreichbar, nie im Weg.

### 5.2 "Entdecken" — Unified Search & Browse

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────┐     │
│ │ 🔍 Events suchen...        │     │
│ └─────────────────────────────┘     │
│                                     │
│ ┌──────┐┌───────┐┌────────┐┌────┐  │
│ │Outdoor││Indoor ││Kreativ ││Alle│  │
│ └──────┘└───────┘└────────┘└────┘  │
│                                     │
│ ┌─────────────────┐┌───────────┐   │
│ │  📋 Liste       ││  🗺️ Karte │   │
│ └─────────────────┘└───────────┘   │
│                                     │
│ [Filter-Chips: Alter, Entfernung,   │
│  Preis, Datum, Wetter]              │
│                                     │
│ 42 Events gefunden                  │
│ ┌─────────────────────────────────┐ │
│ │ [Event Card 1]                  │ │
│ ├─────────────────────────────────┤ │
│ │ [Event Card 2]                  │ │
│ ├─────────────────────────────────┤ │
│ │ [Event Card 3]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│            ... scroll ...           │
│                                     │
├─────────────────────────────────────┤
│ [Für dich] [Entdecken] [Planer] [Ich]│
└─────────────────────────────────────┘
```

**Design-Entscheidungen:**

- **Liste ↔ Karte als Toggle:** Spart einen Tab und ist Standard (Airbnb, Google Maps).
- **Smart Collections werden zu Kategorie-Chips:** "Outdoor", "Indoor", "Kreativ" etc. — schneller Zugang ohne eigene UI-Sektion.
- **Filter-Chips statt verstecktem Filtermenü:** Sichtbare Filter reduzieren die Interaction Cost.

### 5.3 "Planer" — Wochenansicht

```
┌─────────────────────────────────────┐
│ ← April 2026                    → │
│                                     │
│ Mo  Di  Mi  Do  Fr  Sa  So         │
│ 27  28  29  30  01  02  03         │
│          ●           ●●            │
│                                     │
│ ─── Donnerstag, 30. April ──────── │
│                                     │
│ Noch nichts geplant!                │
│ [Vorschläge anzeigen →]             │
│                                     │
│ ─── Samstag, 2. Mai ────────────── │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔖 Zoo Zürich (gemerkt)        │ │
│ │    10:00 – 16:00 · 3-5 Jahre   │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🎫 Kindermuseum (gebucht)      │ │
│ │    14:00 – 16:30 · 6-9 Jahre   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 💡 Tipp: Sonntag ist noch frei —   │
│    wie wär's mit Uetliberg?        │
│                                     │
├─────────────────────────────────────┤
│ [Für dich] [Entdecken] [Planer] [Ich]│
└─────────────────────────────────────┘
```

**Design-Entscheidungen:**

- **Wochenstreifen statt Vollkalender:** Mobile-optimiert, zeigt genau den relevanten Zeitraum.
- **Punkte als Indikatoren:** Schnelle visuelle Orientierung ohne Informationsüberflutung.
- **Proaktive Vorschläge für leere Tage:** Nudge zur Nutzung, ohne aufdringlich zu sein.

---

## 6. Priorisierte Massnahmen

### Phase 1: Foundation (2–3 Wochen, hoch priorisiert)

| # | Massnahme | Aufwand | Impact |
|---|---|---|---|
| 1.1 | **Hauptseite aufteilen:** 4000-Zeilen-Komponente in Feature-Module zerlegen. Eigene Dateien für Hero-Empfehlungen, Card-Stack, horizontale Listen etc. | 5 Tage | Hoch — Basis für alles Weitere |
| 1.2 | **Layer 1 implementieren:** Header mit Wetter + Alters-Chips, Hero-Empfehlung + 2 Sub-Cards als above-the-fold-Content | 3 Tage | Kritisch — First Impression |
| 1.3 | **Features von Hauptseite entfernen:** Wochenplaner, Challenges/Badges, Community-Dashboard, Collapsible Sections raus | 2 Tage | Hoch — Cognitive Load -50% |
| 1.4 | **Alters-Chips persistent machen:** Einmal gewählt, immer im Header sichtbar. Kein erneutes Auswählen nötig. | 1 Tag | Mittel |

### Phase 2: Navigation Restructure (2–3 Wochen)

| # | Massnahme | Aufwand | Impact |
|---|---|---|---|
| 2.1 | **4-Tab Navigation umbauen:** Home → "Für dich", Explore + Map → "Entdecken" (mit Toggle), neuer Tab "Planer", Profil → "Ich" | 5 Tage | Hoch |
| 2.2 | **Explore + Map zusammenführen:** Liste/Karte-Toggle implementieren. Smart Collections als Kategorie-Chips. | 3 Tage | Hoch |
| 2.3 | **"Ich"-Tab aufbauen:** Bookmarks, History, Badges, Profil-Einstellungen konsolidieren | 3 Tage | Mittel |
| 2.4 | **Planer-Tab:** Wochenstreifen-View mit gemerkten Events und Slot-Vorschlägen | 5 Tage | Mittel |

### Phase 3: Polish & Engagement (2–3 Wochen)

| # | Massnahme | Aufwand | Impact |
|---|---|---|---|
| 3.1 | **"Frag Kidgo" als FAB:** Bottom-Sheet-Chat auf allen Seiten, kontextbewusst | 3 Tage | Mittel |
| 3.2 | **Horizontale Scroll-Listen:** "Dieses Wochenende", "Beliebt bei [Alter]", saisonale Empfehlungen als Layer-2-Content | 3 Tage | Hoch |
| 3.3 | **Onboarding-Flow für Erstnutzer:** Altersauswahl → Interessen → erste Empfehlungen. Progressive Profiling. | 3 Tage | Hoch |
| 3.4 | **Lazy Loading:** Card-Stack und untere Listen erst laden, wenn sie in den Viewport scrollen | 2 Tage | Mittel — Performance |
| 3.5 | **Kontextuelle Startseite:** Freitag 16h → Wochenend-Modus. Regenwetter → Indoor-Empfehlungen zuerst. | 2 Tage | Hoch — Differenzierung |

### Phase 4: Validation (laufend)

| # | Massnahme | Aufwand | Impact |
|---|---|---|---|
| 4.1 | **A/B-Test:** Alte Hauptseite vs. neue "Für dich"-Seite. Messen: Time-to-first-click, Scroll-Tiefe, Event-Detail-Views | 3 Tage | Kritisch — Validierung |
| 4.2 | **User-Interviews:** 5–8 Eltern aus Zielgruppe. Task: "Finde ein Event für Samstag." Vergleich alt vs. neu | 5 Tage | Hoch |
| 4.3 | **Analytics-Review:** Heatmaps, Scroll-Depth, Feature-Nutzungsraten. Welche Features werden tatsächlich genutzt? | 2 Tage | Hoch |

---

## 7. Best Practices Vergleich

### 7.1 Netflix — Content Discovery

**Was Netflix gut macht:**

Netflix zeigt nicht "alle Filme". Es zeigt *die richtige Reihe zur richtigen Zeit*. Die Hauptseite besteht aus horizontal scrollbaren Listen mit kontextuellen Titeln ("Weil du X gesehen hast", "Trending", "Neu"). Jede Liste ist ein eigener Kontext — der Nutzer versteht sofort, warum diese Empfehlung kommt.

**Was Kidgo übernehmen sollte:**

- **Kontextuelle Listen-Titel:** Nicht "Smart Collections", sondern "Perfekt bei Sonnenschein", "Beliebt bei 3-Jährigen in Zürich", "Neu diese Woche". Jeder Titel erklärt das Warum.
- **Auto-Play Preview:** Netflix spielt Videos automatisch ab. Kidgo-Äquivalent: Die Hero-Card könnte ein kurzes Bild-Carousel haben, das automatisch durchläuft.
- **"Continue Watching" → "Gemerkte Events":** Eine persistente, personalisierte Liste oben, die Kontinuität signalisiert.

### 7.2 Spotify — Personalization at Scale

**Was Spotify gut macht:**

Spotify's "Made for You"-Sektion ist der Gold-Standard für algorithmische Personalisierung mit transparenter Erklärung. "Discover Weekly" gibt nicht einfach Empfehlungen — es erklärt sie ("Basierend auf deinem Musikgeschmack"). Die Startseite passt sich der Tageszeit an: Morgens ruhige Playlists, abends Party.

**Was Kidgo übernehmen sollte:**

- **Tageszeit-Adaptation:** Morgens → Indoor-Aktivitäten (Museen, Spielgruppen). Nachmittags → Outdoor (Parks, Spielplätze). Freitags → Wochenend-Planung.
- **"Dein Mix der Woche":** Eine kuratierte Auswahl von 5 Events, die wöchentlich neu generiert wird. Schafft einen Grund zurückzukommen.
- **Transparentes Scoring:** "98% Match, weil: draussen, altersgerecht, in der Nähe, gutes Wetter." Erklärt die Empfehlung und baut Vertrauen auf.

### 7.3 Google Maps (Family Features) — Kontextuelle Relevanz

**Was Google Maps gut macht:**

Maps zeigt Informationen basierend auf Kontext: Standort, Tageszeit, Wetter, Suchhistorie. Die "Explore"-Funktion gruppiert nach Aktivitätstyp und zeigt Entfernung, Bewertung und Öffnungszeiten — alles, was für eine Entscheidung nötig ist, auf einen Blick.

**Was Kidgo übernehmen sollte:**

- **Entfernung als First-Class-Info:** Immer sichtbar, immer in Minuten (nicht Kilometern). Eltern denken in "Wie lange dauert die Fahrt?", nicht in Distanz.
- **Öffnungszeiten/Verfügbarkeit prominent:** "Jetzt geöffnet" oder "Heute geschlossen" als Badge auf jeder Card — verhindert Frustration.
- **Karte als Overlay, nicht als eigene Seite:** Google Maps zeigt Infos AUF der Karte. Kidgo sollte die Karte als Layer in "Entdecken" integrieren, nicht als isolierte Seite.

### 7.4 Zusammenfassung — Pattern-Bibliothek für Kidgo

| Pattern | Vorbild | Kidgo-Adaption |
|---|---|---|
| Kontextuelle Horizontal-Listen | Netflix | Listen mit erklärenden Titeln statt generischer "Collections" |
| Tageszeit-Anpassung | Spotify | Morgens Indoor, Nachmittags Outdoor, Freitags Wochenend-Modus |
| Transparentes Scoring | Spotify "Made for You" | Match-Score mit Erklärung (Alter, Distanz, Wetter) |
| Karte als Toggle | Airbnb, Google Maps | Liste/Karte-Switch in "Entdecken" |
| Entfernung in Minuten | Google Maps | Auf jeder Event-Card |
| FAB für sekundäre Aktion | WhatsApp, Intercom | Chat als FAB statt als Hauptseiten-Sektion |
| Progressive Profiling | Duolingo | Onboarding in 3 Schritten, nicht 10 Felder auf einmal |
| Wöchentlicher Content-Drop | Spotify "Discover Weekly" | "Kidgo-Mix der Woche" — 5 kuratierte Events |

---

## Fazit

Kidgo hat ein starkes Produktfundament: gute Positionierung, relevante Features und eine moderne Tech-Basis. Das Kernproblem ist nicht *was* die App bietet, sondern *wie* sie es präsentiert. Die Hauptseite versucht, alles gleichzeitig zu zeigen, und überfordert damit genau die Eltern, die sie eigentlich entlasten soll.

Die zentrale Empfehlung lässt sich in einem Satz zusammenfassen: **Kidgo muss aufhören, eine Feature-Liste zu sein, und anfangen, ein Gespräch zu führen.** Ein guter Assistent sagt nicht "Hier sind 14 Dinge, die ich kann." Er sagt: "Ich glaube, das hier wäre heute perfekt für euch." Alles andere zeigt er erst, wenn man fragt.

Die vorgeschlagene 4-Phasen-Roadmap ist in 8–12 Wochen umsetzbar und priorisiert die Massnahmen mit dem höchsten User-Impact zuerst. Phase 1 (Foundation) allein wird die erlebte Qualität der App spürbar verbessern — weniger ist hier definitiv mehr.

---

*Erstellt am 28. April 2026 — UX-Audit basierend auf Feature-Inventar und heuristischer Evaluation.*
