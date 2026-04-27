import type { ReactNode } from "react";

interface HexIconProps {
  size?: number;
  children: ReactNode;
  className?: string;
}

export const HEX_BG = "#F5F0E8";
export const HEX_FG = "#5BBAA7";

export function HexIcon({ size = 28, children, className }: HexIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill={HEX_BG} />
      <g fill={HEX_FG}>{children}</g>
    </svg>
  );
}
