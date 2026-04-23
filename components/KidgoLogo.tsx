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
      <rect width="800" height="500" fill="#76C4B9" />

      <path
        d="M400 50 L616.5 175 V425 L400 550 L183.5 425 V175 Z"
        fill="#F9F9E0"
        transform="translate(0, -50)"
      />

      <g fill="#76C4B9">
        <rect x="355" y="145" width="90" height="75" rx="10" />
        <rect x="370" y="135" width="10" height="20" rx="5" />
        <rect x="420" y="135" width="10" height="20" rx="5" />
        <path
          d="M380 185 l15 15 l25 -25"
          stroke="#F9F9E0"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

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
