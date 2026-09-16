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
const ALLOWED_CATEGORIES = ["idea", "bug", "other"] as const;

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);

  let body: { message?: string; email?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  const email = (body.email ?? "").trim() || null;
  const category = ALLOWED_CATEGORIES.includes(body.category as any)
    ? (body.category as string)
    : "idea";

  if (message.length < 3 || message.length > 4000) {
    return NextResponse.json(
      { error: "Bitte eine Nachricht zwischen 3 und 4000 Zeichen angeben." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("feedback_submissions")
    .insert({ message, email, category })
    .select("id")
    .single();

  if (error) {
    console.error("feedback insert failed", error);
    return NextResponse.json(
      { error: "Konnte nicht gespeichert werden. Bitte später erneut versuchen." },
      { status: 500 }
    );
  }

  try {
    await resend.emails.send({
      from: "Kidgo Feedback <contact@kidgo.ch>", // Domain kidgo.ch muss in Resend verifiziert sein (SPF/DKIM per DNS)
      to: NOTIFY_TO,
      replyTo: email ?? undefined,
      subject: `Neues Kidgo-Feedback (${category})`,
      text: message,
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

  return NextResponse.json({ ok: true });
}
