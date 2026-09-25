"use client";

import { useEffect, useState } from "react";

interface KidgoLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /**
   * Single-color (charcoal) variant, for placement on teal or other colored/
   * photo backgrounds where the two-tone version loses contrast (e.g. the
   * onboarding screens' solid-teal background). Default is the two-tone
   * wordmark, theme-aware via --kidgo-logo-ink / --kidgo-logo-go (charcoal +
   * teal in light mode, warm off-white + light teal in dark mode).
   */
  mono?: boolean;
  /**
   * If true, the "go" briefly pops on mount (once per session). Respects
   * `prefers-reduced-motion`. Use on welcome screens and main headers.
   */
  animated?: boolean;
}

// Wordmark viewBox is 218x94 (cropped tight around the glyphs, see viewBox
// below) -- aspect ratio ~2.32:1. Widths chosen so heights land at roughly:
// xs=17, sm=34, md=46, lg=77, xl=108
const SIZES = { xs: 40, sm: 80, md: 106, lg: 178, xl: 250 } as const;

const SESSION_KEY = "kidgo_logo_animated";

// Wordmark + monogram as outlined vector paths (Nunito ExtraBold 800, shaped
// with HarfBuzz incl. kerning, letter-spacing -1). Live <text> used to fall
// back to the OS system font (Nunito is not loaded in the app since 21.09.2026),
// so the logo looked different on every device. Paths render identically
// everywhere and need no web font.
const KID_PATH =
  "M20.72 88.72Q17.76 88.72 16.2 87.12Q14.64 85.52 14.64 82.56V37.04Q14.64 34 16.2 32.44Q17.76 30.88 20.72 30.88Q23.6 30.88 25.16 32.44Q26.72 34 26.72 37.04V64.96H26.88L38.48 52.08Q40.24 50.08 41.72 49.08Q43.2 48.08 45.68 48.08Q48.16 48.08 49.48 49.36Q50.8 50.64 50.84 52.44Q50.88 54.24 49.28 56.08L37.04 69.76V65.2L50.64 80.88Q52.16 82.72 51.96 84.56Q51.76 86.4 50.32 87.56Q48.88 88.72 46.64 88.72Q43.92 88.72 42.28 87.68Q40.64 86.64 38.96 84.48L26.88 71.04H26.72V82.56Q26.72 88.72 20.72 88.72Z M64.36 88.64Q61.4 88.64 59.84 86.92Q58.28 85.2 58.28 82.08V54.72Q58.28 51.52 59.84 49.8Q61.4 48.08 64.36 48.08Q67.24 48.08 68.8 49.8Q70.36 51.52 70.36 54.72V82.08Q70.36 85.2 68.84 86.92Q67.32 88.64 64.36 88.64ZM64.36 41.52Q61 41.52 59.2 39.96Q57.4 38.4 57.4 35.52Q57.4 32.56 59.2 31Q61 29.44 64.36 29.44Q67.72 29.44 69.48 31Q71.24 32.56 71.24 35.52Q71.24 38.4 69.48 39.96Q67.72 41.52 64.36 41.52Z M94 88.88Q88.88 88.88 85 86.4Q81.12 83.92 78.96 79.28Q76.8 74.64 76.8 68.32Q76.8 62 78.96 57.44Q81.12 52.88 85 50.4Q88.88 47.92 94 47.92Q98.64 47.92 102.2 50.16Q105.76 52.4 107.04 56H106.16V37.04Q106.16 34 107.68 32.44Q109.2 30.88 112.16 30.88Q115.04 30.88 116.64 32.44Q118.24 34 118.24 37.04V82.56Q118.24 85.52 116.68 87.12Q115.12 88.72 112.24 88.72Q109.36 88.72 107.8 87.12Q106.24 85.52 106.24 82.56V77.12L107.12 80.24Q106 84.16 102.36 86.52Q98.72 88.88 94 88.88ZM97.6 79.84Q100.24 79.84 102.16 78.56Q104.08 77.28 105.2 74.76Q106.32 72.24 106.32 68.32Q106.32 62.48 103.92 59.72Q101.52 56.96 97.6 56.96Q95.04 56.96 93.08 58.16Q91.12 59.36 90.04 61.88Q88.96 64.4 88.96 68.32Q88.96 74.16 91.36 77Q93.76 79.84 97.6 79.84Z";
const GO_PATH =
  "M145.4 103.28Q141.08 103.28 137.12 102.56Q133.16 101.84 130.12 100.4Q128.28 99.6 127.52 98.32Q126.76 97.04 126.88 95.6Q127 94.16 127.84 93.04Q128.68 91.92 129.96 91.48Q131.24 91.04 132.68 91.68Q136.2 93.28 139.2 93.76Q142.2 94.24 144.36 94.24Q149.48 94.24 152.04 91.92Q154.6 89.6 154.6 84.8V78.72H155.32Q154.12 82.4 150.36 84.72Q146.6 87.04 142.04 87.04Q136.76 87.04 132.84 84.6Q128.92 82.16 126.76 77.72Q124.6 73.28 124.6 67.44Q124.6 63.04 125.84 59.44Q127.08 55.84 129.36 53.28Q131.64 50.72 134.88 49.32Q138.12 47.92 142.04 47.92Q146.76 47.92 150.4 50.2Q154.04 52.48 155.24 56.16L154.44 58.72V54.16Q154.44 51.2 156 49.64Q157.56 48.08 160.44 48.08Q163.32 48.08 164.84 49.64Q166.36 51.2 166.36 54.16V83.44Q166.36 93.28 160.96 98.28Q155.56 103.28 145.4 103.28ZM145.64 78Q148.36 78 150.32 76.72Q152.28 75.44 153.4 73.08Q154.52 70.72 154.52 67.44Q154.52 62.48 152.08 59.72Q149.64 56.96 145.64 56.96Q142.92 56.96 140.92 58.2Q138.92 59.44 137.84 61.8Q136.76 64.16 136.76 67.44Q136.76 72.4 139.16 75.2Q141.56 78 145.64 78Z M193.6 88.88Q187.28 88.88 182.6 86.4Q177.92 83.92 175.36 79.28Q172.8 74.64 172.8 68.32Q172.8 63.6 174.24 59.84Q175.68 56.08 178.44 53.4Q181.2 50.72 185.04 49.32Q188.88 47.92 193.6 47.92Q199.92 47.92 204.6 50.4Q209.28 52.88 211.88 57.44Q214.48 62 214.48 68.32Q214.48 73.12 213 76.88Q211.52 80.64 208.8 83.36Q206.08 86.08 202.2 87.48Q198.32 88.88 193.6 88.88ZM193.6 79.84Q196.24 79.84 198.16 78.56Q200.08 77.28 201.2 74.76Q202.32 72.24 202.32 68.32Q202.32 62.48 199.92 59.72Q197.52 56.96 193.6 56.96Q191.04 56.96 189.08 58.16Q187.12 59.36 186.04 61.88Q184.96 64.4 184.96 68.32Q184.96 74.16 187.36 77Q189.76 79.84 193.6 79.84Z";
const K_PATH =
  "M203.8 375.24Q190.48 375.24 183.46 368.04Q176.44 360.84 176.44 347.52V142.68Q176.44 129 183.46 121.98Q190.48 114.96 203.8 114.96Q216.76 114.96 223.78 121.98Q230.8 129 230.8 142.68V268.32H231.52L283.72 210.36Q291.64 201.36 298.3 196.86Q304.96 192.36 316.12 192.36Q327.28 192.36 333.22 198.12Q339.16 203.88 339.34 211.98Q339.52 220.08 332.32 228.36L277.24 289.92V269.4L338.44 339.96Q345.28 348.24 344.38 356.52Q343.48 364.8 337 370.02Q330.52 375.24 320.44 375.24Q308.2 375.24 300.82 370.56Q293.44 365.88 285.88 356.16L231.52 295.68H230.8V347.52Q230.8 375.24 203.8 375.24Z";

export function KidgoLogo({
  size = "md",
  className = "",
  mono = false,
  animated = false,
}: KidgoLogoProps) {
  const w = SIZES[size];
  const h = Math.round(w * (94 / 218));

  // Only animate on first mount per session, and only on client.
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!animated) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // sessionStorage unavailable -- still play, but only this render
    }
    setPlay(true);
  }, [animated]);

  // kidgo-logo-breathe: gentle ambient float, always on (respects reduced-motion).
  // kidgo-logo-hoverable: triggers the "go" pop on hover/focus, not just on mount.
  const rootClass = `${className} kidgo-logo-breathe kidgo-logo-hoverable ${
    play ? "kidgo-logo-animate" : ""
  }`.trim();

  return (
    <svg
      width={w}
      height={h}
      viewBox="6 20 218 94"
      xmlns="http://www.w3.org/2000/svg"
      className={rootClass}
      aria-label="Kidgo"
      role="img"
    >
      {mono ? (
        // Fixed charcoal: mono is only used on solid teal backgrounds, which
        // stay teal in dark mode -- a theme-aware ink would turn light there.
        <g fill="#2D3436">
          <path d={KID_PATH} />
          <path d={GO_PATH} />
        </g>
      ) : (
        <>
          <path d={KID_PATH} fill="var(--kidgo-logo-ink)" />
          <path className="kidgo-logo-go" d={GO_PATH} fill="var(--kidgo-logo-go)" />
        </>
      )}
    </svg>
  );
}

interface KidgoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Compact square monogram -- the "k" mark. For spots too small or too
 * animated (spinners, avatars) for the full wordmark: favicon, app icon,
 * and icon-only nav/footer spots that already carry a "Kidgo" text label
 * next to them.
 */
export function KidgoMark({ size = 28, className = "" }: KidgoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kidgo"
      role="img"
    >
      <rect width="512" height="512" rx="112" fill="var(--kidgo-teal)" />
      <path d={K_PATH} fill="var(--kidgo-mark-ink)" />
    </svg>
  );
}
