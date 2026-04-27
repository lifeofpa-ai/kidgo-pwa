"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { trackVisit } from "@/lib/gamification";
import {
  getEventRating,
  setEventRating,
  type EventRating,
} from "@/lib/preferences";
import {
  fetchNextConnection,
  formatDuration,
  formatDepartureTime,
  type TransitConnection,
} from "@/lib/transport";
import { safeExternalUrl } from "@/lib/safe-url";

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  "Kreativ": "bg-pink-50 text-pink-600 border-pink-100",
  "Natur": "bg-green-50 text-green-600 border-green-100",
  "Tiere": "bg-yellow-50 text-yellow-600 border-yellow-100",
  "Sport": "bg-blue-50 text-blue-600 border-blue-100",
  "Tanz": "bg-purple-50 text-purple-600 border-purple-100",
  "Theater": "bg-red-50 text-red-600 border-red-100",
  "Musik": "bg-kidgo-50 text-kidgo-500 border-kidgo-100",
  "Mode & Design": "bg-rose-50 text-rose-600 border-rose-100",
  "Wissenschaft": "bg-cyan-50 text-cyan-600 border-cyan-100",
  "Bildung": "bg-kidgo-50 text-kidgo-500 border-kidgo-100",
  "Ausflug": "bg-teal-50 text-teal-600 border-teal-100",
  "Feriencamp": "bg-kidgo-50 text-kidgo-500 border-kidgo-100",
};

const categoryFallbackColors: Record<string, string> = {
  "Kreativ": "from-pink-100 to-rose-50",
  "Natur": "from-green-100 to-emerald-50",
  "Tiere": "from-kidgo-100 to-kidgo-50",
  "Sport": "from-blue-100 to-sky-50",
  "Tanz": "from-purple-100 to-kidgo-50",
  "Theater": "from-red-100 to-rose-50",
  "Musik": "from-kidgo-100 to-kidgo-50",
  "Mode & Design": "from-rose-100 to-pink-50",
  "Wissenschaft": "from-cyan-100 to-sky-50",
  "Bildung": "from-kidgo-100 to-kidgo-50",
  "Ausflug": "from-teal-100 to-green-50",
  "Feriencamp": "from-kidgo-100 to-kidgo-50",
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
  if (!diffs.every((d) => d === 7)) return null;
  return WEEKDAYS_DE[new Date(sorted[0].datum + "T00:00:00").getDay()];
}

function HeroImage({
  url,
  kategorien,
  title,
  parallaxOffset = 0,
}: {
  url?: string | null;
  kategorien?: string[];
  title: string;
  parallaxOffset?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const cat = kategorien?.[0] || "";
  const fallback = categoryFallbackColors[cat] || "from-kidgo-100 to-kidgo-50";

  if (url && !imgError) {
    return (
      <div className="relative w-full h-64 sm:h-80 overflow-hidden">
        <img
          src={url}
          alt={title}
          className="w-full object-cover absolute inset-x-0"
          style={{
            height: "135%",
            top: "-17.5%",
            transform: `translateY(${parallaxOffset * 0.3}px)`,
          }}
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>
    );
  }
  return (
    <div className={`w-full h-64 sm:h-80 bg-gradient-to-br ${fallback} flex items-center justify-center`}>
      <div className="text-center">
        <p className="text-5xl font-bold text-white/20 tracking-tight">{cat || "kidgo"}</p>
      </div>
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

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-400" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="12" rx="2"/>
      <path d="M1 7h14M5 1v4M11 1v4"/>
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-400" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1a4 4 0 0 1 4 4c0 3-4 9-4 9S4 8 4 5a4 4 0 0 1 4-4z"/>
      <circle cx="8" cy="5" r="1.5"/>
    </svg>
  );
}

function IconPrice() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-gray-400" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7"/>
      <path d="M8 4v8M6 5.5h3a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 0 0 3h3"/>
    </svg>
  );
}

function IconRepeat() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h9M2 4l2-2M2 4l2 2M12 10H3M12 10l-2-2M12 10l-2 2"/>
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="8"/>
      <path d="M1 9h16M9 1c-2 2-3 5-3 8s1 6 3 8M9 1c2 2 3 5 3 8s-1 6-3 8"/>
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 1.5a5 5 0 0 1 5 5v3l1 1.5H1.5L2.5 9.5v-3a5 5 0 0 1 5-5z"/>
      <path d="M6 12.5a1.5 1.5 0 0 0 3 0"/>
    </svg>
  );
}

function TransitInfo({ ort, sbbUrl }: { ort: string; sbbUrl: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conn, setConn]   = useState<TransitConnection | null>(null);
  const [error, setError] = useState<string>("");

  // Read user location from the same localStorage key used by the home page.
  // We prefer a labelled city ("Zürich", "Winterthur", ...) over raw coords —
  // transport.opendata.ch resolves station names but not arbitrary lat/lng.
  function readUserLabel(): string | null {
    try {
      const raw = localStorage.getItem("kidgo_location");
      if (!raw) return null;
      const loc = JSON.parse(raw);
      if (loc.label && loc.label !== "Dein Standort") return String(loc.label);
      if (loc.label === "Dein Standort" && loc.lat && loc.lon) return `${loc.lat},${loc.lon}`;
      return null;
    } catch { return null; }
  }

  const compute = async () => {
    setState("loading");
    setError("");
    const from = readUserLabel();
    if (!from) {
      setState("error");
      setError("Kein Standort gespeichert. Auf der Startseite Standort freigeben.");
      return;
    }
    try {
      const result = await fetchNextConnection(from, ort);
      if (!result) { setState("error"); setError("Keine Verbindung gefunden."); return; }
      setConn(result);
      setState("ready");
    } catch (e) {
      setState("error");
      setError(String(e));
    }
  };

  if (state === "ready" && conn) {
    return (
      <div className="bg-kidgo-50 border border-kidgo-100 rounded-xl px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-semibold text-kidgo-700">{formatDuration(conn.durationMinutes)}</span>
          <span className="text-kidgo-600">ab {formatDepartureTime(conn.departure)}</span>
        </div>
        <div className="text-[var(--text-muted)]">
          {conn.transfers} Umstieg{conn.transfers === 1 ? "" : "e"}
          {conn.products.length > 0 && ` · ${conn.products.join(", ")}`}
        </div>
        {sbbUrl && (
          <a
            href={sbbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1.5 text-kidgo-600 hover:text-kidgo-700 underline"
          >
            Auf SBB.ch öffnen
          </a>
        )}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="text-xs text-[var(--text-muted)] px-3 py-2 border border-[var(--border)] rounded-xl">
        {error}
        {sbbUrl && (
          <>
            {" "}
            <a href={sbbUrl} target="_blank" rel="noopener noreferrer" className="text-kidgo-600 underline">
              SBB.ch
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={compute}
      disabled={state === "loading"}
      className="text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-kidgo-300 hover:text-kidgo-500 px-3 py-1.5 rounded-full transition disabled:opacity-50"
    >
      {state === "loading" ? "Lade…" : "ÖV-Verbindung"}
    </button>
  );
}

export default function EventDetailClient({ id }: { id: string }) {
  const { user } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [source, setSource] = useState<any>(null);
  const [serieTermine, setSerieTermine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [similarEvents, setSimilarEvents] = useState<any[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReminded, setIsReminded] = useState(false);
  const [eventRating, setEventRatingState] = useState<EventRating | null>(null);
  const [ratingPulse, setRatingPulse] = useState<EventRating | null>(null);

  // Sprint 12: Parallax scroll offset
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("event_reviews")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false });
    if (data) {
      setReviews(data);
      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
      if (user) {
        const mine = data.find((r) => r.user_id === user.id);
        if (mine) {
          setUserRating(mine.rating);
          setUserComment(mine.comment ?? "");
          setReviewSubmitted(true);
        }
      }
    }
  };

  const submitReview = async () => {
    if (!user || userRating === 0) return;
    setSubmittingReview(true);
    await supabase.from("event_reviews").upsert({
      user_id: user.id,
      event_id: id,
      rating: userRating,
      comment: userComment.trim() || null,
    });
    setReviewSubmitted(true);
    setSubmittingReview(false);
    try { localStorage.setItem("kidgo_has_reviewed", "true"); } catch {}
    await fetchReviews();
  };

  useEffect(() => {
    fetchReviews();
  }, [id, user]);

  // Sprint 21: keyboard shortcut "b" toggles bookmark on the current event
  useEffect(() => {
    const onShortcut = () => toggleBookmarkDetail();
    window.addEventListener("kidgo:shortcut:bookmark", onShortcut);
    return () => window.removeEventListener("kidgo:shortcut:bookmark", onShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  useEffect(() => {
    try {
      const now = new Date();
      const day = now.getDay();
      const d = new Date(now);
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      const ws = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      const raw = localStorage.getItem("kidgo_visit_streak");
      const streak = raw ? JSON.parse(raw) : { count: 0, weekStart: ws };
      const newCount = streak.weekStart === ws ? streak.count + 1 : 1;
      localStorage.setItem("kidgo_visit_streak", JSON.stringify({ count: newCount, weekStart: ws }));
    } catch {}
  }, [id]);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data: eventData } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (eventData) {
        setEvent(eventData);

        try {
          const raw = localStorage.getItem("kidgo_recent_visits");
          const visits: any[] = raw ? JSON.parse(raw) : [];
          const filtered = visits.filter((v: any) => v.id !== eventData.id);
          const compact = { id: eventData.id, titel: eventData.titel, datum: eventData.datum, ort: eventData.ort, kategorie_bild_url: eventData.kategorie_bild_url, kategorien: eventData.kategorien, visitedAt: new Date().toISOString() };
          localStorage.setItem("kidgo_recent_visits", JSON.stringify([compact, ...filtered].slice(0, 10)));
          trackVisit(eventData.id);
        } catch {}

        try {
          const raw = localStorage.getItem("kidgo_bookmarks");
          if (raw) {
            const bms: { id: string }[] = JSON.parse(raw);
            setIsBookmarked(bms.some((b) => b.id === eventData.id));
          }
        } catch {}

        try {
          const raw = localStorage.getItem("kidgo_reminders");
          if (raw) {
            const reminders: { id: string }[] = JSON.parse(raw);
            setIsReminded(reminders.some((r) => r.id === eventData.id));
          }
        } catch {}

        try {
          setEventRatingState(getEventRating(eventData.id));
        } catch {}

        if (eventData.quelle_id) {
          const { data: sourceData } = await supabase
            .from("quellen")
            .select("*")
            .eq("id", eventData.quelle_id)
            .single();
          setSource(sourceData);
        }
        const { data: termineData } = await supabase
          .from("events")
          .select("id, datum, datum_ende, ort")
          .eq("serie_id", eventData.id)
          .order("datum", { ascending: true });
        setSerieTermine(termineData || []);

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
        setSimilarEvents(simResults.slice(0, 6));
      }
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  const handleReminder = async () => {
    if (!event) return;

    if (!("Notification" in window)) {
      alert("Dein Browser unterstützt leider keine Benachrichtigungen.");
      return;
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;

    try {
      const raw = localStorage.getItem("kidgo_reminders");
      const reminders: any[] = raw ? JSON.parse(raw) : [];
      if (!reminders.some((r) => r.id === event.id)) {
        reminders.push({ id: event.id, titel: event.titel, datum: event.datum, ort: event.ort });
        localStorage.setItem("kidgo_reminders", JSON.stringify(reminders));
      }
      setIsReminded(true);

      // Send to SW if available
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CHECK_REMINDERS_NOW",
        });
      }
    } catch {}
  };

  const toggleBookmarkDetail = () => {
    if (!event) return;
    try { (navigator as any).vibrate?.(10); } catch {}
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      const bms: any[] = raw ? JSON.parse(raw) : [];
      const exists = bms.some((b) => b.id === event.id);
      const next = exists
        ? bms.filter((b) => b.id !== event.id)
        : [{ id: event.id, titel: event.titel, datum: event.datum, ort: event.ort, kategorie_bild_url: event.kategorie_bild_url, kategorien: event.kategorien }, ...bms];
      localStorage.setItem("kidgo_bookmarks", JSON.stringify(next));
      setIsBookmarked(!exists);
    } catch {}
  };

  const handleRate = (rating: EventRating) => {
    if (!event) return;
    try { (navigator as any).vibrate?.(15); } catch {}
    const next = eventRating === rating ? null : rating;
    setEventRatingState(next);
    setEventRating(
      {
        id: event.id,
        kategorien: event.kategorien,
        ort: event.ort,
        indoor_outdoor: event.indoor_outdoor,
        alters_buckets: event.alters_buckets,
      },
      next
    );
    if (next) {
      setRatingPulse(next);
      setTimeout(() => setRatingPulse(null), 600);
    }
  };

  const buildShareText = () => {
    if (!event) return "";
    const url = window.location.href;
    const dateStr = event.datum
      ? new Date(event.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "long" })
      : null;
    const loc = event.ort ? ` in ${event.ort.split(",")[0].trim()}` : "";
    return `Schau dir das an: ${event.titel}${dateStr ? ` am ${dateStr}` : ""}${loc} — gefunden auf Kidgo! ${url}`;
  };

  const handleShare = () => {
    if (!event) return;
    const url = window.location.href;
    const text = buildShareText();
    if (navigator.share) {
      navigator.share({ title: event.titel, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const handleCopyLink = () => {
    const text = buildShareText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const getWhatsAppUrl = () => {
    const text = buildShareText();
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
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
    const ctaUrlVal = safeExternalUrl(event.anmelde_link || source?.url) ?? "";
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
      <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-kidgo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm">Lädt...</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-[var(--text-secondary)] text-lg mb-6">Event nicht gefunden</p>
          <Link href="/" className="bg-kidgo-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-kidgo-500 transition">
            Zurück zur Übersicht
          </Link>
        </div>
      </main>
    );
  }

  const isNew = event.created_at && new Date(event.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ctaUrl = safeExternalUrl(event.anmelde_link || source?.url);
  const mapsUrl = event.ort
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.ort)}`
    : null;
  const sbbUrl = event.ort
    ? `https://www.sbb.ch/de/kaufen/pages/fahrplan/fahrplan.xhtml?nach=${encodeURIComponent(event.ort)}`
    : null;
  const isFree = isFreeText(event.beschreibung, event.preis_chf, event.titel);
  const priceNum = event.preis_chf != null && event.preis_chf > 0 ? event.preis_chf : extractPrice(event.beschreibung);
  const hasImage = !!event.kategorie_bild_url;
  const canRemind = !!event.datum;

  return (
    <main className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto">

        {/* Hero */}
        <div className="relative">
          <HeroImage
            url={event.kategorie_bild_url}
            kategorien={event.kategorien}
            title={event.titel}
            parallaxOffset={scrollY}
          />

          {/* Sprint 12: Floating circle back button */}
          <div className="absolute top-4 left-4">
            <Link
              href="/"
              aria-label="Zurück"
              className="w-10 h-10 bg-white/90 dark:bg-black/50 backdrop-blur-sm text-gray-700 dark:text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-90 transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11L5 7l4-4"/>
              </svg>
            </Link>
          </div>

          {hasImage && (
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
              <div className="flex flex-wrap gap-2 mb-2">
                {isNew && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30">
                    Neu
                  </span>
                )}
                {serieTermine.length > 0 && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30 flex items-center gap-1">
                    <IconRepeat /> Regelmässig
                  </span>
                )}
                {isFree && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30">
                    Gratis
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug drop-shadow-sm">
                {event.titel}
              </h1>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 sm:px-7 pb-20 md:pb-12">

          {!hasImage && (
            <div className="pt-6 mb-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {isNew && (
                  <span className="bg-kidgo-50 text-kidgo-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-kidgo-100">
                    Neu
                  </span>
                )}
                {serieTermine.length > 0 && (
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <IconRepeat /> Regelmässig
                  </span>
                )}
                {isFree && (
                  <span className="bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-100">
                    Gratis
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-snug">
                {event.titel}
              </h1>
            </div>
          )}

          {/* Info rows */}
          <div className={`divide-y divide-[var(--border)] ${hasImage ? "mt-6" : "mt-0"}`}>
            {event.datum ? (
              <div className="flex items-start gap-3 py-4">
                <IconCalendar />
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Datum</p>
                  <p className="font-semibold text-[var(--text-primary)] text-sm">{formatDate(event.datum, event.datum_ende)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 py-4">
                <IconCalendar />
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Verfügbarkeit</p>
                  <p className="font-semibold text-green-600 text-sm">Ganzjährig geöffnet</p>
                </div>
              </div>
            )}

            {event.ort && (
              <div className="flex items-start gap-3 py-4">
                <IconPin />
                <div className="flex-1">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Ort</p>
                  <p className="font-semibold text-[var(--text-primary)] text-sm mb-2">{event.ort}</p>
                  <div className="flex gap-2 flex-wrap items-start">
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-kidgo-300 hover:text-kidgo-500 px-3 py-1.5 rounded-full transition"
                      >
                        Route
                      </a>
                    )}
                    {event.ort && <TransitInfo ort={event.ort} sbbUrl={sbbUrl} />}
                  </div>
                </div>
              </div>
            )}

            {(isFree || priceNum != null) && (
              <div className="flex items-start gap-3 py-4">
                <IconPrice />
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Preis</p>
                  <p className="font-semibold text-[var(--text-primary)] text-sm">
                    {isFree ? "Kostenlos" : `CHF ${priceNum}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Category tags */}
          {event.kategorien?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {event.kategorien.map((cat: string) => (
                <span
                  key={cat}
                  className={`text-xs font-medium px-3 py-1 rounded-full border ${categoryColors[cat] || "bg-gray-50 text-gray-600 border-gray-100"}`}
                >
                  {cat}
                </span>
              ))}
              {event.altersgruppen?.map((ag: string) => (
                <span key={ag} className="text-xs font-medium px-3 py-1 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
                  {ag}{!ag.includes("Jahr") ? " Jahre" : ""}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {event.beschreibung && (
            <div className="mt-7">
              <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Beschreibung</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed text-sm whitespace-pre-line">{event.beschreibung}</p>
            </div>
          )}

          {/* Series dates */}
          {serieTermine.length > 0 && (
            <div className="mt-7">
              <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Weitere Termine
              </h2>
              {(() => {
                const weekly = detectWeeklyPattern(serieTermine);
                return weekly ? (
                  <p className="text-xs text-kidgo-500 font-semibold mb-3">Jeden {weekly}</p>
                ) : null;
              })()}
              <ul className="space-y-1.5">
                {serieTermine.map((termin) => (
                  <li key={termin.id}>
                    <Link
                      href={`/events/${termin.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-kidgo-50 hover:text-kidgo-600 text-sm text-[var(--text-secondary)] transition group"
                    >
                      <IconCalendar />
                      <span className="flex-1 font-medium">{formatDate(termin.datum, termin.datum_ende)}</span>
                      {termin.ort && <span className="text-[var(--text-muted)] text-xs">{termin.ort}</span>}
                      <span className="text-[var(--text-muted)] group-hover:text-kidgo-500 transition text-xs">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA buttons */}
          <div className="mt-8 space-y-3">

            {/* Erinnere mich — primary CTA */}
            {canRemind && (
              <button
                onClick={handleReminder}
                className={`w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-xl font-bold text-base transition-all shadow-sm ${
                  isReminded
                    ? "bg-kidgo-500 text-white shadow-kidgo-200"
                    : "bg-kidgo-500 text-white hover:bg-kidgo-400 active:scale-[0.98]"
                }`}
              >
                <IconBell />
                {isReminded ? "Erinnerung gesetzt" : "Erinnere mich"}
                {isReminded && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8l4 4 6-7"/>
                  </svg>
                )}
              </button>
            )}

            <button
              onClick={toggleBookmarkDetail}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition border ${
                isBookmarked
                  ? "bg-kidgo-50 text-kidgo-500 border-kidgo-200"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-kidgo-300 hover:text-kidgo-500"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h10v11L7 10 2 13V2z"/>
              </svg>
              {isBookmarked ? "Gemerkt" : "Event merken"}
            </button>

            {/* Gefallen-Feedback */}
            <div className="flex items-center gap-3 pt-1">
              <p className="text-xs text-[var(--text-muted)] flex-1">
                {eventRating === "like" || eventRating === "superlike"
                  ? "Danke — wir merken uns euren Geschmack"
                  : eventRating === "dislike"
                    ? "Verstanden, wir zeigen euch besseres"
                    : "Hat euch das Event gefallen?"}
              </p>
              <div className="flex items-center gap-1.5">
                {/* Thumbs down */}
                <button
                  onClick={() => handleRate("dislike")}
                  aria-label="Hat nicht gefallen"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    eventRating === "dislike"
                      ? "bg-gray-200 text-gray-600"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-gray-200 hover:text-gray-600"
                  } ${ratingPulse === "dislike" ? "scale-125" : ""}`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={eventRating === "dislike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 1H4a1 1 0 0 0-.95.68l-1.95 5.85A1 1 0 0 0 2 8.85h4V14a1 1 0 0 0 1 1l4-8V2a1 1 0 0 0-1-1z"/>
                    <path d="M14 1h-1a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1" strokeWidth="1.5"/>
                  </svg>
                </button>
                {/* Thumbs up */}
                <button
                  onClick={() => handleRate("like")}
                  aria-label="Hat gefallen"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    eventRating === "like"
                      ? "bg-[#5BBAA7] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[#5BBAA7]/10 hover:text-[#5BBAA7]"
                  } ${ratingPulse === "like" ? "scale-125" : ""}`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={eventRating === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 15h7a1 1 0 0 0 .95-.68l1.95-5.85A1 1 0 0 0 14 7.15H10V2a1 1 0 0 0-1-1L5 9v5a1 1 0 0 0 0 1z"/>
                    <path d="M2 15h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H2" strokeWidth="1.5"/>
                  </svg>
                </button>
                {/* Super like */}
                <button
                  onClick={() => handleRate("superlike")}
                  aria-label="Mega gut gefallen"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    eventRating === "superlike"
                      ? "bg-amber-400 text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-amber-50 hover:text-amber-500"
                  } ${ratingPulse === "superlike" ? "scale-125" : ""}`}
                  title="Mega gut!"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={eventRating === "superlike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 1l1.5 4.5H14l-3.7 2.7 1.4 4.3L8 9.8l-3.7 2.7 1.4-4.3L2 5.5h4.5z"/>
                  </svg>
                </button>
              </div>
            </div>

            {ctaUrl && (
              <a
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-kidgo-500 text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-kidgo-500 transition shadow-sm"
              >
                <IconGlobe />
                Zur Webseite
              </a>
            )}
            <div className="flex gap-3">
              {event.datum && (
                <button
                  onClick={handleICSDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-kidgo-300 hover:text-kidgo-500 transition"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="2" width="13" height="12" rx="1.5"/>
                    <path d="M1 6h13M5 1v3M10 1v3"/>
                  </svg>
                  Kalender
                </button>
              )}
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-gray-300 hover:text-gray-700 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Teilen
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopyLink}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${copied ? "bg-green-50 text-green-700 border-green-200" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-gray-300"}`}
              >
                {copied ? "Kopiert!" : "Link kopieren"}
              </button>
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition"
              >
                WhatsApp
              </a>
            </div>
          </div>

          {/* Similar events — horizontal carousel */}
          {similarEvents.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
                Das könnte dir gefallen
              </h2>
              <div
                className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
              >
                {similarEvents.map((sim) => (
                  <Link
                    key={sim.id}
                    href={`/events/${sim.id}`}
                    className="flex-shrink-0 w-40 sm:w-48 group"
                  >
                    <div className="w-full h-28 rounded-xl overflow-hidden bg-[var(--bg-subtle)] mb-2">
                      {sim.kategorie_bild_url ? (
                        <img src={sim.kategorie_bild_url} alt={sim.titel} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${categoryFallbackColors[sim.kategorien?.[0] || ""] || "from-kidgo-100 to-kidgo-50"}`} />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors">
                      {sim.titel}
                    </p>
                    {sim.datum && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {new Date(sim.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ===== REVIEWS SECTION ===== */}
          <section className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-[var(--text-primary)]">Bewertungen</h2>
              {avgRating !== null && (
                <div className="flex items-center gap-1.5 bg-kidgo-50 rounded-full px-3 py-1">
                  <span className="text-yellow-400 text-sm">★</span>
                  <span className="text-sm font-semibold text-kidgo-700">{avgRating}</span>
                  <span className="text-xs text-kidgo-500">({reviews.length})</span>
                </div>
              )}
            </div>

            {/* Review form for logged-in users */}
            {user ? (
              <div className="bg-white dark:bg-gray-800 border border-[var(--border)] rounded-2xl p-4 mb-5">
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  {reviewSubmitted ? "Deine Bewertung" : "Event bewerten"}
                </p>
                {/* Star rating */}
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => { setUserRating(star); setReviewSubmitted(false); }}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-2xl leading-none transition-transform hover:scale-110"
                      aria-label={`${star} Sterne`}
                    >
                      <span className={(hoverRating || userRating) >= star ? "text-yellow-400" : "text-gray-200"}>
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {userRating > 0 && (
                  <>
                    <textarea
                      value={userComment}
                      onChange={(e) => setUserComment(e.target.value)}
                      placeholder="Kommentar (optional)"
                      rows={2}
                      className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-[var(--text-primary)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kidgo-300 resize-none mb-2"
                    />
                    <button
                      onClick={submitReview}
                      disabled={submittingReview}
                      className="bg-kidgo-500 text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-kidgo-600 transition disabled:opacity-50"
                    >
                      {submittingReview ? "Speichern…" : reviewSubmitted ? "Aktualisieren" : "Bewertung abgeben"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] rounded-2xl p-4 mb-5 text-center">
                <p className="text-sm text-[var(--text-muted)] mb-2">Melde dich an, um eine Bewertung abzugeben.</p>
                <Link
                  href="/login"
                  className="inline-block bg-kidgo-500 text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-kidgo-600 transition"
                >
                  Anmelden
                </Link>
              </div>
            )}

            {/* Reviews list */}
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white dark:bg-gray-800 border border-[var(--border)] rounded-2xl px-4 py-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-yellow-400 text-sm">
                        {"★".repeat(review.rating)}
                        <span className="text-gray-200">{"★".repeat(5 - review.rating)}</span>
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(review.created_at).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {user && review.user_id === user.id && (
                        <span className="text-xs bg-kidgo-100 text-kidgo-600 rounded-full px-2 py-0.5 ml-auto">Du</span>
                      )}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-[var(--text-secondary)]">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                Noch keine Bewertungen. Sei der Erste!
              </p>
            )}
          </section>

          <footer className="mt-12 pt-6 border-t border-[var(--border)] text-center">
            <nav className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
              <Link href="/" className="hover:text-[var(--text-secondary)] transition">Empfehlungen</Link>
              <span>·</span>
              <Link href="/explore" className="hover:text-[var(--text-secondary)] transition">Alle Events</Link>
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}
