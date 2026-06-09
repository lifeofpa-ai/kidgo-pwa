// Scrapes ferienplausch-uster.ch for holiday activity programs and imports
// them into the kidgo events table.
//
// Source:  https://www.ferienplausch-uster.ch
// API:     /services/json/getKurse  (JSON, no auth required)
// Dedup:   external_source=ferienplausch-uster + external_id=<course.id>
// Region:  Zürich / Uster   event_typ: camp   status: approved
// Filter:  only events for ages 0–12; minAlter > 12 are skipped
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const SOURCE_KEY = "ferienplausch-uster";
const BASE_URL   = "https://www.ferienplausch-uster.ch";
const API_URL    = `${BASE_URL}/services/json/getKurse`;
const ORT        = "Uster";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KurseEntry {
  id:              string;
  kursId:          string;
  kursStammTitel:  string;
  text:            string | null;
  minAlter:        number;
  maxAlter:        number;
  alterVon:        number;
  alterBis:        number;
  kursZeit:        Array<{ von: number; bis: number }>;
  kursort:         string | null;
  ortschaft:       string | null;
  preis:           number | null;
  bildUrl:         string | null;
  abgesagt:        boolean;
  archiviert:      boolean;
  kursState:       string;
  programmNummer:  string | null;
}

interface ScrapedEvent {
  titel:        string;
  beschreibung: string | null;
  datum:        string | null;
  datum_ende:   string | null;
  alter_min:    number;
  alter_max:    number;
  external_id:  string;
  anmelde_link: string;
  bild_url:     string | null;
  ort:          string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToDate(ms: number): string {
  // Convert Unix ms timestamp to YYYY-MM-DD (UTC)
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ageToBuckets(min: number, max: number): string[] {
  return [
    { label: "0-3",   lo: 0,  hi: 3  },
    { label: "4-6",   lo: 4,  hi: 6  },
    { label: "7-9",   lo: 7,  hi: 9  },
    { label: "10-12", lo: 10, hi: 12 },
  ]
    .filter(b => b.lo <= max && b.hi >= min)
    .map(b => b.label);
}

function buildImageUrl(bildUrl: string | null): string | null {
  if (!bildUrl) return null;
  // bildUrl contains semicolon-separated relative paths like "/bild/org/hash.jpg"
  const first = bildUrl.split(";")[0].trim();
  if (!first) return null;
  // Already has leading slash from the JSON (escaped as \/bild\/...)
  const path = first.startsWith("/") ? first : `/${first}`;
  return `${BASE_URL}${path}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") {
    try { dryRun = !!(await req.json()).dryRun; } catch { /* body optional */ }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch JSON from the API
    const res = await fetch(API_URL, {
      headers: { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch; public event scraper)" },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `API returned ${res.status}` }),
        { status: 502, headers: jsonHeaders },
      );
    }
    const courses: KurseEntry[] = await res.json();

    // 2. Map + filter
    const events: ScrapedEvent[] = [];

    for (const course of courses) {
      // Skip canceled or archived entries
      if (course.abgesagt || course.archiviert || course.kursState === "ABGESAGT") continue;

      const ageMin = course.minAlter ?? course.alterVon ?? 0;
      const ageMax = course.maxAlter ?? course.alterBis ?? 18;

      // Skip 13+ only courses
      if (ageMin > 12) continue;

      // Extract dates from first/last kursZeit entry
      let datum:      string | null = null;
      let datum_ende: string | null = null;
      if (course.kursZeit && course.kursZeit.length > 0) {
        datum      = msToDate(course.kursZeit[0].von);
        const last = course.kursZeit[course.kursZeit.length - 1];
        const endDate = msToDate(last.bis);
        if (endDate !== datum) datum_ende = endDate;
      }

      events.push({
        titel:        course.kursStammTitel.trim().slice(0, 200),
        beschreibung: course.text ? course.text.trim().slice(0, 1000) : null,
        datum,
        datum_ende,
        alter_min:    ageMin,
        alter_max:    Math.min(ageMax, 18),
        external_id:  course.id,
        anmelde_link: `${BASE_URL}/kurs/${course.id}`,
        bild_url:     buildImageUrl(course.bildUrl),
        ort:          course.ortschaft ?? course.kursort?.split(",")[0]?.trim() ?? ORT,
      });
    }

    // 3. Map to DB rows
    const rows = events.map(ev => {
      const fullText  = `${ev.titel} ${ev.beschreibung ?? ""}`;
      const kategorien = [...new Set(["Feriencamp", ...inferCategories(fullText)])];
      const alters_buckets = (() => {
        const b = ageToBuckets(ev.alter_min, ev.alter_max);
        return b.length ? b : ["4-6", "7-9", "10-12"];
      })();

      return {
        external_id:        ev.external_id,
        external_source:    SOURCE_KEY,
        titel:              ev.titel,
        beschreibung:       ev.beschreibung,
        datum:              ev.datum,
        datum_ende:         ev.datum_ende,
        ort:                ev.ort,
        anmelde_link:       ev.anmelde_link,
        kategorie_bild_url: ev.bild_url,
        kategorien,
        alters_buckets,
        indoor_outdoor:     inferIndoorOutdoor(fullText),
        event_typ:          "camp",
        status:             "approved",
      };
    });

    const summary = { scraped: rows.length, source: API_URL };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, message: "no events found" }),
        { headers: jsonHeaders },
      );
    }

    // 4. Upsert in batches
    const BATCH = 50;
    let inserted   = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error, data } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "external_source,external_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("upsert error:", error.message);
        continue;
      }

      const batchNew  = data?.length ?? 0;
      inserted        += batchNew;
      duplicates      += batch.length - batchNew;
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, duplicates }),
      { headers: jsonHeaders },
    );

  } catch (err) {
    console.error("scrape-ferienplausch-uster fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
