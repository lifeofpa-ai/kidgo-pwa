export interface KidgoEvent {
  id: string;
  titel: string;
  datum: string | null;
  datum_ende: string | null;
  ort: string | null;
  beschreibung: string | null;
  kategorie_bild_url: string | null;
  status: string;
  event_typ: string | null;
  altersgruppen: string[] | null;
  alters_buckets: string[] | null;
  alter_von: number | null;
  alter_bis: number | null;
  indoor_outdoor: string | null;
  kategorie?: string | null;
  kategorien: string[] | null;
  preis_chf: number | null;
  anmelde_link: string | null;
  quelle_id: string | null;
  created_at: string;
  serie_id: string | null;
}

export interface ScoredEvent extends KidgoEvent {
  score: number;
  reasons: string[];
}

export interface CompactEvent {
  id: string;
  titel: string;
  datum: string | null;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
}

export interface ParsedQuery {
  ageBuckets: string[];
  indoor: boolean | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  keywords: string[];
  freeOnly: boolean;
  childNames: Array<{ name: string; bucket: string }>;
}

export interface DayPlanResult {
  morning: KidgoEvent | null;
  afternoon: KidgoEvent | null;
}

export interface SmartCollection {
  id: string;
  label: string;
  emoji?: string;
  filter: (e: KidgoEvent, now: Date) => boolean;
}

export interface EventSource {
  id: string;
  url: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UserLocation {
  lat: number;
  lon: number;
  label: string;
  approximate: boolean;
}
