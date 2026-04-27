// Backfills lat/lng for events that have an `ort` but no coordinates,
// using the free Swiss geo-admin SearchServer (no API key).
//
// Idempotent: only operates on rows where lat IS NULL OR lng IS NULL.
// Trigger: invoke on demand or via cron after each Eventfrog/sport import.
// Optional body: { dryRun: true, limit: 50 }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { geocode } from "../_shared/geoadmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  let limit  = 50;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun = !!body.dryRun;
      if (typeof body.limit === "number") limit = Math.min(200, Math.max(1, body.limit));
    } catch { /* ignore */ }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("events")
      .select("id, ort, lat, lng")
      .or("lat.is.null,lng.is.null")
      .not("ort", "is", null)
      .limit(limit);

    if (error) throw new Error(error.message);
    if (!rows?.length) {
      return new Response(JSON.stringify({ checked: 0, geocoded: 0 }), { headers: jsonHeaders });
    }

    let geocoded = 0;
    let skipped  = 0;
    for (const row of rows) {
      const ort = (row.ort || "").trim();
      if (!ort) { skipped++; continue; }
      const hit = await geocode(ort);
      if (!hit) { skipped++; continue; }
      if (!dryRun) {
        const { error: upErr } = await supabase
          .from("events")
          .update({ lat: hit.lat, lng: hit.lng })
          .eq("id", row.id);
        if (upErr) throw new Error(`Update ${row.id}: ${upErr.message}`);
      }
      geocoded++;
      // Be polite — geo-admin allows generous rate limits but no need to hammer
      await new Promise((r) => setTimeout(r, 50));
    }

    return new Response(JSON.stringify({ checked: rows.length, geocoded, skipped, dryRun }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});
