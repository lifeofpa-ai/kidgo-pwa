# Quellen-Report: Patrick-Liste

Stand: 2026-06-11 — Recherche-Ergebnisse für die geplanten neuen Event-Quellen.

---

## 1. bybalzer.ch (inkl. Coop Kindermusicals)

**URL:** https://www.bybalzer.ch  
**Coop Kindermusicals:** https://www.coopkindermusicals.ch → leitet zu bybalzer.ch weiter

**Was es ist:**  
Tournee-Musicals für Kinder in der Deutschschweiz (Aschenputtel, Schneewittli, Schellen-Ursli, ChinderHelde). Produziert/verteilt Coop Kindermusicals.

**Daten-Struktur:**  
- CMS: Typo3 mit "Viz"-Framework (Visitorzilla)  
- Events sind **server-seitig gerendert** als `<li itemscope itemtype="http://schema.org/Event">` mit `itemprop="startDate"` und `itemprop="name"` — direkt via HTML-Scraping zugänglich
- Vollständige Event-Liste unter `/tickets` (147 Events aktuell)
- Kein API, kein RSS-Feed

**Zürich-Relevanz:**  
- Venue in Zürich Stadt: **Maag Halle**  
- Weitere ZH-Kanton Venues: Winterthur Casinotheater, Uster Stadthofsaal, Kloten Zentrum Schluefweg, Stäfa, Illnau-Effretikon, Bäretswil
- 10–20 Events im Kanton Zürich pro Saison

**Scraping-Methode:**  
HTML-Scraping von `/tickets` — schema.org Markup extrahieren (`startDate`, `name`, `addressRegion`, `addressLocality`)

**Geschätzter Aufwand:** 1–2 Std.  
**Empfehlung:** ✅ Umsetzen — klare Kinder-Events, gute HTML-Struktur

---

## 2. bernhard-theater.ch

**URL:** https://www.bernhard-theater.ch  

**Was es ist:**  
Zürich-spezifisches Theater mit Eigenproduktionen. Kein ausgewiesenes Kinderprogramm auf Anhieb erkennbar.

**Daten-Struktur:**  
- CMS: Typo3  
- **25 JSON-LD `@type: Event` Einträge pro Spielplan-Seite** — sehr gut scrape-bar  
- 258+ Shows auf `/spielplan/`  
- Kein RSS/iCal-Feed, kein API

**Zürich-Relevanz:**  
- Ausschliesslich in Zürich (Bernhard Theater)  

**Einschränkung:**  
Vorwiegend Erwachsenen-Theater (Comedy, Kabarett, Lesungen). Kinderstücke gibt es, aber sie sind nicht gefiltert/markiert. Müsste manuell auf Kinder-relevante Events eingegrenzt werden.

**Scraping-Methode:**  
JSON-LD von `/spielplan/` — `@type: Event` Objekte mit `startDate`, `name`, `location`

**Geschätzter Aufwand:** 2–3 Std. (inkl. Kinder-Filter-Logik)  
**Empfehlung:** ⚠️ Nur mit expliziter Kinder-Filter-Logik — Patrick entscheiden lassen

---

## 3. Coop Kindermusicals

→ **Siehe bybalzer.ch** (gleiche Domain, gleicher Datensatz)

---

## 4. ZSF — Stiftung ZSF (Zürcher Schulferien Freizeit)

**URL:** https://www.zsf.ch  
**Korrekte Bezeichnung:** Stiftung ZSF — Ferienlager für Kinder ab 2. Klasse

**Was es ist:**  
Einwöchige Ferienlager (Sport-, Frühlings-, Sommer-, Herbstferien) in stiftungseigenen Häusern im Berner Oberland, Tessin und Westschweiz. Themen: Kochen, Tennis, Klettern, Kanu, Kampfsport, Tiere, Kreativität etc. Angebot für Kinder ab ca. 8 Jahren.

**Daten-Struktur:**  
- CMS: Tablo (proprietär) + Turbo.js  
- **Kein API, kein RSS, kein iCal**  
- Lager-Listings unter `/ferienlager/sommerferien` etc.  
- Seiten sind **server-seitig gerendert** aber Struktur ist unübersichtlich — kein schema.org Markup, kein strukturiertes Datum
- Anmeldung läuft über externes System

**Zürich-Relevanz:**  
- Veranstaltungsort sind auswärtige Lagerheime (Berner Oberland etc.), nicht Zürich selbst  
- Zielgruppe sind Zürcher Kinder

**Scraping-Methode:**  
HTML-Scraping der Lager-Listing-Seiten — Aufwand erheblich da kein Schema  

**Geschätzter Aufwand:** 3–4 Std.  
**Empfehlung:** ⚠️ Überlegen ob Kidgo auch überregionale Lager zeigen soll — Patrick entscheiden lassen

---

## 5. X Labs Zürich

**URL:** https://xlabs.ch/de/zuerich/ueber-uns  

**Was es ist:**  
STEM-Lernzentrum in Zürich (Büttenweg 16, 8045 Zürich). Seit 2014 aktiv. Angebote:
- **Ferienkurse** (Wissenschafts-Camps, 1 Woche, CHF 375)
- **Kindergeburtstage** (Science-Parties)
- Allgemeine Workshops

**Daten-Struktur:**  
- CMS: Tilda Website Builder  
- **Vollständiges JSON-LD `@type: Event` Markup** auf `/de/zuerich/ferienkurse` — ideal zum Scrapen  
- Problem: Aktuelle Seite zeigt noch **2023-Daten** (veraltete Inhalte). Neue Kursdaten werden möglicherweise manuell eingetragen.
- Kein API, kein RSS

**Zürich-Relevanz:**  
- Ausschliesslich in Zürich (Büttenweg 16)  
- STEM/Wissenschaft für Kinder — sehr passend für Kidgo

**Scraping-Methode:**  
JSON-LD von `/de/zuerich/ferienkurse` — `startDate`, `endDate`, `name`, `description`, `offers.price`

**Geschätzter Aufwand:** 1–2 Std.  
**Einschränkung:** Datenpflege unregelmässig — Scraper liefert veraltete Events wenn Seite nicht aktualisiert wird

**Empfehlung:** ✅ Umsetzen, aber Datum-Filter wichtig (nur zukünftige Events importieren)

---

## Zusammenfassung

| Quelle | Methode | Zürich-Fokus | Aufwand | Empfehlung |
|---|---|---|---|---|
| bybalzer.ch / Coop Kindermusicals | HTML schema.org | Kanton ZH | 1–2 Std. | ✅ |
| bernhard-theater.ch | JSON-LD | Stadt ZH | 2–3 Std. | ⚠️ Patrick |
| ZSF Ferienlager | HTML-Scraping | Überregional | 3–4 Std. | ⚠️ Patrick |
| X Labs Zürich | JSON-LD | Stadt ZH | 1–2 Std. | ✅ |

**Klar machbar ohne Patrick-Entscheidung:** bybalzer.ch + X Labs  
**Braucht Klärung:** bernhard-theater.ch (Kinder-Filter), ZSF (überregional ok?)
