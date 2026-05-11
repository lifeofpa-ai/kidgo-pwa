"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { useUserPrefs } from "@/lib/user-prefs-context";
import { trackChatUsed } from "@/lib/gamification";

interface EventCard {
  id: string;
  titel: string;
  datum: string | null;
  ort?: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "kidgo";
  text: string;
  events?: EventCard[];
  quickReplies?: string[];
}

const SESSION_KEY = "kidgo_chat_messages";
const MAX_MESSAGES = 20;
const RATE_LIMIT_MS = 3000;

const SUGGESTION_CHIPS = [
  "Was können wir heute machen?",
  "Indoor-Tipps bei Regen?",
  "Gratis-Events dieses Wochenende?",
  "Aktivitäten für 4-Jährige?",
];

function generateQuickReplies(answer: string): string[] {
  const lower = answer.toLowerCase();
  if (lower.includes("indoor") || lower.includes("drin")) {
    return ["Mehr Indoor-Ideen?", "Was kostet das?", "Wie komme ich hin?"];
  }
  if (lower.includes("outdoor") || lower.includes("drauss") || lower.includes("natur")) {
    return ["Bei Regen Alternative?", "Was kostet das?", "Weitere Outdoor-Tipps?"];
  }
  if (lower.includes("gratis") || lower.includes("kostenlos")) {
    return ["Mehr Gratis-Events?", "Was gibt es sonst?", "Weitere Tipps?"];
  }
  if (lower.includes("camp") || lower.includes("ferien")) {
    return ["Was kostet das?", "Wie anmelden?", "Andere Camps?"];
  }
  return ["Mehr Ideen?", "Andere Aktivitäten?", "Was kostet das?"];
}

function KidgoAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #5BBAA7 0%, #4A9E8E 100%)" }}
    >
      <svg width="14" height="14" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-4 4V6a1 1 0 0 1 1-1z"/>
      </svg>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  weatherCode?: number | null;
}

export function ChatSheet({ open, onClose, weatherCode }: Props) {
  const { prefs } = useUserPrefs();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const lastRequestRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;

    const now = Date.now();
    if (now - lastRequestRef.current < RATE_LIMIT_MS) return;
    lastRequestRef.current = now;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: q,
    };
    setMessages((prev) => [...prev, userMsg].slice(-MAX_MESSAGES));
    setInput("");
    setLoading(true);

    try { trackChatUsed(); } catch {}

    try {
      const { data, error } = await supabase.functions.invoke("ask-kidgo", {
        body: {
          question: q,
          context: {
            age_buckets: prefs.ageBuckets,
            weather_code: weatherCode ?? null,
            hour: new Date().getHours(),
            liked_categories: prefs.interests.slice(0, 5),
            standort: "Zürich",
          },
        },
      });

      if (error || !data) throw new Error(error?.message || "API-Fehler");

      const events: EventCard[] = Array.isArray(data.events)
        ? data.events.slice(0, 3).map((e: { id: string; titel: string; datum: string | null; ort?: string | null }) => ({
            id: e.id,
            titel: e.titel,
            datum: e.datum,
            ort: e.ort,
          }))
        : [];

      const kidgoMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "kidgo",
        text: data.answer || "Ich habe leider keine passenden Events gefunden.",
        events,
        quickReplies: generateQuickReplies(data.answer || ""),
      };
      setMessages((prev) => [...prev, kidgoMsg].slice(-MAX_MESSAGES));
    } catch {
      setMessages((prev) =>
        [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "kidgo" as const,
            text: "Ups! Ich bin gerade nicht erreichbar. Bitte versuch es gleich nochmal. 🙈",
          },
        ].slice(-MAX_MESSAGES)
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const isEmpty = messages.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white dark:bg-[#1e2221] rounded-t-3xl flex flex-col shadow-2xl overflow-hidden"
        style={{ height: "70vh" }}
      >
        {/* Glassmorphism Header */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(91,186,167,0.12) 0%, rgba(74,158,142,0.07) 100%)",
            borderBottom: "1px solid rgba(91,186,167,0.18)",
          }}
        >
          <div className="flex items-center gap-3">
            <KidgoAvatar />
            <div>
              <h2 className="font-bold text-[var(--text-primary)] text-base leading-tight">Frag Kidgo</h2>
              <p className="text-xs text-[var(--text-muted)]">Dein Familien-Assistent für Zürich</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); try { sessionStorage.removeItem(SESSION_KEY); } catch {} }}
                aria-label="Chat leeren"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Leeren
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Schliessen"
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isEmpty ? (
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <KidgoAvatar />
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                  <p className="text-sm text-[var(--text-primary)]">
                    Hallo! Ich bin Kidgo — was kann ich für eure Familie finden? 👋
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-11">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="text-xs font-medium bg-[var(--bg-subtle)] text-kidgo-600 dark:text-kidgo-400 border border-kidgo-200 dark:border-kidgo-800 px-3 py-1.5 rounded-full hover:bg-kidgo-50 dark:hover:bg-kidgo-950/30 hover:border-kidgo-300 transition active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]"
                    style={{ background: "linear-gradient(135deg, #5BBAA7 0%, #4A9E8E 100%)" }}
                  >
                    <p className="text-sm text-white">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3 items-start">
                  <KidgoAvatar />
                  <div className="flex flex-col gap-2 max-w-[80%]">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{msg.text}</p>
                    </div>
                    {msg.events && msg.events.length > 0 && (
                      <div className="space-y-2">
                        {msg.events.map((ev) => (
                          <Link
                            key={ev.id}
                            href={`/events/${ev.id}`}
                            onClick={onClose}
                            className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-[var(--border)] rounded-xl px-3 py-2.5 hover:border-kidgo-300 hover:bg-[var(--bg-subtle)] transition group"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                              style={{ background: "linear-gradient(135deg, #5BBAA7 0%, #4A9E8E 100%)" }}
                            >
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <rect x="2" y="3" width="12" height="12" rx="2"/>
                                <path d="M5 1v4M11 1v4M2 7h12"/>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-kidgo-600 transition">{ev.titel}</p>
                              {(ev.datum || ev.ort) && (
                                <p className="text-xs text-[var(--text-muted)]">
                                  {ev.datum
                                    ? new Date(ev.datum).toLocaleDateString("de-CH", { day: "numeric", month: "short" })
                                    : "Ganzjährig"}
                                  {ev.ort ? ` · ${ev.ort}` : ""}
                                </p>
                              )}
                            </div>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--text-muted)] group-hover:text-kidgo-500 flex-shrink-0" aria-hidden="true">
                              <path d="M2.5 6h7M6.5 2.5l3.5 3.5-3.5 3.5"/>
                            </svg>
                          </Link>
                        ))}
                      </div>
                    )}
                    {msg.quickReplies && msg.quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.quickReplies.slice(0, 3).map((qr) => (
                          <button
                            key={qr}
                            onClick={() => sendMessage(qr)}
                            disabled={loading}
                            className="text-xs text-kidgo-600 dark:text-kidgo-400 border border-kidgo-200 dark:border-kidgo-800 px-3 py-1.5 rounded-full hover:bg-kidgo-50 dark:hover:bg-kidgo-950/30 hover:border-kidgo-300 transition active:scale-95 disabled:opacity-50"
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 items-start">
              <KidgoAvatar />
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-kidgo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-kidgo-400 animate-bounce" style={{ animationDelay: "160ms" }} />
                <span className="w-2 h-2 rounded-full bg-kidgo-400 animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) sendMessage(input); }}
              placeholder="Frag Kidgo..."
              className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 focus:border-transparent transition"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              aria-label="Senden"
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #5BBAA7 0%, #4A9E8E 100%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
