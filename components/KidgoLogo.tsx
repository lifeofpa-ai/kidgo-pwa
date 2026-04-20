interface KidgoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = { sm: 32, md: 48, lg: 80, xl: 120 } as const;

const TEAL = "#5BBAA7";
const CREAM = "#F5F0E8";

// Flat-top rounded hexagon (wider than tall), viewBox 0 0 100 100
// Regular hexagon: R=45, center(50,50)
// Vertices: Left(5,50), TL(27.5,11), TR(72.5,11), Right(95,50), BR(72.5,89), BL(27.5,89)
// Corner radius ~9 units — smoothed with quadratic beziers at each vertex
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
      {/*
        Cream hexagon with a teal stroke so it's visible on any background.
        On teal backgrounds (welcome screen) the stroke blends in and only
        the cream shape is visible — matching the reference logo exactly.
      */}
      <path d={HEX_PATH} fill={CREAM} stroke={TEAL} strokeWidth="2.5" />

      {/* Calendar binding clips — two rounded tabs at top of calendar body */}
      <rect x="37" y="17" width="9" height="12" rx="3" fill={TEAL} />
      <rect x="54" y="17" width="9" height="12" rx="3" fill={TEAL} />

      {/* Calendar outer frame: cream fill, teal outline */}
      <rect x="27" y="25" width="46" height="28" rx="3.5" fill={CREAM} stroke={TEAL} strokeWidth="2" />

      {/* Calendar header strip — solid teal, rounded top / flat bottom */}
      <rect x="28" y="26" width="44" height="7"  rx="2"   fill={TEAL} />
      <rect x="28" y="31" width="44" height="4.5"           fill={TEAL} />

      {/* Checkmark centred in the lower calendar body */}
      <path
        d="M36,44 L43,51 L64,34"
        stroke={TEAL}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* KIDGO wordmark */}
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="Nunito, 'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="14"
        fill={TEAL}
        letterSpacing="2"
      >
        KIDGO
      </text>
    </svg>
  );
}
