interface KidgoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 32, md: 48, lg: 80, xl: 120 } as const;

const TEAL = "#5BBAA7";
const CREAM = "#F5F0E8";

// Flat-top rounded hexagon (flat edges top & bottom, vertices at left & right).
// ViewBox 0 0 100 100. Ideal vertices: L(5,50) TL(27.5,11) TR(72.5,11)
//   R(95,50) BR(72.5,89) BL(27.5,89). Corner radius ≈ 9 units.
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

      {/* Calendar binding clips — drawn before frame so cream fill masks inner overlap,
          leaving only the tabs above the frame visible against the cream hex */}
      <rect x="39" y="28" width="7" height="10" rx="3.5" fill={TEAL} />
      <rect x="54" y="28" width="7" height="10" rx="3.5" fill={TEAL} />

      {/* Calendar frame */}
      <rect x="27" y="32" width="46" height="18" rx="3" fill={CREAM} stroke={TEAL} strokeWidth="1.8" />

      {/* Calendar header strip: rounded-top rect + square fill to close flat bottom */}
      <rect x="28.9" y="33.9" width="42.2" height="6" rx="1.5" fill={TEAL} />
      <rect x="28.9" y="37.5" width="42.2" height="3" fill={TEAL} />

      {/* Checkmark in calendar body (body runs y ≈ 40.5–50) */}
      <path
        d="M34,45 L41,49 L64,42"
        stroke={TEAL}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* KIDGO wordmark — large, bold, same teal as calendar */}
      <text
        x="50"
        y="67"
        textAnchor="middle"
        fontFamily="Nunito, 'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="19"
        fill={TEAL}
        letterSpacing="2.5"
      >
        KIDGO
      </text>
    </svg>
  );
}
