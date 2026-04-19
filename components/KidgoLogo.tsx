interface KidgoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 32, md: 48, lg: 80, xl: 120 } as const;

const TEAL = "#5BBAA7";
const CREAM = "#F5F0E8";

// Pointy-top rounded hexagon: flat sides left/right, vertices top & bottom
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
      {/* Teal background */}
      <rect width="100" height="100" fill={TEAL} />

      {/* Cream hexagon */}
      <path d={HEX_PATH} fill={CREAM} />

      {/* Calendar binding clips — drawn before frame so cream fill hides inner overlap */}
      <rect x="37" y="21" width="7" height="10" rx="3" fill={TEAL} />
      <rect x="56" y="21" width="7" height="10" rx="3" fill={TEAL} />

      {/* Calendar frame */}
      <rect x="26" y="27" width="48" height="27" rx="3" fill={CREAM} stroke={TEAL} strokeWidth="1.8" />

      {/* Calendar header strip: rounded-top rect + square fill for flat bottom */}
      <rect x="27.9" y="28.9" width="44.2" height="7" rx="1.5" fill={TEAL} />
      <rect x="27.9" y="33.5" width="44.2" height="4.5" fill={TEAL} />

      {/* Checkmark centered in calendar body */}
      <path
        d="M37,46 L44,53 L63,37"
        stroke={TEAL}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* KIDGO wordmark */}
      <text
        x="50"
        y="75"
        textAnchor="middle"
        fontFamily="Nunito, 'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="13"
        fill={TEAL}
        letterSpacing="2"
      >
        KIDGO
      </text>
    </svg>
  );
}
