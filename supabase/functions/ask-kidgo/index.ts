import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AskKidgoRequest {
  question: string;
  context: {
    age_buckets?: string[];
    weather_code?: number | null;
    hour?: number;
    liked_categories?: string[];
    standort?: string | null;
  };
}

interface EventRow {
  id: string;
  titel: string;
  beschreibung: string | null;
  datum: string | null;
  ort: string | null;
  preis_chf: number | null;
  kategorien: string[] | null;
  indoor_outdoor: string | null;
  alters_buckets: string[] | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, context }: AskKidgoRequest = await req.json();

    // Load events from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];

    const { data: allEvents, error: dbError } = await db
      .from("events")
      .select("id, titel, beschreibung, datum, ort, preis_chf, kategorien, indoor_outdoor, alters_buckets")
      .eq("status", "aktiv")
      .or(`datum.gte.${today},datum.is.null`)
      .limit(60);

    if (dbError || !allEvents) {
      return new Response(JSON.stringify({ error: "DB error: " + (dbError?.message || "unknown") }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by age buckets
    let filtered: EventRow[] = allEvents;
    if (context.age_buckets?.length) {
      filtered = allEvents.filter(
        (e: EventRow) =>
          !e.alters_buckets ||
          e.alters_buckets.length === 0 ||
          e.alters_buckets.some((b) => context.age_buckets!.includes(b))
      );
      if (filtered.length < 5) filtered = allEvents; // fallback if too few results
    }

    // Boost liked categories to the top
    if (context.liked_categories?.length) {
      filtered.sort((a: EventRow, b: EventRow) => {
        const aScore = a.kategorien?.some((k) => context.liked_categories!.includes(k)) ? 1 : 0;
        const bScore = b.kategorien?.some((k) => context.liked_categories!.includes(k)) ? 1 : 0;
        return bScore - aScore;
      });
    }

    const topEvents = filtered.slice(0, 20);

    const eventsText = topEvents
      .map(
        (e: EventRow, i: number) =>
          `${i + 1}. ID:${e.id} | ${e.titel}` +
          (e.datum ? ` | ${e.datum}` : " | Ganzjährig") +
          ` | ${e.ort || "Zürich"}` +
          ` | ${e.preis_chf === 0 ? "Gratis" : e.preis_chf ? `CHF ${e.preis_chf}` : "Preis offen"}` +
          ` | ${e.kategorien?.join(", ") || "Allgemein"}` +
          ` | ${e.indoor_outdoor === "indoor" ? "Indoor" : e.indoor_outdoor === "outdoor" ? "Outdoor" : "Drinnen/Draußen"}` +
          (e.alters_buckets?.length ? ` | Alter: ${e.alters_buckets.join(",")}` : "")
      )
      .join("\n");

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const weatherLabel =
      context.weather_code != null
        ? context.weather_code >= 61 ? "Regen"
        : context.weather_code >= 3  ? "Bewölkt"
        : "Sonnig"
        : null;

    const contextParts = [
      context.age_buckets?.length         ? `Alter: ${context.age_buckets.join(", ")} Jahre`      : "",
      weatherLabel                         ? `Wetter: ${weatherLabel}`                             : "",
      context.hour !== undefined           ? `Uhrzeit: ${context.hour}:00 Uhr`                     : "",
      context.liked_categories?.length     ? `Interessen: ${context.liked_categories.slice(0,3).join(", ")}` : "",
      context.standort                     ? `Standort: ${context.standort}`                       : "",
    ].filter(Boolean);

    const contextText = contextParts.length ? contextParts.join(" | ") : "Keine Angaben";

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      system: [
        "Du bist Kidgo, ein freundlicher Familien-Assistent für Kinderaktivitäten in Zürich.",
        "Empfehle exakt 3 passende Events aus der bereitgestellten Liste.",
        "Antworte auf Deutsch, kurz und warmherzig.",
        'Gib IMMER eine JSON-Antwort zurück im Format: {"ids":["id1","id2","id3"],"answer":"Deine warmherzige Empfehlung in 1-2 Sätzen"}',
        "Verwende nur IDs aus der Liste. Keine Emojis.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: `Kontext: ${contextText}\n\nVerfügbare Events:\n${eventsText}\n\nFrage: ${question}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    let answer = responseText;
    let ids: string[] = [];

    const jsonMatch = responseText.match(/\{[\s\S]*?"ids"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        ids = Array.isArray(parsed.ids) ? parsed.ids.slice(0, 3) : [];
        answer = parsed.answer || responseText;
      } catch {
        // keep full response
      }
    }

    // Fetch full event rows for matched IDs so frontend can display cards
    const { data: matchedEvents } = ids.length
      ? await db.from("events").select("*").in("id", ids)
      : { data: [] };

    return new Response(JSON.stringify({ answer, ids, events: matchedEvents || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
