"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_PW = "FpEEzd8u8B$Q0!0fMm3a";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<"events" | "quellen">("events");
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [pendingQuellen, setPendingQuellen] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [serienCounts, setSerienCounts] = useState<Record<string, number>>({});
  const [serienEvents, setSerienEvents] = useState<Record<string, any[]>>({});
  const [expandedSerie, setExpandedSerie] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const login = () => {
    if (pw === ADMIN_PW) { setAuthed(true); }
    else { setPwError(true); }
  };

  const loadData = async () => {
    setLoading(true);
    const [{ data: ev }, { data: qu }, { data: followUps }] = await Promise.all([
      supabase.from("events").select("*").eq("status", "pending").is("serie_id", null).order("created_at", { ascending: false }),
      supabase.from("quellen").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("events").select("*").eq("status", "pending").not("serie_id", "is", null).order("datum", { ascending: true }),
    ]);

    // Build serie counts and events map
    const counts: Record<string, number> = {};
    const eventsMap: Record<string, any[]> = {};
    followUps?.forEach((e) => {
      if (e.serie_id) {
        counts[e.serie_id] = (counts[e.serie_id] || 0) + 1;
        if (!eventsMap[e.serie_id]) eventsMap[e.serie_id] = [];
        eventsMap[e.serie_id].push(e);
      }
    });

    setPendingEvents(ev || []);
    setPendingQuellen(qu || []);
    setSerienCounts(counts);
    setSerienEvents(eventsMap);
    setSelectedIds(new Set());
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);

  const approveEvent = async (id: string) => {
    await supabase.from("events").update({ status: "approved" }).eq("id", id);
    // Also approve serie follow-ups
    await supabase.from("events").update({ status: "approved" }).eq("serie_id", id);
    setTaggingId(id);
    setMsg("Event freigeschaltet — KI taggt...");
    try {
      const res = await fetch("https://wfkzxqscskppfivqsgno.supabase.co/functions/v1/tag-events-intelligently", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      setMsg(data.success ? "✅ Freigeschaltet & KI-getaggt!" : "✅ Freigeschaltet (Tagging fehlgeschlagen)");
    } catch { setMsg("✅ Freigeschaltet (Tagging offline)"); }
    setTaggingId(null);
    setPendingEvents((p) => p.filter((e) => e.id !== id));
    setTimeout(() => setMsg(""), 3000);
  };

  const rejectEvent = async (id: string) => {
    await supabase.from("events").update({ status: "rejected" }).eq("id", id);
    setPendingEvents((p) => p.filter((e) => e.id !== id));
    setMsg("❌ Event abgelehnt"); setTimeout(() => setMsg(""), 2000);
  };

  const approveQuelle = async (id: string) => {
    await supabase.from("quellen").update({ status: "approved" }).eq("id", id);
    setPendingQuellen((p) => p.filter((q) => q.id !== id));
    setMsg("✅ Quelle freigeschaltet"); setTimeout(() => setMsg(""), 2000);
  };

  const rejectQuelle = async (id: string) => {
    await supabase.from("quellen").update({ status: "rejected" }).eq("id", id);
    setPendingQuellen((p) => p.filter((q) => q.id !== id));
    setMsg("❌ Quelle abgelehnt"); setTimeout(() => setMsg(""), 2000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allPendingIds = pendingEvents.map((e) => e.id);
  const allSelected = allPendingIds.length > 0 && allPendingIds.every((id) => selectedIds.has(id));
  const someSelected = allPendingIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allPendingIds));
    }
  };

  const batchApprove = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    setMsg("Batch-Freigabe läuft...");
    const ids = Array.from(selectedIds);

    // Approve selected events
    await supabase.from("events").update({ status: "approved" }).in("id", ids);
    // Approve serie follow-ups for selected events
    await supabase.from("events").update({ status: "approved" }).in("serie_id", ids);

    try {
      const res = await fetch("https://wfkzxqscskppfivqsgno.supabase.co/functions/v1/tag-events-intelligently", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      setMsg(data.success ? `✅ ${ids.length} Events freigegeben & KI-getaggt!` : `✅ ${ids.length} Events freigegeben (Tagging fehlgeschlagen)`);
    } catch { setMsg(`✅ ${ids.length} Events freigegeben (Tagging offline)`); }

    setBatchLoading(false);
    await loadData();
    setTimeout(() => setMsg(""), 3000);
  };

  const batchReject = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`${selectedIds.size} Events wirklich ablehnen und löschen?`);
    if (!confirmed) return;
    setBatchLoading(true);
    setMsg("Batch-Ablehnung läuft...");
    const ids = Array.from(selectedIds);

    // Delete serie follow-ups first, then the events themselves
    await supabase.from("events").delete().in("serie_id", ids);
    await supabase.from("events").delete().in("id", ids);

    setMsg(`❌ ${ids.length} Events abgelehnt & gelöscht`);
    setBatchLoading(false);
    await loadData();
    setTimeout(() => setMsg(""), 3000);
  };

  if (!authed) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🛠️</div>
            <h1 className="text-2xl font-bold text-gray-900">Kidgo Admin</h1>
            <p className="text-sm text-gray-500 mt-1">Einreichungen prüfen & freischalten</p>
          </div>
          <input type="password" placeholder="Passwort" value={pw}
            onChange={(e) => { setPw(e.target.value); setPwError(false); }}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className={`w-full px-4 py-3 border rounded-xl mb-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${pwError ? "border-red-400 bg-red-50" : "border-gray-200"}`}
          />
          {pwError && <p className="text-red-500 text-sm mb-3 text-center">Falsches Passwort</p>}
          <button onClick={login} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
            Einloggen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🛠️ Kidgo Admin</h1>
            <p className="text-sm text-gray-500">Einreichungen prüfen & freischalten</p>
          </div>
          <a href="/" className="text-sm text-indigo-600 hover:underline">← Zur App</a>
        </div>

        {/* Toast */}
        {msg && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl text-sm font-medium">
            {msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
            <div className="text-3xl font-bold text-orange-500">{pendingEvents.length}</div>
            <div className="text-sm text-gray-500 mt-1">Events ausstehend</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-400">
            <div className="text-3xl font-bold text-blue-500">{pendingQuellen.length}</div>
            <div className="text-sm text-gray-500 mt-1">Quellen ausstehend</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setTab("events")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${tab === "events" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"}`}>
            📅 Events ({pendingEvents.length})
          </button>
          <button onClick={() => setTab("quellen")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${tab === "quellen" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"}`}>
            🔗 Quellen ({pendingQuellen.length})
          </button>
          <button onClick={loadData} disabled={loading}
            className="ml-auto px-3 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-100 text-sm shadow-sm transition disabled:opacity-50">
            {loading ? "⏳" : "🔄"} Aktualisieren
          </button>
        </div>

        {/* "Alle auswählen" — only shown in events tab with pending events */}
        {tab === "events" && pendingEvents.length > 0 && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
            />
            <span className="text-sm text-gray-600 font-medium">Alle auswählen</span>
          </label>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">⏳ Lädt...</div>
        ) : tab === "events" ? (
          <div className="space-y-3">
            {pendingEvents.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-sm">
                <div className="text-4xl mb-2">✅</div>
                <p>Keine ausstehenden Events</p>
              </div>
            ) : pendingEvents.map((ev) => (
              <div key={ev.id}
                className={`bg-white rounded-xl p-5 shadow-sm border transition ${selectedIds.has(ev.id) ? "border-indigo-400 ring-1 ring-indigo-300" : "border-gray-100 hover:border-indigo-200"}`}>
                <div className="flex gap-3">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ev.id)}
                      onChange={() => toggleSelect(ev.id)}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-base">{ev.titel}</h3>
                      {serienCounts[ev.id] && (
                        <button
                          onClick={() => setExpandedSerie(expandedSerie === ev.id ? null : ev.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full hover:bg-indigo-200 transition"
                          title="Serien-Termine anzeigen"
                        >
                          🔄 +{serienCounts[ev.id]} Termine
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                      {ev.datum && <span>📅 {ev.datum}{ev.datum_ende ? ` – ${ev.datum_ende}` : ""}</span>}
                      {ev.ort && <span>📍 {ev.ort}</span>}
                      {ev.preis_chf != null && <span>💰 CHF {ev.preis_chf}</span>}
                      {ev.altersgruppen?.length > 0 && <span>👦 {ev.altersgruppen.join(", ")}</span>}
                      {ev.kontakt_email && <span>✉️ {ev.kontakt_email}</span>}
                    </div>
                    {ev.beschreibung && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{ev.beschreibung}</p>}
                    {ev.anmelde_link && (
                      <a href={ev.anmelde_link} target="_blank" rel="noopener noreferrer"
                        className="mt-1 text-xs text-indigo-500 hover:underline break-all block">
                        🔗 {ev.anmelde_link}
                      </a>
                    )}
                    {expandedSerie === ev.id && serienEvents[ev.id] && (
                      <div className="mt-3 border-t border-indigo-100 pt-3">
                        <p className="text-xs font-semibold text-indigo-600 mb-2">📅 Weitere Serien-Termine:</p>
                        <ul className="space-y-1">
                          {serienEvents[ev.id].map((se) => (
                            <li key={se.id} className="text-xs text-gray-600 flex gap-2">
                              <span className="text-gray-400">{se.datum || "—"}</span>
                              <span>{se.ort || se.titel}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => approveEvent(ev.id)} disabled={taggingId === ev.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap">
                      {taggingId === ev.id ? "⏳ KI taggt..." : "✅ Freischalten"}
                    </button>
                    <button onClick={() => rejectEvent(ev.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-semibold transition">
                      ❌ Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {pendingQuellen.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-sm">
                <div className="text-4xl mb-2">✅</div>
                <p>Keine ausstehenden Quellen</p>
              </div>
            ) : pendingQuellen.map((qu) => (
              <div key={qu.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition">
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base">{qu.name}</h3>
                    <a href={qu.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:underline break-all block mt-0.5">{qu.url}</a>
                    {qu.notizen && <p className="mt-2 text-sm text-gray-600">{qu.notizen}</p>}
                    {qu.kontakt_email && <p className="mt-1 text-xs text-gray-400">✉️ {qu.kontakt_email}</p>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => approveQuelle(qu.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition">
                      ✅ Freischalten
                    </button>
                    <button onClick={() => rejectQuelle(qu.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-semibold transition">
                      ❌ Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Batch Action-Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700 mr-auto">
              {selectedIds.size} {selectedIds.size === 1 ? "Event" : "Events"} ausgewählt
            </span>
            <button
              onClick={batchApprove}
              disabled={batchLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap"
            >
              ✅ Alle freigeben
            </button>
            <button
              onClick={batchReject}
              disabled={batchLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap"
            >
              ❌ Alle ablehnen
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={batchLoading}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap"
            >
              Auswahl aufheben
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
