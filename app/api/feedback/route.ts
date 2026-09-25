import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Bewusst LAZY instanziiert (nicht auf Modul-Ebene): createClient() wirft
// sofort, wenn SUPABASE_SERVICE_ROLE_KEY fehlt - und Next.js fuehrt beim
// Build ("Collecting page data") jede Route-Datei einmal aus, unabhaengig
// vom Ziel-Environment. Auf Modul-Ebene instanziiert hat das schon bei
// fehlendem Env-Var im Preview-Build den ganzen Deploy crashen lassen.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const NOTIFY_TO = process.env.FEEDBACK_NOTIFY_EMAIL || "contact@kidgo.ch";
const ALLOWED_CATEGORIES = ["idea", "bug", "other", "event_problem", "search_miss"] as const;

// Schnellauswahl-Gruende fuer Meldungen von der Event-Seite. Label wird in
// der Benachrichtigungsmail verwendet und, falls kein Freitext kommt, auch
// als gespeicherte Nachricht.
const EVENT_PROBLEM_REASONS: Record<string, string> = {
  date_wrong: "Datum oder Zeit stimmt nicht",
  cancelled: "Findet nicht (mehr) statt",
  link_broken: "Link funktioniert nicht",
  place_wrong: "Ort stimmt nicht",
  not_for_kids: "Nicht für Kinder geeignet",
  other: "Anderes",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_URL = "https://kidgo.ch";

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  let body: {
    message?: string;
    email?: string;
    category?: string;
    eventId?: string;
    reason?: string;
    searchQuery?: string;
    searchFilters?: unknown;
    pagePath?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  let message = (body.message ?? "").trim();
  const email = (body.email ?? "").trim() || null;
  const category = ALLOWED_CATEGORIES.includes(body.category as any)
    ? (body.category as string)
    : "idea";

  // Kontextfelder (alle optional, serverseitig validiert)
  const eventId =
    category === "event_problem" && typeof body.eventId === "string" && UUID_RE.test(body.eventId)
      ? body.eventId
      : null;
  const reason =
    category === "event_problem" && typeof body.reason === "string" && Object.prototype.hasOwnProperty.call(EVENT_PROBLEM_REASONS, body.reason)
      ? body.reason
      : null;
  const searchQuery = category === "search_miss" ? cleanText(body.searchQuery, 200) : null;
  const searchFilters =
    category === "search_miss" && Array.isArray(body.searchFilters)
      ? body.searchFilters
          .filter((f): f is string => typeof f === "string")
          .slice(0, 20)
          .map((f) => f.slice(0, 60))
      : null;
  const pagePath =
    typeof body.pagePath === "string" && body.pagePath.startsWith("/")
      ? body.pagePath.slice(0, 300)
      : null;

  if (category === "event_problem" && (!eventId || !reason)) {
    return NextResponse.json({ error: "Bitte einen Grund auswählen." }, { status: 400 });
  }

  // Bei Event-Meldungen reicht der Grund, Freitext ist optional.
  if (category === "event_problem" && message.length === 0) {
    message = EVENT_PROBLEM_REASONS[reason!];
  }

  if (message.length < 3 || message.length > 4000) {
    return NextResponse.json(
      { error: "Bitte eine Nachricht zwischen 3 und 4000 Zeichen angeben." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("feedback_submissions")
    .insert({
      message,
      email,
      category,
      event_id: eventId,
      reason,
      search_query: searchQuery,
      search_filters: searchFilters && searchFilters.length ? searchFilters : null,
      page_path: pagePath,
    })
    .select("id")
    .single();

  if (error) {
    console.error("feedback insert failed", error);
    return NextResponse.json(
      { error: "Konnte nicht gespeichert werden. Bitte später erneut versuchen." },
      { status: 500 }
    );
  }

  // Bewusst LAZY instanziiert + komplett try/catch-isoliert (Fix 23.09.2026):
  // `new Resend(...)` wirft sofort, wenn RESEND_API_KEY fehlt oder leer ist -
  // vorher stand das ausserhalb jedes try/catch und liess JEDE Feedback-
  // Einsendung mit einem leeren 500er crashen, obwohl die Nachricht oben
  // bereits sicher in der DB gespeichert wurde. Fehlender/ungueltiger
  // RESEND_API_KEY darf die Einsendung selbst nie beeinflussen - nur die
  // Benachrichtigungsmail faellt dann aus.
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Kidgo Feedback <contact@kidgo.ch>",
        to: NOTIFY_TO,
        replyTo: email ?? undefined,
        subject:
          category === "event_problem"
            ? `Kidgo: Event-Problem gemeldet (${EVENT_PROBLEM_REASONS[reason!]})`
            : category === "search_miss"
              ? `Kidgo: Nichts gefunden für "${searchQuery ?? "–"}"`
              : `Neues Kidgo-Feedback (${category})`,
        text: [
          message,
          eventId ? `\nEvent: ${SITE_URL}/events/${eventId}` : "",
          reason ? `Grund: ${EVENT_PROBLEM_REASONS[reason]}` : "",
          searchQuery ? `\nSuchbegriff: ${searchQuery}` : "",
          searchFilters && searchFilters.length ? `Filter: ${searchFilters.join(", ")}` : "",
          pagePath ? `Seite: ${SITE_URL}${pagePath}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      await supabaseAdmin
        .from("feedback_submissions")
        .update({ notified: true })
        .eq("id", data.id);
    } catch (mailError) {
      // Bewusst kein Fehler an die Nutzenden zurückgeben - die Idee ist sicher in
      // der DB, auch wenn die Mail gerade nicht rausging. Für ein Retry-Batch-Job
      // später: `select * from feedback_submissions where notified = false`.
      console.error("feedback notify mail failed", mailError);
    }
  } else {
    console.warn("RESEND_API_KEY nicht gesetzt - Feedback-Benachrichtigung wird übersprungen");
  }

  return NextResponse.json({ ok: true });
}
