interface KidgoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 32, md: 48, lg: 80, xl: 120 } as const;

const TEAL = "#5BBAA7";
const CREAM = "#F5F0E8";

const HEX_PATH =
  "M9.5,42.2 L23,18.8 Q27.5,11 36.5,11 " +
  "L63.5,11 Q72.5,11 77,18.8 " +
  "L90.5,42.2 Q95,50 90.5,57.8 " +
  "L77,81.2 Q72.5,89 63.5,89 " +
  "L36.5,89 Q27.5,89 23,81.2 " +
  "L9.5,57.8 Q5,50 9.5,42.2 Z";

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

      {/* Binding clips — drawn before calendar; calendar's cream fill masks the lower half,
          leaving only the protruding rounded tops visible as U-shaped rings */}
      <rect x="36" y="11" width="8" height="12" rx="4" fill={TEAL} />
      <rect x="56" y="11" width="8" height="12" rx="4" fill={TEAL} />

      {/* Calendar frame — outline only (cream fill masks clip lower halves) */}
      <rect
        x="28"
        y="19"
        width="44"
        height="30"
        rx="4"
        fill={CREAM}
        stroke={TEAL}
        strokeWidth="2"
      />

      {/* Header separator line */}
      <line x1="30" y1="28" x2="70" y2="28" stroke={TEAL} strokeWidth="1.5" />

      {/* Checkmark — thick, large, centered in calendar body */}
      <path
        d="M35,39 L44,47 L65,32"
        stroke={TEAL}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* KIDGO wordmark — bold, close to calendar icon */}
      <text
        x="50"
        y="71"
        textAnchor="middle"
        fontFamily="Nunito, 'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="22"
        fill={TEAL}
        letterSpacing="2"
      >
        KIDGO
      </text>
    </svg>
  );
}
