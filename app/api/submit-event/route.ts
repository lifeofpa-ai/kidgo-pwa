import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Bewusst LAZY instanziiert, gleiches Muster wie app/api/feedback/route.ts:
// createClient() darf beim Next.js-Build ("Collecting page data") nicht
// wegen fehlendem Env-Var crashen.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_URL_LENGTH = 2000;
const MAX_NOTE_LENGTH = 500;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: { url?: string; note?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  // Honeypot: Bots füllen unsichtbare Felder oft aus. Statt einen Fehler zu
  // zeigen (der zum Nachjustieren einlädt), tun wir einfach so, als hätte
  // es geklappt - die Einsendung wird aber verworfen.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ success: true });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : "";

  if (!url || url.length > MAX_URL_LENGTH || !isValidHttpUrl(url)) {
    return NextResponse.json({ error: "Bitte einen gültigen Link angeben." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error("submit-event: Supabase-Konfiguration fehlt");
    return NextResponse.json(
      { error: "Konnte nicht verarbeitet werden. Bitte später erneut versuchen." },
      { status: 500 }
    );
  }

  let result: {
    success?: boolean;
    message?: string;
    duplicate?: boolean;
    event?: { id?: string };
    error?: string;
  };

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/process-event-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(20000),
    });
    result = await resp.json();
  } catch (e) {
    console.error("submit-event: process-event-url call failed", e);
    return NextResponse.json(
      { error: "Konnte nicht verarbeitet werden. Bitte später erneut versuchen." },
      { status: 502 }
    );
  }

  // Optionale Notiz des Einreichenden: an review_comment des neu erstellten
  // Events anhängen, damit sie beim PO-Review sichtbar ist. Best-effort -
  // ein Fehlschlag hier darf die erfolgreiche Einreichung nicht kippen.
  if (result.success && note && result.event?.id) {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin
        .from("events")
        .update({ review_comment: `Nutzer-Notiz: ${note}` })
        .eq("id", result.event.id);
    } catch (e) {
      console.error("submit-event: review_comment update failed", e);
    }
  }

  return NextResponse.json(result);
}
