import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const COOKIE_NAME = "kidgo_admin";
const COOKIE_TTL_SECONDS = 60 * 60 * 4;

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`admin-auth:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) {
    const retryAfter = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  const adminPw = process.env.ADMIN_PW;
  if (!adminPw || typeof password !== "string" || !constantTimeEquals(password, adminPw)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const ok = req.cookies.get(COOKIE_NAME)?.value === "1";
  return NextResponse.json({ ok });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
