interface KidgoLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Widths defined so heights land at: xs≈22, sm≈45, md≈60, lg≈100, xl≈140
const SIZES = { xs: 36, sm: 72, md: 96, lg: 160, xl: 224 } as const;

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

        {/* Left clip — "eye" with white outline */}
        <rect
          x="370"
          y="135"
          width="10"
          height="20"
          rx="5"
          stroke="#F9F9E0"
          strokeWidth="3"
        />

        {/* Right clip — "eye" with white outline */}
        <rect
          x="420"
          y="135"
          width="10"
          height="20"
          rx="5"
          stroke="#F9F9E0"
          strokeWidth="3"
        />

        {/* Checkmark inside calendar */}
        <path
          d="M380 185 l15 15 l25 -25"
          stroke="#F9F9E0"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
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
