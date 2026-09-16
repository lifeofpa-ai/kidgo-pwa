import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Stop-Funktion / Kill-Switch: KIDGO_MAINTENANCE=true in Vercel schaltet die
// gesamte App sofort (ohne Redeploy-Wartezeit, ohne DNS-Aenderung) auf eine
// einfache Coming-Soon-Antwort um. Health-Check-Pfade bleiben erreichbar.
// Siehe drafts/maintenance-mode-middleware.ts fuer den urspruenglichen Entwurf.
function maintenanceResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kidgo</title>
    <style>
      body { font-family: system-ui, sans-serif; background:#fff; color:#1e2221;
        display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
      div { text-align:center; padding: 0 24px; }
      h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
      p { color:#6b7280; }
    </style>
  </head>
  <body>
    <div>
      <h1>Kidgo</h1>
      <p>Wir sind kurz nicht erreichbar. Wir sind gleich wieder da.</p>
    </div>
  </body>
</html>`,
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function middleware(request: NextRequest) {
  if (
    process.env.KIDGO_MAINTENANCE === "true" &&
    !request.nextUrl.pathname.startsWith("/api/health")
  ) {
    return maintenanceResponse();
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
