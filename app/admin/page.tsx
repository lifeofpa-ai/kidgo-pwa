"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_PW = "FpEEzd8u8B$Q0!0fMm3a";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<"events" | "quellen" | "live">("events");
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [pendingQuellen, setPendingQuellen] = useState<any[]>([]);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [serienCounts, setSerienCounts] = useState<Record<string, number>>({});
  const [serienEvents, setSerienEvents] = useState<Record<string, any[]>>({});
  const [expandedSerie, setExpandedSerie] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reviewEvents, setReviewEvents] = useState<any[]>([]);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [openReviewInputs, setOpenReviewInputs] = useState<Set<string>>(new Set());
  const [reviewSending, setReviewSending] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const login = () => {
    if (pw === ADMIN_PW) { setAuthed(true); }
    else { setPwError(true); }
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    const [
      { data: ev, error: evErr },
      { data: qu, error: quErr },
      { data: followUps, error: followUpsErr },
      { data: live, error: liveErr },
      { data: reviewEvs, error: reviewErr },
    ] = await Promise.all([
      supabase.from("events").select("*").eq("status", "pending").is("serie_id", null).order("created_at", { ascending: false }),
      supabase.from("quellen").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("events").select("*").eq("status", "pending").not("serie_id", "is", null).order("datum", { ascending: true }),
      supabase.from("events").select("*").eq("status", "approved").order("datum", { ascending: true }).limit(200),
      supabase.from("events").select("*").eq("status", "review").order("created_at", { ascending: false }),
    ]);

    const firstError = evErr || quErr || followUpsErr || liveErr || reviewErr;
    if (firstError) {
      setErrorMsg("Fehler beim Laden der Daten: " + firstError.message);
      setLoading(false);
      return;
    }

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
    setLiveEvents(live || []);
    setReviewEvents(reviewEvs || []);
    setSelectedIds(new Set());
    setLoading(false);
  };

  useEffect(() => { if (authed) loadData(); }, [authed]);

  const approveEvent = async (id: string) => {
    const { error } = await supabase.from("events").update({ status: "approved" }).eq("id", id);
    if (error) { alert("Fehler beim Freischalten: " + error.message); return; }
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
    setReviewEvents((p) => p.filter((e) => e.id !== id));
    setTimeout(() => setMsg(""), 3000);
  };

  const rejectEvent = async (id: string) => {
    const { error: childError } = await supabase.from("events").delete().eq("serie_id", id);
    if (childError) { alert("Fehler beim Löschen der Serien-Kinder: " + childError.message); return; }
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { alert("Fehler beim Löschen: " + error.message); return; }
    setPendingEvents((p) => p.filter((e) => e.id !== id));
    setReviewEvents((p) => p.filter((e) => e.id !== id));
    setMsg("❌ Event gelöscht"); setTimeout(() => setMsg(""), 2000);
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

    const { error: batchErr } = await supabase.from("events").update({ status: "approved" }).in("id", ids);
    if (batchErr) { alert("Fehler bei Batch-Freigabe: " + batchErr.message); setBatchLoading(false); return; }
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

    const { error: childErr } = await supabase.from("events").delete().in("serie_id", ids);
    if (childErr) { alert("Fehler beim Löschen der Serien-Kinder: " + childErr.message); setBatchLoading(false); return; }
    const { error: deleteErr } = await supabase.from("events").delete().in("id", ids);
    if (deleteErr) { alert("Fehler beim Löschen: " + deleteErr.message); setBatchLoading(false); return; }

    setMsg(`❌ ${ids.length} Events abgelehnt & gelöscht`);
    setBatchLoading(false);
    await loadData();
    setTimeout(() => setMsg(""), 3000);
  };

  const startEdit = (ev: any) => {
    setEditingId(ev.id);
    setEditModalOpen(true);
    setEditFields({
      titel: ev.titel || "",
      datum: ev.datum || "",
      datum_ende: ev.datum_ende || "",
      ort: ev.ort || "",
      preis_chf: ev.preis_chf ?? "",
      beschreibung: ev.beschreibung || "",
      anmelde_link: ev.anmelde_link || "",
      kontakt_email: ev.kontakt_email || "",
      altersgruppen: (ev.altersgruppen || []).join(", "),
      event_typ: ev.event_typ || "event",
      status: ev.status || "approved",
      _url: ev.url || "",
    });
  };

  const saveEdit = async (id: string) => {
    const updates: Record<string, any> = { ...editFields };
    delete updates._url;
    if (updates.preis_chf === "") updates.preis_chf = null;
    else if (updates.preis_chf !== null) updates.preis_chf = Number(updates.preis_chf);
    if (typeof updates.altersgruppen === "string") {
      updates.altersgruppen = updates.altersgruppen.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    const { error } = await supabase.from("events").update(updates).eq("id", id);
    if (error) { alert("Fehler beim Speichern: " + error.message); return; }
    setEditingId(null);
    setEditModalOpen(false);
    setMsg("✅ Event gespeichert");
    await loadData();
    setTimeout(() => setMsg(""), 2000);
  };

  const deleteLiveEvent = async (id: string) => {
    if (!window.confirm("Live-Event wirklich löschen?")) return;
    await supabase.from("events").delete().eq("serie_id", id);
    await supabase.from("events").delete().eq("id", id);
    setLiveEvents((prev) => prev.filter((e) => e.id !== id));
    setMsg("🗑️ Event gelöscht"); setTimeout(() => setMsg(""), 2000);
  };

  const toggleReviewInput = (id: string) => {
    setOpenReviewInputs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sendToReview = async (id: string) => {
    setReviewSending(id);
    const comment = reviewComments[id] || "";
    await supabase.from("events").update({
      status: "review",
      review_comment: comment,
      review_requested_at: new Date().toISOString(),
    }).eq("id", id);
    setMsg("📋 An PO zum Review gesendet");
    setReviewSending(null);
    setOpenReviewInputs((prev) => { const next = new Set(prev); next.delete(id); return next; });
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

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="ml-4 text-red-500 hover:text-red-700 font-bold">✕</button>
          </div>
        )}

        {/* Toast */}
        {msg && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl text-sm font-medium">
            {msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
            <div className="text-3xl font-bold text-orange-500">{pendingEvents.length + reviewEvents.length}</div>
            <div className="text-sm text-gray-500 mt-1">Events ausstehend</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-400">
            <div className="text-3xl font-bold text-blue-500">{pendingQuellen.length}</div>
            <div className="text-sm text-gray-500 mt-1">Quellen ausstehend</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-400">
            <div className="text-3xl font-bold text-green-500">{liveEvents.length}</div>
            <div className="text-sm text-gray-500 mt-1">Live Events</div>
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
          <button onClick={() => setTab("live")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${tab === "live" ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"}`}>
            ✅ Live ({liveEvents.length})
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
              <div key={`pending-${ev.id}`}
                className={`bg-white rounded-xl p-5 shadow-sm border transition ${selectedIds.has(ev.id) ? "border-indigo-400 ring-1 ring-indigo-300" : "border-gray-100 hover:border-indigo-200"}`}>
                <div className="flex gap-3">
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
                    <button onClick={() => startEdit(ev)}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-semibold transition whitespace-nowrap">
                      ✏️ Bearbeiten
                    </button>
                    <button onClick={() => rejectEvent(ev.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-semibold transition">
                      ❌ Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {reviewEvents.length > 0 && (
              <>
                <div className="mt-6 mb-3 flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-600">Wartet auf PO-Entscheid</span>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">{reviewEvents.length}</span>
                </div>
                {reviewEvents.map((ev) => (
                  <div key={`review-${ev.id}`} className="bg-white rounded-xl p-5 shadow-sm border border-yellow-200">
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-base">{ev.titel}</h3>
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">🔍 PO Review</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                          {ev.datum && <span>📅 {ev.datum}{ev.datum_ende ? ` – ${ev.datum_ende}` : ""}</span>}
                          {ev.ort && <span>📍 {ev.ort}</span>}
                          {ev.preis_chf != null && <span>💰 CHF {ev.preis_chf}</span>}
                        </div>
                        {ev.review_comment && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-800 border border-yellow-100">
                            💬 {ev.review_comment}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button onClick={() => approveEvent(ev.id)} disabled={taggingId === ev.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap">
                          {taggingId === ev.id ? "⏳ KI taggt..." : "✅ Freischalten"}
                        </button>
                        <button onClick={() => startEdit(ev)}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-semibold transition whitespace-nowrap">
                          ✏️ Bearbeiten
                        </button>
                        <button onClick={() => rejectEvent(ev.id)}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-semibold transition">
                          ❌ Ablehnen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : tab === "quellen" ? (
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
        ) : (
          /* Live Events Tab */
          <div className="space-y-3">
            {liveEvents.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-sm">
                <div className="text-4xl mb-2">📭</div>
                <p>Keine freigeschalteten Events</p>
              </div>
            ) : liveEvents.map((ev) => (
              <div key={ev.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-green-200 transition">
                <>
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-base">{ev.titel}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                        {ev.datum && <span>📅 {ev.datum}{ev.datum_ende ? ` – ${ev.datum_ende}` : ""}</span>}
                        {ev.ort && <span>📍 {ev.ort}</span>}
                        {ev.preis_chf != null && <span>💰 CHF {ev.preis_chf}</span>}
                        {ev.altersgruppen?.length > 0 && <span>👦 {ev.altersgruppen.join(", ")}</span>}
                      </div>
                      {ev.beschreibung && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{ev.beschreibung}</p>}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => startEdit(ev)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-semibold transition whitespace-nowrap">
                        ✏️ Bearbeiten
                      </button>
                      <button onClick={() => toggleReviewInput(ev.id)}
                        className="px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 text-sm font-semibold transition whitespace-nowrap">
                        📋 An PO
                      </button>
                      <button onClick={() => deleteLiveEvent(ev.id)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-semibold transition">
                        🗑️ Löschen
                      </button>
                    </div>
                  </div>
                  {openReviewInputs.has(ev.id) && (
                    <div className="mt-3 border-t border-yellow-100 pt-3 space-y-2">
                      <textarea
                        value={reviewComments[ev.id] || ""}
                        onChange={(e) => setReviewComments((prev) => ({ ...prev, [ev.id]: e.target.value }))}
                        placeholder="Kommentar für den PO..."
                        rows={3}
                        className="w-full px-3 py-2 border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none"
                      />
                      <button
                        onClick={() => sendToReview(ev.id)}
                        disabled={reviewSending === ev.id}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-semibold transition disabled:opacity-60 whitespace-nowrap"
                      >
                        {reviewSending === ev.id ? "⏳ Wird gesendet..." : "📋 An PO zum Review senden"}
                      </button>
                    </div>
                  )}
                </>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalOpen && editingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) { setEditModalOpen(false); setEditingId(null); } }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">✏️ Event bearbeiten</h2>
              <button onClick={() => { setEditModalOpen(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 font-medium">Titel</label>
                  <input value={editFields.titel} onChange={(e) => setEditFields((f) => ({ ...f, titel: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Datum von</label>
                  <input type="date" value={editFields.datum} onChange={(e) => setEditFields((f) => ({ ...f, datum: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Datum bis</label>
                  <input type="date" value={editFields.datum_ende} onChange={(e) => setEditFields((f) => ({ ...f, datum_ende: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Ort</label>
                  <input value={editFields.ort} onChange={(e) => setEditFields((f) => ({ ...f, ort: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Preis CHF</label>
                  <input type="number" value={editFields.preis_chf} onChange={(e) => setEditFields((f) => ({ ...f, preis_chf: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 font-medium">Beschreibung</label>
                  <textarea value={editFields.beschreibung} onChange={(e) => setEditFields((f) => ({ ...f, beschreibung: e.target.value }))}
                    rows={3} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Altersgruppen</label>
                  <input value={editFields.altersgruppen} onChange={(e) => setEditFields((f) => ({ ...f, altersgruppen: e.target.value }))}
                    placeholder="z.B. 4-6, 7-10, 11-14"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Event-Typ</label>
                  <select value={editFields.event_typ} onChange={(e) => setEditFields((f) => ({ ...f, event_typ: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                    <option value="event">Event</option>
                    <option value="camp">Camp</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Status</label>
                  <select value={editFields.status} onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Anmelde-Link</label>
                  <input value={editFields.anmelde_link} onChange={(e) => setEditFields((f) => ({ ...f, anmelde_link: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Kontakt E-Mail</label>
                  <input value={editFields.kontakt_email} onChange={(e) => setEditFields((f) => ({ ...f, kontakt_email: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                {editFields._url && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium">Bild-URL</label>
                    <p className="mt-1 text-xs text-gray-400 break-all px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">{editFields._url}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={() => saveEdit(editingId)}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold transition">
                  💾 Speichern
                </button>
                <button onClick={() => { setEditModalOpen(false); setEditingId(null); }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-semibold transition">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
