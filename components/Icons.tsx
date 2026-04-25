"use client";
import { ReactNode } from "react";

type P = { size?: number; className?: string; color?: string };

function I({ size = 24, className = "", color = "currentColor", children }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

// ── Category Icons ──────────────────────────────────────────────
export const SportIcon = (p: P) => <I {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 3c0 4 2 6 0 9s0 5 0 9"/>
  <path d="M3.6 9h16.8M3.6 15h16.8"/>
</I>;

export const KreativIcon = (p: P) => <I {...p}>
  <path d="M20 2L8 14M8 14l-5 2 2-5L20 2z"/>
  <path d="M15 7l2 2"/>
  <circle cx="5" cy="19" r="2" strokeOpacity="0.5"/>
</I>;

export const MusikIcon = (p: P) => <I {...p}>
  <path d="M9 18V5l12-2v13"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="16" r="3"/>
</I>;

export const NaturIcon = (p: P) => <I {...p}>
  <path d="M17 8C8 10 5.9 16.17 3.82 19.39c-.73 1.17.85 2.4 1.88 1.46l2.96-2.72"/>
  <path d="M21 3a16 16 0 0 1-14 18.5"/>
</I>;

export const TiereIcon = (p: P) => <I {...p}>
  <circle cx="8.5" cy="5" r="2"/>
  <circle cx="15.5" cy="5" r="2"/>
  <circle cx="5" cy="10" r="2"/>
  <circle cx="19" cy="10" r="2"/>
  <path d="M12 20.5c-3.5 0-7-2-7-4.5s2-4 7-4 7 1.5 7 4-3.5 4.5-7 4.5z"/>
</I>;

export const TanzIcon = (p: P) => <I {...p}>
  <circle cx="12" cy="4" r="2"/>
  <path d="M12 6v6M9 10l-2 4M15 10l2 4M9 20l3-4 3 4"/>
</I>;

export const TheaterIcon = (p: P) => <I {...p}>
  <path d="M2 10s3-3 6-3 5 3 5 3v2a5.5 5.5 0 0 1-11 0v-2z"/>
  <path d="M17 7s2-1 4-1 2 1 2 1v1.5a3.5 3.5 0 0 1-6 0V7z"/>
  <path d="M5 13.5s1 2 3 2M19 9.5s-1 2-3 2"/>
</I>;

export const ModeDesignIcon = (p: P) => <I {...p}>
  <circle cx="6" cy="6" r="3"/>
  <circle cx="6" cy="18" r="3"/>
  <line x1="20" y1="4" x2="8.12" y2="15.88"/>
  <line x1="14.47" y1="14.48" x2="20" y2="20"/>
  <line x1="8.12" y1="8.12" x2="12" y2="12"/>
</I>;

export const WissenschaftIcon = (p: P) => <I {...p}>
  <path d="M8 3v4l-4 8a4 4 0 0 0 4 6h8a4 4 0 0 0 4-6l-4-8V3"/>
  <line x1="8" y1="3" x2="16" y2="3"/>
  <line x1="9" y1="12" x2="15" y2="12"/>
</I>;

export const BildungIcon = (p: P) => <I {...p}>
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
</I>;

export const AusflugIcon = (p: P) => <I {...p}>
  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
  <circle cx="12" cy="10" r="3"/>
</I>;

export const FeriencampIcon = (p: P) => <I {...p}>
  <path d="M2 20l10-16 10 16H2z"/>
  <path d="M7.5 20l4.5-7 4.5 7"/>
</I>;

export function getCategoryIcon(category: string, props: P = {}) {
  switch (category) {
    case "Sport":         return <SportIcon {...props} />;
    case "Kreativ":       return <KreativIcon {...props} />;
    case "Musik":         return <MusikIcon {...props} />;
    case "Natur":         return <NaturIcon {...props} />;
    case "Tiere":         return <TiereIcon {...props} />;
    case "Tanz":          return <TanzIcon {...props} />;
    case "Theater":       return <TheaterIcon {...props} />;
    case "Mode & Design": return <ModeDesignIcon {...props} />;
    case "Wissenschaft":  return <WissenschaftIcon {...props} />;
    case "Bildung":       return <BildungIcon {...props} />;
    case "Ausflug":       return <AusflugIcon {...props} />;
    case "Feriencamp":    return <FeriencampIcon {...props} />;
    default:              return <SparkleIcon {...props} />;
  }
}

// ── Age Bucket Icons ────────────────────────────────────────────
export const BabyIcon = (p: P) => <I {...p}>
  <circle cx="12" cy="8" r="5"/>
  <path d="M3 20c0-4 4-7 9-7s9 3 9 7"/>
  <path d="M9 8h.01M15 8h.01"/>
  <path d="M9.5 10.5 Q12 12 14.5 10.5"/>
</I>;

export const ChildIcon = (p: P) => <I {...p}>
  <circle cx="12" cy="5" r="3"/>
  <path d="M12 8v8M9 12h6M9 21l3-5 3 5"/>
</I>;

export const YouthIcon = (p: P) => <I {...p}>
  <circle cx="12" cy="5" r="2.5"/>
  <path d="M14 10l3 4-2 1M10 10l-3 4 2 1M12 10v5M10 21l2-6 2 6"/>
</I>;

export const ExplorerIcon = (p: P) => <I {...p}>
  <circle cx="11" cy="11" r="5"/>
  <line x1="16" y1="16" x2="22" y2="22"/>
  <path d="M7 11h8M11 7v8"/>
</I>;

// ── Collection / Challenge Icons ────────────────────────────────
export const GiftIcon = (p: P) => <I {...p}>
  <polyline points="20 12 20 22 4 22 4 12"/>
  <rect x="2" y="7" width="20" height="5"/>
  <line x1="12" y1="22" x2="12" y2="7"/>
  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
</I>;

export const TentIcon = (p: P) => <I {...p}>
  <path d="M3.5 21L12 5l8.5 16H3.5z"/>
  <path d="M9 21v-5a3 3 0 0 1 6 0v5"/>
</I>;

export const TreeIcon = (p: P) => <I {...p}>
  <path d="M17 14l-5-9-5 9h4l-2 7h6l-2-7z"/>
</I>;

export const SparkleIcon = (p: P) => <I {...p}>
  <path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6L12 2z"/>
</I>;

export const MuseumIcon = (p: P) => <I {...p}>
  <path d="M3 10h18M12 3l9 7H3l9-7z"/>
  <path d="M5 10v10M9 10v10M15 10v10M19 10v10M3 20h18"/>
</I>;

export const MapIcon = (p: P) => <I {...p}>
  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
  <line x1="8" y1="2" x2="8" y2="18"/>
  <line x1="16" y1="6" x2="16" y2="22"/>
</I>;

// ── Weather Icons ───────────────────────────────────────────────
export const SunIcon = (p: P) => <I {...p}>
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
</I>;

export const PartlyCloudyIcon = (p: P) => <I {...p}>
  <circle cx="9" cy="9" r="4" strokeOpacity="0.6"/>
  <path d="M9 5V3M3 9H1M5.22 5.22 3.8 3.8"/>
  <path d="M17 21H7a4 4 0 1 1 .9-7.9A5.5 5.5 0 1 1 17 21z"/>
</I>;

export const LightRainIcon = (p: P) => <I {...p}>
  <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
  <line x1="8" y1="19" x2="8" y2="21"/>
  <line x1="12" y1="19" x2="12" y2="21"/>
  <line x1="16" y1="19" x2="16" y2="21"/>
</I>;

export const HeavyRainIcon = (p: P) => <I {...p}>
  <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
  <line x1="8" y1="19" x2="8" y2="23"/>
  <line x1="12" y1="17" x2="12" y2="21"/>
  <line x1="16" y1="19" x2="16" y2="23"/>
</I>;

export const ThunderIcon = (p: P) => <I {...p}>
  <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
  <polyline points="13 11 9 17 15 17 11 23"/>
</I>;

export function WeatherIcon({ code, size = 18, className = "" }: { code: number; size?: number; className?: string }) {
  if (code >= 80) return <ThunderIcon size={size} className={className} />;
  if (code >= 61) return <HeavyRainIcon size={size} className={className} />;
  if (code >= 51) return <LightRainIcon size={size} className={className} />;
  if (code >= 3)  return <PartlyCloudyIcon size={size} className={className} />;
  return <SunIcon size={size} className={className} />;
}

// ── UI Icons ────────────────────────────────────────────────────
export const PhoneIcon = (p: P) => <I {...p}>
  <rect x="5" y="2" width="14" height="20" rx="2"/>
  <line x1="12" y1="18" x2="12.01" y2="18"/>
</I>;

export const WifiOffIcon = (p: P) => <I {...p}>
  <line x1="1" y1="1" x2="23" y2="23"/>
  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
</I>;

export const BellIcon = (p: P) => <I {...p}>
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</I>;

export const DownloadIcon = (p: P) => <I {...p}>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</I>;

// ── Badge Icons ─────────────────────────────────────────────────
export const TelescopeIcon = (p: P) => <I {...p}>
  <circle cx="10" cy="13" r="4"/>
  <path d="M16 13h6M14.5 10.5L20 5M5 14H2M3 8l5 5"/>
</I>;

export const ThumbsUpIcon = (p: P) => <I {...p}>
  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
</I>;

export const FlameIcon = (p: P) => <I {...p}>
  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>
</I>;

export const EyeOffIcon = (p: P) => <I {...p}>
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
  <line x1="1" y1="1" x2="23" y2="23"/>
</I>;

export const CalendarCheckIcon = (p: P) => <I {...p}>
  <rect x="3" y="4" width="18" height="18" rx="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
  <path d="M9 16l2 2 4-4"/>
</I>;

export const MapPinIcon = (p: P) => <I {...p}>
  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
  <circle cx="12" cy="10" r="3"/>
</I>;

export const ChatBubbleIcon = (p: P) => <I {...p}>
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
</I>;

export function getBadgeIcon(badgeId: string, props: P = {}) {
  switch (badgeId) {
    case "entdecker":         return <TelescopeIcon {...props} />;
    case "bewerter":          return <ThumbsUpIcon {...props} />;
    case "stammgast":         return <FlameIcon {...props} />;
    case "geheimtipp_jaeger": return <EyeOffIcon {...props} />;
    case "planer":            return <CalendarCheckIcon {...props} />;
    case "kartograph":        return <MapPinIcon {...props} />;
    case "frag_experte":      return <ChatBubbleIcon {...props} />;
    default:                  return <SparkleIcon {...props} />;
  }
}
