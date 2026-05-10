import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "kidgo_admin";

// Forwards admin mutations to the Supabase admin-mutations Edge Function.
// Auth check: kidgo_admin HTTP-only cookie must equal "1" (set by /api/admin-auth
// after password validation). The Edge Function additionally validates the
// shared ADMIN_FUNCTION_SECRET, so only this proxy can invoke it.
export async function POST(req: NextRequest) {
  if (req.cookies.get(COOKIE_NAME)?.value !== "1") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.ADMIN_FUNCTION_SECRET;
  if (!supabaseUrl || !secret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const body = await req.text();

  const fnRes = await fetch(`${supabaseUrl}/functions/v1/admin-mutations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body,
  });

  const text = await fnRes.text();
  return new NextResponse(text, {
    status: fnRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
