import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://app.kidgo.ch";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes: MetadataRoute.Sitemap = [
      { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
      { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.9 },
        ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl) return staticRoutes;

  const supabase = createClient(supabaseUrl, supabaseKey);
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: events } = await supabase
      .from("events")
      .select("id, created_at")
      .eq("status", "approved")
        .or(`datum.is.null,datum.gte.${todayStr},datum_ende.gte.${todayStr}`)
      .order("created_at", { ascending: false })
      .limit(5000);

  const eventRoutes: MetadataRoute.Sitemap = (events || []).map((e) => ({
        url: `${BASE_URL}/events/${e.id}`,
        lastModified: e.created_at ? new Date(e.created_at) : undefined,
        changeFrequency: "weekly",
        priority: 0.7,
  }));

  return [...staticRoutes, ...eventRoutes];
}
