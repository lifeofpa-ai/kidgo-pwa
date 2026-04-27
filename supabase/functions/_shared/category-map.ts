// Maps free-text descriptions / tags to Kidgo category buckets.
// Used by all importers (Eventfrog, OSM, Stadt ZH, Football-Data) to keep
// category tagging consistent.

export const KIDGO_CATEGORIES = [
  "Kreativ",
  "Natur",
  "Tiere",
  "Sport",
  "Tanz",
  "Theater",
  "Musik",
  "Wissenschaft",
  "Bildung",
  "Ausflug",
  "Feriencamp",
] as const;

export type KidgoCategory = (typeof KIDGO_CATEGORIES)[number];

const KEYWORD_MAP: Array<[KidgoCategory, RegExp]> = [
  ["Kreativ",      /\b(basteln|malen|kreativ|workshop|werkstatt|atelier|zeichnen|kunst)\b/i],
  ["Natur",        /\b(natur|wald|garten|park|wandern|outdoor|spielplatz)\b/i],
  ["Tiere",        /\b(tier|zoo|bauernhof|reiten|pony|aquarium)\b/i],
  ["Sport",        /\b(sport|fussball|fußball|hockey|schwimmen|klettern|turnen|velo|skating|kletter|baseball|tennis)\b/i],
  ["Tanz",         /\b(tanz|ballet|hip[- ]?hop|breakdance)\b/i],
  ["Theater",      /\b(theater|puppen|figuren|schauspiel|bühne)\b/i],
  ["Musik",        /\b(musik|konzert|gesang|chor|instrument)\b/i],
  ["Wissenschaft", /\b(experiment|technik|forscher|robotik|wissenschaft|naturwissenschaft)\b/i],
  ["Bildung",      /\b(lesen|geschichte|lernen|sprache|bildung|führung|vortrag)\b/i],
  ["Ausflug",      /\b(ausflug|wanderung|tagestrip|exkursion|besuch)\b/i],
  ["Feriencamp",   /\b(camp|ferienlager|ferien[- ]?pass)\b/i],
];

export function inferCategories(text: string): KidgoCategory[] {
  const found = new Set<KidgoCategory>();
  for (const [cat, rx] of KEYWORD_MAP) if (rx.test(text)) found.add(cat);
  return [...found];
}

export function inferIndoorOutdoor(text: string): "indoor" | "outdoor" | null {
  if (/\b(spielplatz|park|garten|outdoor|draußen|freibad|wald|wandern|ausflug)\b/i.test(text)) return "outdoor";
  if (/\b(indoor|drinnen|hallenbad|theater|museum|bibliothek|kino)\b/i.test(text))                  return "indoor";
  return null;
}
