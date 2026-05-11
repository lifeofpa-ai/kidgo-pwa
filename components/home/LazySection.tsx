"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

interface LazySectionProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  rootMargin?: string;
}

function DefaultSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="h-40 skeleton" />
          <div className="p-4 space-y-2">
            <div className="h-3 skeleton w-1/3" />
            <div className="h-4 skeleton w-full" />
            <div className="h-3 skeleton w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LazySection({
  children,
  fallback,
  className,
  rootMargin = "200px",
}: LazySectionProps) {
  const ref     = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : (fallback ?? <DefaultSkeleton />)}
    </div>
  );
}
