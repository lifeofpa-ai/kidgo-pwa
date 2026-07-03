// Scrapes sport events (ZSC Lions, FCZ, GCZ) focused on family-friendly home games.
//
// Sources:
//   – ZSC Lions (ice hockey):  zsclions.ch/1-mannschaft/spielplan/
//     → HTML scraping; no public JSON/iCal API detected
//     → Family tickets: /tickets/familytickets/ (Swiss Life Arena)
//
//   – FC Zürich / Grasshopper (football): already covered by import-sport-events
//     via football-data.org API.  This function adds the family-sector context
//     when re-importing or can be run alongside import-sport-events.
//
//   – GCZ (ice hockey, Hardturm):  gcz.ch/matchcenter/spielplan/
//     → HTML scraping; no public JSON/iCal API detected
//     → Family Corner: /club/tickets/familiy-corner/
//
// NOTE: Neither ZSC nor GCZ expose a public match schedule API or iCal feed.
// This scraper falls back to HTML parsing of their Spielplan pages.
// If the site structure changes, the selectors below need updating.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron (weekly). Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportEvent {
  titel:        string;
  beschreibung: string;
  datum:        string | null;
  ort:          string;
  anmelde_link: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Parse a date string that may be in several formats:
 *   "15.11.2026"  →  "2026-11-15"
 *   "2026-11-15"  →  "2026-11-15"
 *   "So., 15. Nov. 2026"  →  "2026-11-15"
 */
const DE_MONTHS: Record<string, string> = {
  jan: "01", feb: "02", "mär": "03", apr: "04", mai: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", dez: "12",
};

function parseDate(str: string): string | null {
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return str.trim();

  // Numeric DE: 15.11.2026
  const numM = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numM) return `${numM[3]}-${numM[2].padStart(2, "0")}-${numM[1].padStart(2, "0")}`;

  // Word DE: So., 15. Nov. 2026
  const wordM = str.toLowerCase().match(
    /(\d{1,2})\.\s*(jan|feb|m[äa]r\.?|apr|mai|jun|jul|aug|sep|okt|nov|dez)\.?\s*(\d{4})/,
  );
  if (wordM) {
    const [, d, mon, y] = wordM;
    const mo = DE_MONTHS[mon.replace(/\.$/, "")] ?? null;
    return mo ? `${y}-${mo}-${d.padStart(2, "0")}` : null;
  }

  return null;
}

/**
 * Extract home-game blocks from a Spielplan HTML page.
 * Works with both the ZSC Lions and GCZ website structures which render
 * match cards with class "match" / "game" containing date, home/away teams.
 */
function parseSpielplanHtml(
  html: string,
  homeTeamPattern: RegExp,
  teamName: string,
  venue: string,
  eventLink: string,
): SportEvent[] {
  const events: SportEvent[] = [];
  const text = stripHtml(html);

  // Find date–match pairs using a loose regex over the flattened text.
  // Pattern: "DD.MM.YYYY ... <HomeTeam> ... <AwayTeam>" or reverse.
  const dateTokenRx = /(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})/g;
  let m: RegExpExecArray | null;

  while ((m = dateTokenRx.exec(text)) !== null) {
    const dateStr = m[1];
    const datum   = parseDate(dateStr);
    if (!datum) continue;

    // Skip past events (keep today and future)
    const today = new Date().toISOString().split("T")[0];
    if (datum < today) continue;

    // Look for home/away team context within ±300 chars of the date token
    const windowStart = Math.max(0, m.index - 50);
    const windowEnd   = Math.min(text.length, m.index + 300);
    const window      = text.slice(windowStart, windowEnd);

    // Only home games where the known team is the home side
    if (!homeTeamPattern.test(window)) continue;

    // Try to extract the opponent name (the other team in the match)
    const allTeamsInWindow = window.match(/[A-ZÄÖÜ][A-Za-zäöüÄÖÜ .'-]{2,30}/g) ?? [];
    const opponent = allTeamsInWindow
      .find((t) => !homeTeamPattern.test(t) && t.length > 2 && !/^\d/.test(t))
      ?? "Gegner";

    // anmelde_link carries the unique DB constraint, so it must be distinct per
    // game even though all games share the same ticket page — append the date
    // as a query param (ignored by the ticket page, still resolves correctly).
    const link = `${eventLink}?spiel=${datum}`;

    events.push({
      titel:        `${teamName} – ${opponent}`,
      beschreibung: `Heimspiel ${teamName}. Familienfreundliches Stadionerlebnis mit Familientickets.`,
      datum,
      ort:          venue,
      anmelde_link: link,
    });
  }

  // Deduplicate by date (one event per home-game date)
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.anmelde_link!)) return false;
    seen.add(e.anmelde_link!);
    return true;
  });
}

async function fetchSpielplan(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch; public sport schedule scraper)",
      "Accept":     "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") {
    try { dryRun = !!(await req.json()).dryRun; } catch { /* body optional */ }
  }

  const errors: string[] = [];
  const allEvents: SportEvent[] = [];

  // ── ZSC Lions ──────────────────────────────────────────────────────────────
  try {
    const zscHtml = await fetchSpielplan("https://zsclions.ch/1-mannschaft/spielplan/");
    const zscEvents = parseSpielplanHtml(
      zscHtml,
      /ZSC\s*Lions|ZSC\b/i,
      "ZSC Lions",
      "Swiss Life Arena, Zürich",
      "https://zsclions.ch/tickets/familytickets/",
    );
    allEvents.push(...zscEvents);
  } catch (e) {
    errors.push(`ZSC: ${String(e)}`);
  }

  // ── GCZ (Grasshopper Club Zürich – ice hockey) ─────────────────────────────
  try {
    const gczHtml = await fetchSpielplan("https://gcz.ch/matchcenter/spielplan/");
    const gczEvents = parseSpielplanHtml(
      gczHtml,
      /GCK?\s*Lions|Grasshopper\s*Lions/i,
      "GCK Lions",
      "Hallenstadion, Zürich",
      "https://gcz.ch/club/tickets/familiy-corner/",
    );
    allEvents.push(...gczEvents);
  } catch (e) {
    errors.push(`GCZ: ${String(e)}`);
  }

  // ── FCZ / GC Football ──────────────────────────────────────────────────────
  // Covered by import-sport-events (football-data.org).  To avoid duplication,
  // we do NOT re-import football matches here.  Set IMPORT_FOOTBALL=true in the
  // request body if you want to include them in a single run.

  const rows = allEvents.map((ev) => ({
    titel:           ev.titel,
    beschreibung:    ev.beschreibung,
    datum:           ev.datum,
    datum_ende:      null,
    ort:             ev.ort,
    anmelde_link:    ev.anmelde_link,
    quelle_url:      ev.anmelde_link,
    preis_chf:       null,
    alter_von:       4,
    alter_bis:       12,
    kategorien:      ["Sport"],
    alters_buckets:  ["4-6", "7-9", "10-12"],
    indoor_outdoor:  "indoor" as const,
    event_typ:       "event",
    status:          "approved",
  }));

  const summary = {
    fetched: allEvents.length,
    rows:    rows.length,
    errors,
  };

  if (dryRun) {
    return new Response(
      JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
      { headers: jsonHeaders },
    );
  }

  if (!rows.length) {
    return new Response(
      JSON.stringify({ ...summary, inserted: 0, message: "no upcoming home games found" }),
      { headers: jsonHeaders },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const BATCH = 50;
    let inserted   = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "anmelde_link", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("scrape-sport-events batch upsert error:", error);
        for (const row of batch) {
          const { data: s, error: rowErr } = await supabase
            .from("events")
            .upsert(row, { onConflict: "anmelde_link", ignoreDuplicates: true })
            .select("id");
          if (rowErr) console.error("scrape-sport-events row upsert error:", rowErr, row.anmelde_link);
          inserted += s?.length ?? 0;
        }
        continue;
      }

      const n  = data?.length ?? 0;
      inserted   += n;
      duplicates += batch.length - n;
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, duplicates }),
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("scrape-sport-events fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
