interface KidgoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 32, md: 48, lg: 80, xl: 120 } as const;

export function KidgoLogo({ size = "md", className = "" }: KidgoLogoProps) {
  const w = SIZES[size];
  const h = Math.round(w * (500 / 800));

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 800 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kidgo"
      role="img"
    >
      {/* Background */}
      <rect width="800" height="500" fill="#76C4B9" />

      {/* Hexagon body — cream fill */}
      <path
        d="M400 50 L616.5 175 V425 L400 550 L183.5 425 V175 Z"
        fill="#F9F9E0"
        transform="translate(0, -50)"
      />

      {/* Calendar body — outline only (cream shows through), teal border */}
      <rect
        x="352"
        y="148"
        width="96"
        height="78"
        rx="10"
        fill="#F9F9E0"
        stroke="#76C4B9"
        strokeWidth="6"
      />

      {/* Calendar clip left — teal pill with white outline (the "eye" / Bügel) */}
      <rect
        x="371"
        y="130"
        width="16"
        height="28"
        rx="8"
        fill="#76C4B9"
        stroke="#F9F9E0"
        strokeWidth="4"
      />

      {/* Calendar clip right */}
      <rect
        x="413"
        y="130"
        width="16"
        height="28"
        rx="8"
        fill="#76C4B9"
        stroke="#F9F9E0"
        strokeWidth="4"
      />

      {/* Checkmark — big and thick */}
      <path
        d="M370 190 l20 20 l40 -38"
        stroke="#76C4B9"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

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
