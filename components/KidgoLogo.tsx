"use client";

import { useEffect, useState } from "react";

interface KidgoLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /**
   * Single-color (charcoal) variant, for placement on teal or other colored/
   * photo backgrounds where the two-tone version loses contrast (e.g. the
   * onboarding screens' solid-teal background). Default is the two-tone
   * "kid" (charcoal) + "go" (teal) wordmark, which needs a light backdrop.
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
      <text
        x="10"
        y="88"
        fontFamily="var(--font-nunito), sans-serif"
        fontWeight="800"
        fontSize="80"
        style={{ letterSpacing: "-1px" }}
      >
        {mono ? (
          <tspan fill="var(--kidgo-text)">kidgo</tspan>
        ) : (
          <>
            <tspan fill="var(--kidgo-text)">kid</tspan>
            <tspan className="kidgo-logo-go" fill="var(--kidgo-teal)">
              go
            </tspan>
          </>
        )}
      </text>
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
      <text
        x="256"
        y="372"
        textAnchor="middle"
        fontFamily="var(--font-nunito), sans-serif"
        fontWeight="800"
        fontSize="360"
        fill="var(--kidgo-text)"
      >
        k
      </text>
    </svg>
  );
}
