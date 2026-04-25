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

// Widths defined so heights land at: xs≈22, sm≈45, md≈60, lg≈100, xl≈140
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
      // sessionStorage unavailable — still play, but only this render
    }
    setPlay(true);
  }, [animated]);

  const rootClass = `${className} ${play ? "kidgo-logo-animate" : ""}`.trim();

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
      {/* Teal background */}
      <rect width="800" height="500" fill="#76C4B9" />

      {/* Hexagon — cream */}
      <path
        d="M400 50 L616.5 175 V425 L400 550 L183.5 425 V175 Z"
        fill="#F9F9E0"
        transform="translate(0, -50)"
      />

      {/* Calendar icon group */}
      <g fill="#76C4B9">
        {/* Calendar body */}
        <rect x="355" y="145" width="90" height="75" rx="10" />

        {/* Left clip — "eye" with cream outline */}
        <rect
          className="kidgo-logo-eye"
          x="370"
          y="135"
          width="10"
          height="20"
          rx="5"
          stroke="#F9F9E0"
          strokeWidth="3"
        />

        {/* Right clip — "eye" with cream outline */}
        <rect
          className="kidgo-logo-eye"
          x="420"
          y="135"
          width="10"
          height="20"
          rx="5"
          stroke="#F9F9E0"
          strokeWidth="3"
        />

        {/* Mouth: checkmark (default, static) */}
        <path
          className="kidgo-logo-mouth-check"
          d="M380 185 l15 15 l25 -25"
          stroke="#F9F9E0"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Mouth: smile (hidden unless animating) */}
        <path
          className="kidgo-logo-mouth-smile"
          d="M378 185 Q400 212 422 185"
          stroke="#F9F9E0"
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
        fill="#76C4B9"
        style={{ letterSpacing: "2px" }}
      >
        KIDGO
      </text>
    </svg>
  );
}
