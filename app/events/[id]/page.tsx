"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
  const router = useRouter();
  const id = params.id as string;
  const [event, setEvent] = useState<any>(null);
  const [source, setSource] = useState<any>(null);
  const [serieTermine, setSerieTermine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);

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
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-800 font-medium mb-6 transition"
        >
          ← Zurück
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className={`h-2 ${event.datum ? "bg-indigo-500" : "bg-green-500"}`} />
          <div className="p-6 sm:p-8">
            <CategoryImage url={event.kategorie_bild_url} kategorien={event.kategorien} />
            <div className="flex flex-wrap gap-2 mb-4">
              {isNew && <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">✨ Neu</span>}
              {event.preis_chf === 0 && <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">🎉 Kostenlos</span>}
            </div>

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

              {event.preis_chf != null && event.preis_chf > 0 && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <span className="text-xl">💰</span>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Preis</p>
                    <p className="font-semibold text-gray-800">CHF {event.preis_chf}</p>
                  </div>
                </div>
              )}
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
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">🔄 Weitere Termine</h2>
                  <ul className="space-y-2">
                    {serieTermine.map((termin) => (
                      <li key={termin.id} className="flex items-start gap-2 bg-indigo-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-indigo-400 mt-0.5">📅</span>
                        <div>
                          <span className="font-medium text-indigo-700">{formatDate(termin.datum, termin.datum_ende)}</span>
                          {termin.ort && <span className="text-gray-500 ml-2">· {termin.ort}</span>}
                        </div>
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
          </div>
        </div>

        <footer className="mt-8 text-center text-gray-400 text-sm">
          <Link href="/" className="hover:text-indigo-500 transition">← Alle Events</Link>
          {" · "}
          <span>kidgo-app.vercel.app</span>
        </footer>
      </div>
    </main>
  );
}
