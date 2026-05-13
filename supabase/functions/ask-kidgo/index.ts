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

// Extract intent signals from the question text for pre-filtering
function extractIntent(question: string): {
  indoor: boolean | null;
  freeOnly: boolean;
  keywords: string[];
  targetDate: string | null;
} {
  const q = question.toLowerCase();

  const indoor =
    q.includes("indoor") || q.includes("drin") || q.includes("regen") || q.includes("drinnen")
      ? true
      : q.includes("outdoor") || q.includes("drauss") || q.includes("natur") || q.includes("wald")
      ? false
      : null;

  const freeOnly =
    q.includes("gratis") || q.includes("kostenlos") || q.includes("umsonst") || q.includes("frei ");

  // Extract date hints (heute/morgen/samstag/wochenende)
  const today = new Date();
  let targetDate: string | null = null;
  if (q.includes("heute")) {
    targetDate = today.toISOString().split("T")[0];
  } else if (q.includes("morgen")) {
    const t = new Date(today); t.setDate(t.getDate() + 1);
    targetDate = t.toISOString().split("T")[0];
  } else if (q.includes("samstag")) {
    const dow = today.getDay();
    const diff = dow === 6 ? 0 : (6 - dow);
    const t = new Date(today); t.setDate(t.getDate() + diff);
    targetDate = t.toISOString().split("T")[0];
  } else if (q.includes("sonntag")) {
    const dow = today.getDay();
    const diff = dow === 0 ? 0 : (7 - dow);
    const t = new Date(today); t.setDate(t.getDate() + diff);
    targetDate = t.toISOString().split("T")[0];
  } else if (q.includes("wochenende")) {
    const dow = today.getDay();
    const toSat = dow === 6 ? 0 : dow === 0 ? 6 : (6 - dow);
    const t = new Date(today); t.setDate(t.getDate() + toSat);
    targetDate = t.toISOString().split("T")[0]; // return Saturday; Claude picks the range
  }

  const categoryKeywords = [
    "museum", "sport", "basteln", "malen", "kreativ", "theater", "musik", "tanz",
    "schwimm", "klettern", "ausflug", "natur", "zoo", "zirkus", "camp", "ferien",
  ];
  const keywords = categoryKeywords.filter((kw) => q.includes(kw));

  return { indoor, freeOnly, keywords, targetDate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, context }: AskKidgoRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];

    const { data: allEvents, error: dbError } = await db
      .from("events")
      .select("id, titel, beschreibung, datum, ort, preis_chf, kategorien, indoor_outdoor, alters_buckets")
      .eq("status", "aktiv")
      .or(`datum.gte.${today},datum.is.null`)
      .limit(80);

    if (dbError || !allEvents) {
      return new Response(JSON.stringify({ error: "DB error: " + (dbError?.message || "unknown") }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Intent-based pre-filtering ---
    const intent = extractIntent(question);
    let filtered: EventRow[] = allEvents;

    // Age filter
    if (context.age_buckets?.length) {
      const ageFiltered = allEvents.filter(
        (e: EventRow) =>
          !e.alters_buckets ||
          e.alters_buckets.length === 0 ||
          e.alters_buckets.some((b) => context.age_buckets!.includes(b))
      );
      filtered = ageFiltered.length >= 5 ? ageFiltered : allEvents;
    }

    // Indoor/outdoor filter from question intent
    if (intent.indoor !== null) {
      const io = intent.indoor ? "indoor" : "outdoor";
      const ioFiltered = filtered.filter(
        (e: EventRow) => !e.indoor_outdoor || e.indoor_outdoor === io || e.indoor_outdoor === "beides"
      );
      if (ioFiltered.length >= 5) filtered = ioFiltered;
    }

    // Free-only filter
    if (intent.freeOnly) {
      const freeFiltered = filtered.filter((e: EventRow) => e.preis_chf === 0);
      if (freeFiltered.length >= 3) filtered = freeFiltered;
    }

    // Date boost: events on targetDate get sorted to the top
    if (intent.targetDate) {
      const onDate = filtered.filter((e: EventRow) => e.datum === intent.targetDate);
      const rest = filtered.filter((e: EventRow) => e.datum !== intent.targetDate);
      filtered = [...onDate, ...rest];
    }

    // Keyword boost
    if (intent.keywords.length > 0) {
      filtered.sort((a: EventRow, b: EventRow) => {
        const aHit = intent.keywords.some((kw) =>
          a.titel.toLowerCase().includes(kw) ||
          (a.beschreibung || "").toLowerCase().includes(kw) ||
          a.kategorien?.some((k) => k.toLowerCase().includes(kw))
        ) ? 1 : 0;
        const bHit = intent.keywords.some((kw) =>
          b.titel.toLowerCase().includes(kw) ||
          (b.beschreibung || "").toLowerCase().includes(kw) ||
          b.kategorien?.some((k) => k.toLowerCase().includes(kw))
        ) ? 1 : 0;
        return bHit - aHit;
      });
    }

    // Liked categories boost (keep to top after keyword sort)
    if (context.liked_categories?.length) {
      filtered.sort((a: EventRow, b: EventRow) => {
        const aScore = a.kategorien?.some((k) => context.liked_categories!.includes(k)) ? 1 : 0;
        const bScore = b.kategorien?.some((k) => context.liked_categories!.includes(k)) ? 1 : 0;
        return bScore - aScore;
      });
    }

    const topEvents = filtered.slice(0, 25);

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
      intent.indoor !== null               ? `Anfrage-Intent: ${intent.indoor ? "Indoor bevorzugt" : "Outdoor bevorzugt"}` : "",
      intent.freeOnly                      ? "Anfrage-Intent: Nur Gratis-Events"                   : "",
      intent.targetDate                    ? `Anfrage-Intent: Datum ${intent.targetDate}`          : "",
    ].filter(Boolean);

    const contextText = contextParts.length ? contextParts.join(" | ") : "Keine Angaben";

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: [
        "Du bist Kidgo, ein freundlicher Familien-Assistent für Kinderaktivitäten in Zürich.",
        "Empfehle 3 bis 5 passende Events aus der bereitgestellten Liste — wähle die Anzahl je nach Qualität der Treffer.",
        "Achte auf: Alter der Kinder, Indoor/Outdoor-Präferenz der Frage, Datum/Wochentag, Preis (bei 'Gratis' nur kostenlose).",
        "Antworte auf Deutsch, kurz und warmherzig (1-2 Sätze).",
        'Gib IMMER eine JSON-Antwort im Format: {"ids":["id1","id2","id3"],"answer":"Deine Empfehlung"}',
        "Verwende nur IDs aus der Liste. Keine Emojis im answer-Feld.",
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
        ids = Array.isArray(parsed.ids) ? parsed.ids.slice(0, 5) : [];
        answer = parsed.answer || responseText;
      } catch {
        // keep full response as answer
      }
    }

    // Fetch full event rows including kategorie_bild_url for the frontend cards
    const { data: matchedEvents } = ids.length
      ? await db.from("events").select("id, titel, datum, ort, kategorie_bild_url").in("id", ids)
      : { data: [] };

    // Return in the order Claude selected them
    const orderedEvents = ids
      .map((id) => (matchedEvents || []).find((e: { id: string }) => e.id === id))
      .filter(Boolean);

    return new Response(JSON.stringify({ answer, ids, events: orderedEvents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
