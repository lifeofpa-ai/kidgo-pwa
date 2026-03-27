import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Fetch all event sources
export async function getEventSources() {
  const { data, error } = await supabase
    .from("quellen")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching sources:", error);
    return [];
  }
  return data;
}

// Fetch sources by category
export async function getSourcesByCategory(category: string) {
  if (category === "Alle") {
    return getEventSources();
  }

  const { data, error } = await supabase
    .from("quellen")
    .select("*")
    .eq("kategorie", category)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching sources:", error);
    return [];
  }
  return data;
}

// Search sources by name
export async function searchSources(query: string) {
  const { data, error } = await supabase
    .from("quellen")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error searching sources:", error);
    return [];
  }
  return data;
}
