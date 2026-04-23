import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventSummary {
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

interface AskKidgoRequest {
  question: string;
  events: EventSummary[];
  context: {
    age_buckets?: string[];
    weather_code?: number | null;
    hour?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, events, context }: AskKidgoRequest = await req.json();

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    const topEvents = events.slice(0, 20);
    const eventsText = topEvents
      .map(
        (e, i) =>
          `${i + 1}. ID:${e.id} | ${e.titel}` +
          (e.datum ? ` | ${e.datum}` : " | Ganzjährig") +
          ` | ${e.ort || "Zürich"}` +
          ` | ${e.preis_chf === 0 ? "Gratis" : e.preis_chf ? `CHF ${e.preis_chf}` : "Preis offen"}` +
          ` | ${e.kategorien?.join(", ") || "Allgemein"}` +
          ` | ${e.indoor_outdoor === "indoor" ? "Indoor" : e.indoor_outdoor === "outdoor" ? "Outdoor" : "Drinnen/Draußen"}` +
          (e.alters_buckets?.length ? ` | Alter: ${e.alters_buckets.join(",")}` : "")
      )
      .join("\n");

    const weatherLabel =
      context.weather_code != null
        ? context.weather_code >= 61
          ? "Regen"
          : context.weather_code >= 3
          ? "Bewölkt"
          : "Sonnig"
        : null;

    const contextParts = [
      context.age_buckets?.length ? `Alter: ${context.age_buckets.join(", ")} Jahre` : "",
      weatherLabel ? `Wetter: ${weatherLabel}` : "",
      context.hour !== undefined ? `Uhrzeit: ${context.hour}:00 Uhr` : "",
    ].filter(Boolean);

    const contextText = contextParts.length > 0 ? contextParts.join(" | ") : "Keine Angaben";

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      system: [
        "Du bist Kidgo, ein freundlicher Familien-Assistent für Kinderaktivitäten in Zürich.",
        "Empfehle exakt 3 passende Events aus der bereitgestellten Liste.",
        "Antworte auf Deutsch, kurz und warmherzig.",
        "Gib IMMER eine JSON-Antwort zurück im Format: {\"ids\":[\"id1\",\"id2\",\"id3\"],\"answer\":\"Deine warmherzige Empfehlung in 1-2 Sätzen\"}",
        "Verwende nur IDs aus der Liste. Keine Emojis.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: `Kontext: ${contextText}\n\nVerfügbare Events:\n${eventsText}\n\nFrage: ${question}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let answer = responseText;
    let ids: string[] = [];

    const jsonMatch = responseText.match(/\{[\s\S]*?"ids"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        ids = Array.isArray(parsed.ids) ? parsed.ids.slice(0, 3) : [];
        answer = parsed.answer || responseText;
      } catch {
        // keep full response as answer
      }
    }

    return new Response(JSON.stringify({ answer, ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
