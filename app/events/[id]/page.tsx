import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import EventDetailClient from "./EventDetailClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BASE_URL = "https://kidgo-app.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!supabaseUrl) return { title: "Event – Kidgo" };
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: event } = await supabase
    .from("events")
    .select("titel, beschreibung, kategorie_bild_url, datum, ort")
    .eq("id", id)
    .single();

  if (!event) {
    return { title: "Event nicht gefunden – Kidgo" };
  }

  const title = `${event.titel} – Kidgo`;
  const rawDesc = event.beschreibung
    ? event.beschreibung.replace(/\n/g, " ").trim()
    : "";
  const description = rawDesc.length > 0
    ? rawDesc.slice(0, 160)
    : event.ort
      ? `Kinder-Event in ${event.ort.split(",")[0]} — jetzt auf Kidgo entdecken.`
      : "Kinder-Event auf Kidgo entdecken.";

  const url = `${BASE_URL}/events/${id}`;
  const images = event.kategorie_bild_url
    ? [{ url: event.kategorie_bild_url, width: 1200, height: 630, alt: event.titel }]
    : [];

  return {
    title,
    description,
    openGraph: {
      title: event.titel,
      description,
      url,
      siteName: "Kidgo",
      locale: "de_CH",
      type: "article",
      images,
    },
    twitter: {
      card: images.length > 0 ? "summary_large_image" : "summary",
      title: event.titel,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailClient id={id} />;
}
