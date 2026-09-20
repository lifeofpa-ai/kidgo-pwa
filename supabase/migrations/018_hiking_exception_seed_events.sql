-- ============================================================
-- Familienwanderungen-Ausnahme: 10 kuratierte Trails (Zentral-/Ostschweiz)
-- Kidgo, 2026-09-20 — siehe Konzeptdokument "Wiedererkennung,
-- Personalisierung & Wanderungen-Ausnahme". Bild-URLs = Stufe 1
-- (og:image der offiziellen Seite, wo gefunden); NULL wo noch keines
-- gefunden wurde (Stufe 2 = manuelle Anfrage bei den Bergbahnen/
-- Tourismusbüros, noch offen).
--
-- Erfordert Migration 017 (event_typ-Wert 'wanderung_ausnahme' + Geo-Filter-
-- Bypass + Quelle 'Kidgo Redaktion (Familienwanderungen-Ausnahme)').
-- ============================================================

INSERT INTO public.events
  (id, titel, ort, region, beschreibung, kategorien, event_typ, alter_von, alter_bis, indoor_outdoor, saison_tags, status, quelle_id, anmelde_link, kategorie_bild_url)
VALUES
(
  '51ac5698-9a24-4eea-9016-e8fa2a9fa9d9', 'Globiweg Lenzerheide', 'Lenzerheide, GR', 'Lenzerheide (GR)',
  'Familienwanderung mit Globi-Erlebnisstationen rund um Lenzerheide. Leichter, kinderwagentauglicher Rundweg mit Spiel- und Rastplätzen entlang der Strecke – ideal für einen entspannten Tagesausflug mit kleinen Kindern in die Bündner Bergwelt.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.arosalenzerheide.swiss', NULL
),
(
  '191f5b35-dca2-488a-b9e0-598e86b2a59f', 'Bannalpsee – Circus Bannalp', 'Niederrickenbach, NW', 'Oberrickenbach (NW)',
  'Familienfreundliche Rundwanderung um den idyllischen Bannalpsee im "Circus Bannalp", umgeben von Bergpanorama. Anreise per Standseilbahn ab Niederrickenbach, danach flacher Weg rund um den See – Picknickplätze und Alpwirtschaften unterwegs.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.engelberg.ch',
  'https://www.engelberg.ch/fileadmin/_processed_/d/a/csm_Engelberg_Dorf_Sommer_1920x1080_a39862c4b0.jpg'
),
(
  '848203c9-f37a-4fb6-af01-8bbf305a97d4', 'Tannensee-Rundweg Melchsee-Frutt', 'Melchsee-Frutt, OW', 'Melchsee-Frutt (OW)',
  'Gemütlicher, weitgehend flacher Rundweg um den Tannensee auf dem autofreien Hochplateau Melchsee-Frutt. Kinderwagentauglich, mit Spielplätzen und Bergseen-Blick – ein beliebtes Ausflugsziel für Familien mit kleinen Kindern.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.titlis.ch', NULL
),
(
  '4ca890c5-6ef5-46b8-b7a5-b9c4f0405ac7', 'Fronalpstock Stoos', 'Stoos, SZ', 'Stoos (SZ)',
  'Familienwanderung auf dem Fronalpstock oberhalb von Stoos, erreichbar mit der steilsten Standseilbahn der Welt. Aussichtsreicher Höhenweg mit Panoramablick auf die Zentralschweizer Alpen und den Vierwaldstättersee, mit Bergrestaurants unterwegs.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.stoos.ch',
  'https://images.contenthub.dev/7l5wded27svb/6ddd12e53056c17cb5d92227fafd8e42/large_-Sonnenaufgangsfahrten%20Fronalpstock%20(1).jpg?w=630'
),
(
  'fa1879ce-c62e-49e4-bc26-e0a25a264a00', 'Klewenalp-Erlebnisweg', 'Beckenried, NW', 'Klewenalp (NW)',
  'Themen-Erlebnisweg auf der Klewenalp hoch über dem Vierwaldstättersee, mit Stationen rund um die Murmeltier-Maskottchen "Goldi". Kurze, familientaugliche Wegstrecke mit Spiel- und Erlebnisposten und weitem Seeblick.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.klewenalp.ch', NULL
),
(
  'e297f051-c144-4059-89c7-f8e01c08fd86', 'Tannenbodenalp Flumserberg', 'Flumserberg, SG', 'Flumserberg (SG)',
  'Familienfreundliches Wandergebiet auf der Tannenbodenalp im Flumserberg-Gebiet. Sanfte Rundwege durch Alpweiden mit Spielplätzen, Bergbeizli und schönem Blick über die Ostschweizer Bergwelt – gut geeignet für kürzere Familienausflüge.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.flumserberg.ch', NULL
),
(
  '036cc72c-e9c2-4688-af6a-8ab2bd72b248', 'Seealpsee via Ebenalp', 'Wasserauen, AI', 'Appenzell / Alpstein (AI)',
  'Wanderung von der Bergstation Ebenalp hinunter zum türkisblauen Seealpsee im Alpstein-Gebiet. Landschaftlich eindrückliche Strecke mit Alpwirtschaften am See – für geübtere Familien mit älteren Kindern, Anreise per Luftseilbahn ab Wasserauen.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.appenzell.ch', NULL
),
(
  '69b23159-c2ba-4052-a69e-55dc78f8f9b9', 'Golzernsee im Maderanertal', 'Golzern, Silenen, UR', 'Maderanertal (UR)',
  'Familienwanderung rund um den Stausee Golzernsee im urchigen Maderanertal, umrahmt von Gletschern und Wasserfällen. Anreise per Luftseilbahn ab Bristen, danach flacher Rundweg um den See – ein ruhiges, wenig überlaufenes Ausflugsziel.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.uri.info', NULL
),
(
  '610f6d1b-4a05-48e6-8b64-46d4b1171b53', 'Zwärgliweg Braunwald', 'Braunwald, GL', 'Braunwald (GL)',
  'Zwergenthematisierter Familienweg im autofreien Bergdorf Braunwald mit liebevoll gestalteten Zwergli-Stationen entlang der Strecke. Kurzer, einfacher Rundweg mit Panoramablick auf die Glarner Alpen – ideal für kleinere Kinder.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.braunwald.ch', NULL
),
(
  '01e102e6-67f8-458c-bd31-ecb23e6989ad', 'Sattel-Hochstuckli Familienweg', 'Sattel, SZ', 'Sattel-Hochstuckli (SZ)',
  'Familienberg Hochstuckli oberhalb von Sattel mit mehreren kurzen, leichten Rundwegen, Spielplätzen und Rutschbahn. Schnell ab Zürich erreichbar und dank Gondelbahn auch für kleine Kinder gut machbar – ein unkomplizierter Halbtagesausflug.',
  ARRAY['Natur','Wandern'], 'wanderung_ausnahme', 0, 12, 'outdoor', ARRAY['fruehling','sommer','herbst'],
  'approved', 'a1000000-0000-4000-8000-000000000001', 'https://www.hochstuckli.ch', NULL
)
ON CONFLICT (id) DO NOTHING;
