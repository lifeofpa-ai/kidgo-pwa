// admin-mutations: service_role-backed mutations for the Kidgo admin UI.
//
// Auth model: the request is fronted by the Next.js proxy at /api/admin-mutations,
// which validates the HTTP-only `kidgo_admin` cookie set by /api/admin-auth.
// The proxy then forwards the request to this function with
//   Authorization: Bearer <ADMIN_FUNCTION_SECRET>
// The shared secret ensures only the proxy (which validated the cookie) can
// invoke this function. Browser clients have no way to obtain the secret, so
// hitting this URL directly with the public anon key is rejected.
//
// Required Supabase secrets:
//   ADMIN_FUNCTION_SECRET   — long random string, also set in the Next.js env
//   SUPABASE_URL            — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// Body shape (discriminated union by `action`):
//   { action: "approveEvent",  id: string }
//   { action: "rejectEvent",   id: string }
//   { action: "approveQuelle", id: string }
//   { action: "rejectQuelle",  id: string }
//   { action: "batchApprove",  ids: string[] }
//   { action: "batchReject",   ids: string[] }
//   { action: "saveEdit",      id: string, updates: Record<string, unknown> }
//   { action: "deleteLiveEvent", id: string }
//   { action: "sendToReview",  id: string, comment: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

const ALLOWED_EDIT_FIELDS = new Set([
  "titel",
  "datum",
  "datum_ende",
  "ort",
  "preis_chf",
  "beschreibung",
  "anmelde_link",
  "kontakt_email",
  "altersgruppen",
  "event_typ",
  "status",
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorize(req: Request): boolean {
  const expected = Deno.env.get("ADMIN_FUNCTION_SECRET");
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const provided = header.slice(prefix.length);
  return timingSafeEqual(provided, expected);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function sanitizeUpdates(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (ALLOWED_EDIT_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  if (!authorize(req)) return jsonResponse({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (action) {
      case "approveEvent": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const { error: e1 } = await supabase
          .from("events")
          .update({ status: "approved" })
          .eq("id", id);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("events")
          .update({ status: "approved" })
          .eq("serie_id", id);
        if (e2) throw e2;
        return jsonResponse({ ok: true });
      }

      case "rejectEvent": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const { error: e1 } = await supabase.from("events").delete().eq("serie_id", id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("events").delete().eq("id", id);
        if (e2) throw e2;
        return jsonResponse({ ok: true });
      }

      case "approveQuelle": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const { error } = await supabase
          .from("quellen")
          .update({ status: "approved" })
          .eq("id", id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "rejectQuelle": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const { error } = await supabase
          .from("quellen")
          .update({ status: "rejected" })
          .eq("id", id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "batchApprove": {
        const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
        if (ids.length === 0) return jsonResponse({ error: "missing_ids" }, 400);
        const { error: e1 } = await supabase
          .from("events")
          .update({ status: "approved" })
          .in("id", ids);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("events")
          .update({ status: "approved" })
          .in("serie_id", ids);
        if (e2) throw e2;
        return jsonResponse({ ok: true, count: ids.length });
      }

      case "batchReject": {
        const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
        if (ids.length === 0) return jsonResponse({ error: "missing_ids" }, 400);
        const { error: e1 } = await supabase.from("events").delete().in("serie_id", ids);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("events").delete().in("id", ids);
        if (e2) throw e2;
        return jsonResponse({ ok: true, count: ids.length });
      }

      case "saveEdit": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const updates = sanitizeUpdates(body.updates);
        if (Object.keys(updates).length === 0) {
          return jsonResponse({ error: "no_valid_fields" }, 400);
        }
        const { error } = await supabase.from("events").update(updates).eq("id", id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "deleteLiveEvent": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const { error: e1 } = await supabase.from("events").delete().eq("serie_id", id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("events").delete().eq("id", id);
        if (e2) throw e2;
        return jsonResponse({ ok: true });
      }

      case "sendToReview": {
        const id = String(body.id || "");
        if (!id) return jsonResponse({ error: "missing_id" }, 400);
        const comment = typeof body.comment === "string" ? body.comment : "";
        const { error } = await supabase
          .from("events")
          .update({
            status: "review",
            review_comment: comment,
            review_requested_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: "unknown_action" }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
});
