// Dauerangebote (event_typ = "dauerangebot"): Museen, Parks, Erlebniswege,
// regelmässige Kurse — Angebote ohne festes Datum. Die Spalte
// events.oeffnungszeiten enthält dafür einen kurzen Freitext
// (z. B. "Di–So 10–17 Uhr", "Jederzeit – ÖV-Ausflug, ganzjährig").

type DauerLike = {
  datum?: string | null;
  event_typ?: string | null;
  oeffnungszeiten?: string | null;
};

const GENERIC_HOURS_PREFIX = "Regelmässiges Angebot";

export function isDauerangebot(e: DauerLike): boolean {
  return e.event_typ === "dauerangebot";
}

/** Kurzes Label für Karten ohne Datum. */
export function undatedLabel(e: DauerLike): string {
  return isDauerangebot(e) ? "Immer offen" : "Ganzjährig";
}

/** Öffnungszeiten-Text, falls vorhanden (sonst null). */
export function openingHours(e: DauerLike): string | null {
  const oz = e.oeffnungszeiten?.trim();
  return oz ? oz : null;
}

/** true, wenn konkrete (nicht nur generische) Öffnungszeiten hinterlegt sind. */
export function hasSpecificHours(e: DauerLike): boolean {
  const oz = openingHours(e);
  return !!oz && !oz.startsWith(GENERIC_HOURS_PREFIX);
}
