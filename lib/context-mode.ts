export type ContextMode = "weekend" | "rain" | "evening" | "holiday" | "normal";

// Kanton ZH Schulferien 2025/2026
const ZH_HOLIDAYS: Array<[string, string]> = [
  ["2025-02-17", "2025-02-21"],
  ["2025-04-14", "2025-04-25"],
  ["2025-07-07", "2025-08-15"],
  ["2025-09-29", "2025-10-10"],
  ["2025-12-22", "2026-01-04"],
  ["2026-02-09", "2026-02-13"],
  ["2026-04-06", "2026-04-17"],
  ["2026-07-06", "2026-08-14"],
];

export function isSchoolHoliday(date: Date = new Date()): boolean {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const s = `${y}-${m}-${d}`;
  return ZH_HOLIDAYS.some(([start, end]) => s >= start && s <= end);
}

export function getContextMode(
  weatherCode: number | null = null,
  now: Date = new Date()
): ContextMode {
  const hour = now.getHours();
  const dow = now.getDay(); // 0=Sun, 6=Sat

  if (isSchoolHoliday(now)) return "holiday";
  if (weatherCode !== null && weatherCode >= 51) return "rain";
  if (dow === 0 || dow === 6 || (dow === 5 && hour >= 14)) return "weekend";
  if (hour >= 18) return "evening";
  return "normal";
}

export function getContextLabel(mode: ContextMode): string {
  const labels: Record<ContextMode, string> = {
    weekend: "Wochenend-Tipps",
    rain: "Indoor bei Regen",
    evening: "Für morgen",
    holiday: "Feriencamp-Highlights",
    normal: "Empfehlungen für dich",
  };
  return labels[mode];
}

export function getContextBadge(mode: ContextMode): string | null {
  const badges: Partial<Record<ContextMode, string>> = {
    weekend: "Wochenende",
    rain: "Regentag",
    holiday: "Schulferien",
  };
  return badges[mode] ?? null;
}

export function applyContextSort(events: any[], mode: ContextMode): any[] {
  if (mode === "rain") {
    return [...events].sort((a, b) => {
      const aS = a.indoor_outdoor === "indoor" ? 0 : a.indoor_outdoor === "beides" ? 1 : 2;
      const bS = b.indoor_outdoor === "indoor" ? 0 : b.indoor_outdoor === "beides" ? 1 : 2;
      return aS - bS;
    });
  }
  if (mode === "holiday") {
    return [...events].sort((a, b) => {
      const aC = a.event_typ === "camp" || a.kategorien?.includes("Feriencamp") ? 0 : 1;
      const bC = b.event_typ === "camp" || b.kategorien?.includes("Feriencamp") ? 0 : 1;
      return aC - bC;
    });
  }
  return events;
}
