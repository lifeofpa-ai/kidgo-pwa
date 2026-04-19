interface KidgoLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: 40, md: 56, lg: 100 } as const;

const TEAL = "#5BBAA7";
const BG = "#F5F0E8";

// Rounded regular hexagon path (pointy top, viewBox 0 0 100 100)
const HEX_PATH =
  "M55.2,10.0 L82.0,25.5 Q87.2,28.5 87.2,34.5 " +
  "L87.2,65.5 Q87.2,71.5 82.0,74.5 " +
  "L55.2,90.0 Q50,93 44.8,90.0 " +
  "L18.0,74.5 Q12.8,71.5 12.8,65.5 " +
  "L12.8,34.5 Q12.8,28.5 18.0,25.5 " +
  "L44.8,10.0 Q50,7 55.2,10.0 Z";

export function KidgoLogo({ size = "md", className = "" }: KidgoLogoProps) {
  const px = SIZES[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kidgo"
      role="img"
    >
      {/* Hexagon background */}
      <path d={HEX_PATH} fill={BG} stroke={TEAL} strokeWidth="3" />

      {/* Calendar clips (binding tabs at top) */}
      <rect x="39" y="22" width="5" height="10" rx="2" fill={TEAL} />
      <rect x="56" y="22" width="5" height="10" rx="2" fill={TEAL} />

      {/* Calendar outer frame */}
      <rect x="32" y="28" width="36" height="29" rx="3" fill={BG} stroke={TEAL} strokeWidth="1.8" />

      {/* Calendar header strip (rounded-top, flat-bottom via two overlapping rects) */}
      <rect x="33" y="29" width="34" height="6" rx="2" fill={TEAL} />
      <rect x="33" y="33" width="34" height="4" fill={TEAL} />

      {/* Checkmark inside calendar body */}
      <path
        d="M40,47 L46,53 L60,39"
        stroke={TEAL}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* KIDGO wordmark */}
      <text
        x="50"
        y="75"
        textAnchor="middle"
        fontFamily="Nunito, 'Helvetica Neue', Arial, sans-serif"
        fontWeight="800"
        fontSize="13"
        fill={TEAL}
        letterSpacing="2"
      >
        KIDGO
      </text>
    </svg>
  );
}
