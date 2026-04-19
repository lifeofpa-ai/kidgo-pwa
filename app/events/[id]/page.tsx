"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams } from "next/navigation";

const categoryEmojis: Record<string, string> = {
  "Kreativ": "🎨", "Natur": "🌿", "Tiere": "🐾", "Sport": "⚽",
  "Tanz": "💃", "Theater": "🎭", "Musik": "🎵", "Mode & Design": "👗",
  "Wissenschaft": "🔬", "Bildung": "📚", "Ausflug": "🗺️", "Feriencamp": "🏕️",
};

const categoryColors: Record<string, string> = {
  "Kreativ": "bg-pink-100 text-pink-600",
  "Natur": "bg-green-100 text-green-600",
  "Tiere": "bg-yellow-100 text-yellow-600",
  "Sport": "bg-blue-100 text-blue-600",
  "Tanz": "bg-purple-100 text-purple-600",
  "Theater": "bg-red-100 text-red-600",
  "Musik": "bg-indigo-100 text-indigo-600",
  "Mode & Design": "bg-rose-100 text-rose-600",
  "Wissenschaft": "bg-cyan-100 text-cyan-600",
  "Bildung": "bg-orange-100 text-orange-600",
  "Ausflug": "bg-teal-100 text-teal-600",
  "Feriencamp": "bg-amber-100 text-amber-600",
};

function extractPrice(beschreibung: string | null): number | null {
  if (!beschreibung) return null;
  const patterns = [
    /CHF\s*(\d+(?:[.,]\d+)?)/i,
    /Fr\.\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\.[-–—]+/,
    /(\d+(?:[.,]\d+)?)\s*Franken/i,
  ];
  for (const pat of patterns) {
    const m = beschreibung.match(pat);
    if (m) return parseFloat(m[1].replace(",", "."));
  }
  return null;
}

function isFreeText(beschreibung: string | null, preis_chf: number | null, titel: string): boolean {
  const desc = (beschreibung || "").toLowerCase();
  const t = titel.toLowerCase();
  return (
    preis_chf === 0 ||
    ["gratis", "kostenlos", "freier eintritt", "free"].some((kw) => desc.includes(kw) || t.includes(kw))
  );
}

const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function detectWeeklyPattern(termine: { datum: string }[]): string | null {
  if (termine.length < 2) return null;
  const sorted = [...termine].sort((a, b) => a.datum.localeCompare(b.datum));
  const diffs = sorted.slice(1).map((t, i) => {
    const d1 = new Date(sorted[i].datum + "T00:00:00");
    const d2 = new Date(t.datum + "T00:00:00");
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  });
  const isWeekly = diffs.every((d) => d === 7);
  if (!isWeekly) return null;
  return WEEKDAYS_DE[new Date(sorted[0].datum + "T00:00:00").getDay()];
}

function CategoryImage({ url, kategorien }: { url?: string | null; kategorien?: string[] }) {
  const [imgError, setImgError] = useState(false);
  const cat = kategorien?.[0] || "";
  const emoji = categoryEmojis[cat] || "🎪";
  const colors = categoryColors[cat] || "bg-indigo-100 text-indigo-600";

  if (url && !imgError) {
    return (
      <div className="w-full h-52 sm:h-64 overflow-hidden rounded-xl mb-6">
        <img
          src={url}
          alt={cat || "Event"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`w-full h-52 sm:h-64 rounded-xl mb-6 flex items-center justify-center ${colors}`}>
      <span className="text-8xl">{emoji}</span>
    </div>
  );
}

const formatDate = (dateStr: string, dateEndStr?: string | null) => {
  const date = new Date(dateStr + "T00:00:00");
  if (dateEndStr) {
    const dateEnd = new Date(dateEndStr + "T00:00:00");
    const startFormatted = date.toLocaleDateString("de-CH", { day: "numeric", month: "short" });
    const endFormatted = dateEnd.toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" });
    return `${startFormatted} – ${endFormatted}`;
  }
  return date.toLocaleDateString("de-CH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

export default function EventDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [event, setEvent] = useState<any>(null);
  const [source, setSource] = useState<any>(null);
  const [serieTermine, setSerieTermine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);
  const [similarEvents, setSimilarEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (eventData) {
        setEvent(eventData);
        if (eventData.quelle_id) {
          const { data: sourceData } = await supabase
            .from("quellen")
            .select("*")
            .eq("id", eventData.quelle_id)
            .single();
          setSource(sourceData);
        }
        // Load series child dates if this event is a series parent
        const { data: termineData } = await supabase
          .from("events")
          .select("id, datum, datum_ende, ort")
          .eq("serie_id", eventData.id)
          .order("datum", { ascending: true });
        setSerieTermine(termineData || []);

        // Fetch similar events by category then by location
        const cats = eventData.kategorien || (eventData.kategorie ? [eventData.kategorie] : []);
        let simResults: any[] = [];
        if (cats.length > 0) {
          const { data: catData } = await supabase
            .from("events")
            .select("id, titel, datum, ort, kategorie_bild_url, kategorien, kategorie")
            .eq("status", "approved")
            .neq("id", eventData.id)
            .contains("kategorien", [cats[0]])
            .limit(6);
          simResults = catData || [];
        }
        if (simResults.length < 3 && eventData.ort) {
          const existing = new Set(simResults.map((e: any) => e.id));
          const city = eventData.ort.split(",")[0].trim().split(" ")[0];
          const { data: ortData } = await supabase
            .from("events")
            .select("id, titel, datum, ort, kategorie_bild_url, kategorien, kategorie")
            .eq("status", "approved")
            .neq("id", eventData.id)
            .ilike("ort", `%${city}%`)
            .limit(4);
          for (const e of ortData || []) {
            if (!existing.has(e.id)) simResults.push(e);
          }
        }
        setSimilarEvents(simResults.slice(0, 3));
      }
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event?.titel, text: event?.beschreibung?.slice(0, 100), url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      });
    }
  };

  const handleICSDownload = () => {
    if (!event) return;
    const esc = (s: string) => s.replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const toICSDate = (d: string) => d.replace(/-/g, "");
    const startDate = event.datum ? toICSDate(event.datum) : toICSDate(new Date().toISOString().split("T")[0]);
    const endDate = event.datum_ende
      ? toICSDate(event.datum_ende)
      : event.datum
        ? toICSDate(new Date(new Date(event.datum + "T12:00:00").getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        : startDate;
    const ctaUrlVal = event.anmelde_link || source?.url || "";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kidgo//Kidgo Events//DE",
      "BEGIN:VEVENT",
      `UID:${event.id}@kidgo.ch`,
      `SUMMARY:${esc(event.titel)}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      event.ort ? `LOCATION:${esc(event.ort)}` : "",
      event.beschreibung ? `DESCRIPTION:${esc(event.beschreibung.slice(0, 500))}` : "",
      ctaUrlVal ? `URL:${ctaUrlVal}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.titel.replace(/[^a-z0-9äöü]/gi, "_").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Lädt...</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-5xl mb-4">😢</p>
          <p className="text-gray-600 text-lg mb-6">Event nicht gefunden</p>
          <Link href="/" className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
            ← Zurück zur Übersicht
          </Link>
        </div>
      </main>
    );
  }

  const isNew = event.created_at && new Date(event.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ctaUrl = event.anmelde_link || source?.url;
  const mapsUrl = event.ort ? `https://maps.google.com/?q=${encodeURIComponent(event.ort)}` : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium mb-6 transition"
        >
          ← Zurück zu meinen Empfehlungen
        </Link>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className={`h-2 ${event.datum ? "bg-indigo-500" : "bg-green-500"}`} />
          <div className="p-6 sm:p-8">
            <CategoryImage url={event.kategorie_bild_url} kategorien={event.kategorien} />
            {(() => {
              const badges: { label: string; cls: string }[] = [];
              if (isNew) badges.push({ label: "✨ Neu", cls: "bg-green-500 text-white" });
              if (serieTermine.length > 0) badges.push({ label: "🔄 Regelmässig", cls: "bg-indigo-100 text-indigo-700" });
              if (isFreeText(event.beschreibung, event.preis_chf, event.titel)) {
                badges.push({ label: "🎁 Gratis", cls: "bg-green-100 text-green-700" });
              } else if (event.preis_chf != null && event.preis_chf > 0) {
                badges.push({ label: `💰 CHF ${event.preis_chf}`, cls: "bg-sky-100 text-sky-700" });
              } else {
                const p = extractPrice(event.beschreibung);
                if (p !== null) badges.push({ label: `💰 ab CHF ${p % 1 === 0 ? p : p.toFixed(2)}`, cls: "bg-sky-100 text-sky-700" });
              }
              return (
                <div className="flex flex-wrap gap-2 mb-4">
                  {badges.map((b, i) => (
                    <span key={i} className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${b.cls}`}>{b.label}</span>
                  ))}
                </div>
              );
            })()}

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-5 leading-tight">{event.titel}</h1>

            <div className="grid gap-3 mb-5">
              {event.datum ? (
                <div className="flex items-start gap-3 bg-indigo-50 rounded-lg p-3">
                  <span className="text-xl">📅</span>
                  <div>
                    <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-0.5">Datum</p>
                    <p className="font-semibold text-indigo-700">{formatDate(event.datum, event.datum_ende)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-green-50 rounded-lg p-3">
                  <span className="text-xl">🎢</span>
                  <div>
                    <p className="text-xs text-green-500 font-medium uppercase tracking-wide mb-0.5">Verfügbarkeit</p>
                    <p className="font-semibold text-green-700">Ganzjährig geöffnet</p>
                  </div>
                </div>
              )}

              {event.ort && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <span className="text-xl">📍</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Ort</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{event.ort}</p>
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition">
                          In Maps öffnen →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const p = event.preis_chf != null && event.preis_chf > 0
                  ? event.preis_chf
                  : isFreeText(event.beschreibung, event.preis_chf, event.titel)
                    ? null
                    : extractPrice(event.beschreibung);
                const isFree = isFreeText(event.beschreibung, event.preis_chf, event.titel);
                if (!isFree && p == null) return null;
                return (
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <span className="text-xl">{isFree ? "🎁" : "💰"}</span>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Preis</p>
                      <p className="font-semibold text-gray-800">{isFree ? "Kostenlos" : `CHF ${p}`}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {event.kategorien?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {event.kategorien.map((cat: string) => (
                  <span key={cat} className="inline-block bg-indigo-100 text-indigo-800 text-sm font-semibold px-3 py-1 rounded-full">
                    {categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : ""}{cat}
                  </span>
                ))}
              </div>
            )}

            {event.altersgruppen?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {event.altersgruppen.map((ag: string) => (
                  <span key={ag} className="inline-block bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                    👶 {ag}
                  </span>
                ))}
              </div>
            )}

            {event.beschreibung && (
              <>
                <hr className="my-5 border-gray-100" />
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Beschreibung</h2>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">{event.beschreibung}</p>
                </div>
              </>
            )}

            {serieTermine.length > 0 && (
              <>
                <hr className="my-5 border-gray-100" />
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-lg font-semibold text-gray-800">🔄 Weitere Termine dieser Serie</h2>
                  </div>
                  {(() => {
                    const weekly = detectWeeklyPattern(serieTermine);
                    return weekly ? (
                      <p className="text-sm text-indigo-600 font-semibold mb-3 flex items-center gap-1.5">
                        <span>📆</span> Jeden {weekly}
                      </p>
                    ) : null;
                  })()}
                  <ul className="space-y-2">
                    {serieTermine.map((termin) => (
                      <li key={termin.id}>
                        <Link
                          href={`/events/${termin.id}`}
                          className="flex items-start gap-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-2 text-sm transition group"
                        >
                          <span className="text-indigo-400 mt-0.5">📅</span>
                          <div className="flex-1">
                            <span className="font-medium text-indigo-700 group-hover:text-indigo-900 transition">{formatDate(termin.datum, termin.datum_ende)}</span>
                            {termin.ort && <span className="text-gray-500 ml-2">· {termin.ort}</span>}
                          </div>
                          <span className="text-indigo-300 group-hover:text-indigo-500 transition text-xs mt-0.5">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              {ctaUrl && (
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-indigo-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-md hover:shadow-lg"
                >
                  🌐 Zur Webseite / Anmeldung
                </a>
              )}
              {event.datum && (
                <button
                  onClick={handleICSDownload}
                  className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-semibold transition bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                  title="In Kalender speichern"
                >
                  📅 Kalender
                </button>
              )}
              <button
                onClick={handleShare}
                className={`flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-semibold transition ${shared ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {shared ? (
                  <>✓ Link kopiert!</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Teilen
                  </>
                )}
              </button>
            </div>

            {/* ===== FEATURE 2: ÄHNLICHE EVENTS ===== */}
            {similarEvents.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Das könnte dir auch gefallen</h2>
                <div className="space-y-3">
                  {similarEvents.map((sim) => (
                    <Link
                      key={sim.id}
                      href={`/events/${sim.id}`}
                      className="flex gap-3 bg-gray-50 hover:bg-indigo-50 rounded-xl p-3 transition group border border-transparent hover:border-indigo-100"
                    >
                      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-indigo-100 flex items-center justify-center">
                        {sim.kategorie_bild_url ? (
                          <img src={sim.kategorie_bild_url} alt={sim.titel} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{categoryEmojis[(sim.kategorien?.[0] || sim.kategorie || "")] || "🎪"}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 group-hover:text-indigo-700 transition text-sm leading-snug line-clamp-2">{sim.titel}</p>
                        {sim.datum && (
                          <p className="text-xs text-gray-500 mt-1">
                            📅 {new Date(sim.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                        {sim.ort && <p className="text-xs text-gray-400 truncate">📍 {sim.ort}</p>}
                      </div>
                      <span className="text-indigo-300 group-hover:text-indigo-500 transition self-center text-sm">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 text-center text-gray-400 text-sm">
          <Link href="/" className="hover:text-indigo-500 transition">← Zurück zu meinen Empfehlungen</Link>
          {" · "}
          <Link href="/explore" className="hover:text-indigo-500 transition">Alle Events</Link>
        </footer>
      </div>
    </main>
  );
}
