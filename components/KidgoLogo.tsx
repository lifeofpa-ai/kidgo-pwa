"use client";

import { useEffect, useState } from "react";

interface KidgoLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /**
   * If true, the logo briefly winks and smiles on mount (once per session).
   * Respects `prefers-reduced-motion`. Use on welcome screens and main headers.
   */
  animated?: boolean;
}

// Widths defined so heights land at: xs=22, sm=45, md=60, lg=100, xl=140
const SIZES = { xs: 36, sm: 72, md: 96, lg: 160, xl: 224 } as const;

const SESSION_KEY = "kidgo_logo_animated";

export function KidgoLogo({
  size = "md",
  className = "",
  animated = false,
}: KidgoLogoProps) {
  const w = SIZES[size];
  const h = Math.round(w * (500 / 800));

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
  // kidgo-logo-hoverable: triggers the wink+smile on hover/focus, not just on mount.
  const rootClass = `${className} kidgo-logo-breathe kidgo-logo-hoverable ${
    play ? "kidgo-logo-animate" : ""
  }`.trim();

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 800 500"
      xmlns="http://www.w3.org/2000/svg"
      className={rootClass}
      aria-label="Kidgo"
      role="img"
    >
      {/* Soft shadow so the mark lifts gently off whatever surface it sits on,
          instead of carrying its own hard-edged background box. */}
      <defs>
        <filter id="kidgoLogoShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="5"
            floodColor="var(--kidgo-teal)"
            floodOpacity="0.18"
          />
        </filter>
      </defs>

      <g filter="url(#kidgoLogoShadow)">
        {/* Hexagon -- rounded corners, transparent background, brand tokens */}
        <path
          d="M 422.5 13 L 594 112 Q 616.5 125 616.5 151 L 616.5 349 Q 616.5 375 594 388 L 422.5 487 Q 400 500 377.5 487 L 206 388 Q 183.5 375 183.5 349 L 183.5 151 Q 183.5 125 206 112 L 377.5 13 Q 400 0 422.5 13 Z"
          fill="var(--kidgo-cream)"
        />

        {/* Calendar icon group */}
        <g fill="var(--kidgo-teal)">
          {/* Calendar body */}
          <rect x="355" y="145" width="90" height="75" rx="14" />

          {/* Left clip -- "eye" with cream outline */}
          <rect
            className="kidgo-logo-eye"
            x="370"
            y="135"
            width="10"
            height="20"
            rx="5"
            stroke="var(--kidgo-cream)"
            strokeWidth="3"
          />

          {/* Right clip -- "eye" with cream outline */}
          <rect
            className="kidgo-logo-eye"
            x="420"
            y="135"
            width="10"
            height="20"
            rx="5"
            stroke="var(--kidgo-cream)"
            strokeWidth="3"
          />

          {/* Mouth: checkmark (default, static) */}
          <path
            className="kidgo-logo-mouth-check"
            d="M380 185 l15 15 l25 -25"
            stroke="var(--kidgo-cream)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Mouth: smile (hidden unless animating) */}
          <path
            className="kidgo-logo-mouth-smile"
            d="M378 185 Q400 212 422 185"
            stroke="var(--kidgo-cream)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0"
          />
        </g>

        {/* KIDGO wordmark */}
        <text
          x="400"
          y="355"
          fontFamily="sans-serif"
          fontWeight="bold"
          fontSize="110"
          textAnchor="middle"
          fill="var(--kidgo-teal)"
          style={{ letterSpacing: "2px" }}
        >
          KIDGO
        </text>
      </g>
    </svg>
  );
}
