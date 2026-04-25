"use client";

import { useEffect, useState } from "react";

/**
 * Instagram-style heart that bursts in the centre of the parent card.
 * Parent must have position: relative.
 */
export function HeartBurst({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 750);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;
  return (
    <div
      key={trigger}
      className="pointer-events-none absolute inset-0 flex items-center justify-center z-20"
      aria-hidden
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        className="heart-burst"
      >
        <defs>
          <filter id="heartShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
          </filter>
        </defs>
        <path
          d="M48 78 C 16 56, 12 32, 28 22 C 38 16, 46 22, 48 30 C 50 22, 58 16, 68 22 C 84 32, 80 56, 48 78 Z"
          fill="#ef4444"
          filter="url(#heartShadow)"
        />
      </svg>
    </div>
  );
}
