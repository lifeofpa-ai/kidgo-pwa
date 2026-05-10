// Browser-side helpers that call the /api/admin-mutations proxy.
// The proxy validates the kidgo_admin HTTP-only cookie and forwards
// requests to the Supabase admin-mutations Edge Function.

export type AdminAction =
  | { action: "approveEvent"; id: string }
  | { action: "rejectEvent"; id: string }
  | { action: "approveQuelle"; id: string }
  | { action: "rejectQuelle"; id: string }
  | { action: "batchApprove"; ids: string[] }
  | { action: "batchReject"; ids: string[] }
  | { action: "saveEdit"; id: string; updates: Record<string, unknown> }
  | { action: "deleteLiveEvent"; id: string }
  | { action: "sendToReview"; id: string; comment: string };

export type AdminResult = { ok: true; count?: number } | { ok: false; error: string };

export async function adminMutate(payload: AdminAction): Promise<AdminResult> {
  try {
    const res = await fetch("/api/admin-mutations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: typeof data?.error === "string" ? data.error : `HTTP ${res.status}` };
    }
    return { ok: true, count: typeof data?.count === "number" ? data.count : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}
