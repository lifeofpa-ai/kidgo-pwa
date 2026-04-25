"use client";

import { usePathname } from "next/navigation";
import { SwipeBack } from "./SwipeBack";

/**
 * Enables swipe-back only on sub-pages (not home).
 * Pages: /events/*, /explore, /map, /bookmarks, /history, /dashboard, /badges
 */
export function SwipeBackGate() {
  const pathname = usePathname() ?? "/";
  const root = pathname === "/" || pathname === "/login";
  return <SwipeBack enabled={!root} />;
}
