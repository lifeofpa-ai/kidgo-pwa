export interface InterestDef {
  id: string;
  label: string;
  categories: string[];
  keywords: string[];
}

export const INTERESTS: InterestDef[] = [
  {
    id: "sport",
    label: "Sport & Bewegung",
    categories: ["Sport"],
    keywords: ["sport", "turnen", "klettern", "fussball", "fußball", "bewegung", "leichtathletik"],
  },
  {
    id: "kreativ",
    label: "Kreativ & Basteln",
    categories: ["Kreativ", "Mode & Design"],
    keywords: ["bastel", "malen", "kreativ", "kunst", "töpfer", "zeichn", "werken"],
  },
  {
    id: "musik",
    label: "Musik & Tanz",
    categories: ["Musik", "Tanz"],
    keywords: ["musik", "konzert", "singen", "tanz", "tanzen", "rhythmus"],
  },
  {
    id: "theater",
    label: "Theater & Aufführungen",
    categories: ["Theater"],
    keywords: ["theater", "puppentheater", "aufführung", "bühne", "schauspiel"],
  },
  {
    id: "natur",
    label: "Natur & Tiere",
    categories: ["Natur", "Tiere"],
    keywords: ["natur", "wald", "tiere", "zoo", "bauernhof", "pflanzen"],
  },
  {
    id: "wissen",
    label: "Museum & Wissen",
    categories: ["Bildung", "Wissenschaft", "Ausflug"],
    keywords: ["museum", "ausstellung", "galerie", "wissenschaft", "experiment", "forschen"],
  },
  {
    id: "schwimmen",
    label: "Schwimmen & Wasser",
    categories: [],
    keywords: ["schwimm", "bad", "wasser", "badi", "freibad", "hallenbad", "aqua"],
  },
  {
    id: "camp",
    label: "Feriencamps",
    categories: ["Feriencamp"],
    keywords: ["camp", "ferienlager", "ferien", "lager"],
  },
  {
    id: "indoor",
    label: "Indoor-Spielplätze",
    categories: [],
    keywords: ["spielplatz", "indoor", "spielhalle", "trampolin", "kletterhalle", "hüpfburg"],
  },
  {
    id: "kochen",
    label: "Kochen & Backen",
    categories: [],
    keywords: ["kochen", "backen", "küche", "kochkurs", "backworkshop"],
  },
  {
    id: "zirkus",
    label: "Zirkus & Akrobatik",
    categories: [],
    keywords: ["zirkus", "akrobatik", "jonglier", "artistik", "zirkusschule"],
  },
];

export function eventMatchesInterests(
  event: {
    kategorien: string[] | null;
    kategorie: string | null;
    beschreibung: string | null;
    titel: string;
  },
  interests: string[]
): boolean {
  if (interests.length === 0) return false;
  const cats  = event.kategorien || (event.kategorie ? [event.kategorie] : []);
  const desc  = (event.beschreibung || "").toLowerCase();
  const title = event.titel.toLowerCase();
  return interests.some((id) => {
    const def = INTERESTS.find((i) => i.id === id);
    if (!def) return false;
    if (def.categories.some((c) => cats.includes(c))) return true;
    if (def.keywords.some((kw) => desc.includes(kw) || title.includes(kw))) return true;
    return false;
  });
}
