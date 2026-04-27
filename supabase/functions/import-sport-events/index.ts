// Imports upcoming home matches of FC Zürich (FCZ) and Grasshopper Club Zürich (GC)
// from the football-data.org API as kid-friendly Sport events.
//
// API:    https://api.football-data.org/v4/competitions/SSL/matches
// Auth:   X-Auth-Token header (free tier, 10 req/min)
// Fields: matches[].id, utcDate, status, homeTeam, awayTeam, venue, area
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_TOKEN
//
// Trigger: invoke via cron (weekly). Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

const SOURCE_KEY    = "football-data";
const COMPETITION   = "SSL"; // Swiss Super League
const HOME_TEAM_RX  = /\b(FC Z(ü|u)rich|Grasshopper)/i;
const FCZ_VENUE     = "Letzigrund, Zürich";
const GC_VENUE      = "Stadion Letzigrund, Zürich";

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string; shortName?: string; tla?: string };
  awayTeam: { id: number; name: string; shortName?: string; tla?: string };
  venue?: string;
  competition?: { name?: string };
}

function teamShort(t: FdMatch["homeTeam"]): string {
  return t.shortName || t.name || t.tla || "Team";
}

function isHomeMatch(m: FdMatch): boolean {
  return HOME_TEAM_RX.test(m.homeTeam.name);
}

function venueFor(m: FdMatch): string {
  if (m.venue) return /z(ü|u)rich/i.test(m.venue) ? m.venue : `${m.venue}, Zürich`;
  if (/grasshopper/i.test(m.homeTeam.name)) return GC_VENUE;
  return FCZ_VENUE;
}

function mapMatch(m: FdMatch) {
  const home = teamShort(m.homeTeam);
  const away = teamShort(m.awayTeam);
  const titel = `${home} vs. ${away}`;
  const datum = m.utcDate.slice(0, 10);
  return {
    external_id: String(m.id),
    external_source: SOURCE_KEY,
    titel,
    beschreibung: `Heimspiel der Swiss Super League. ${home} gegen ${away}. Familienfreundliches Stadionerlebnis.`,
    datum,
    datum_ende: null,
    ort: venueFor(m),
    anmelde_link: null,
    kategorien: ["Sport"],
    alters_buckets: ["4-6", "7-9", "10-12"],
    indoor_outdoor: "outdoor",
    event_typ: "event",
    status: "approved",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") {
    try { dryRun = !!(await req.json()).dryRun; } catch { /* ignore */ }
  }

  try {
    const token = Deno.env.get("FOOTBALL_DATA_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "FOOTBALL_DATA_TOKEN missing" }), {
        status: 500, headers: jsonHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull only upcoming scheduled matches to avoid spamming the DB with
    // historical data. status=SCHEDULED|TIMED is the canonical filter.
    const url = `https://api.football-data.org/v4/competitions/${COMPETITION}/matches?status=SCHEDULED,TIMED`;
    const apiRes = await fetch(url, { headers: { "X-Auth-Token": token } });
    if (!apiRes.ok) {
      const body = await apiRes.text();
      return new Response(JSON.stringify({ error: `football-data ${apiRes.status}`, body }), {
        status: 502, headers: jsonHeaders,
      });
    }
    const data: { matches?: FdMatch[] } = await apiRes.json();
    const allMatches = data.matches || [];
    const homeMatches = allMatches.filter(isHomeMatch);
    const rows = homeMatches.map(mapMatch);

    if (dryRun) {
      return new Response(JSON.stringify({
        fetched: allMatches.length,
        homeMatches: homeMatches.length,
        sample: rows.slice(0, 3),
      }), { headers: jsonHeaders });
    }

    if (!rows.length) {
      return new Response(JSON.stringify({
        fetched: allMatches.length, upserted: 0, message: "no upcoming home matches",
      }), { headers: jsonHeaders });
    }

    const { error, data: upserted } = await supabase
      .from("events")
      .upsert(rows, { onConflict: "external_source,external_id" })
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({
      fetched: allMatches.length,
      homeMatches: homeMatches.length,
      upserted: upserted?.length ?? 0,
    }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});
