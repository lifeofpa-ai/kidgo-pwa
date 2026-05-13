"use client";

function Box({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div
      className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden"
      aria-hidden="true"
    >
      <Box className="h-48 rounded-none" />
      <div className="p-4 space-y-3">
        <Box className="h-3.5 w-2/3" />
        <Box className="h-5 w-full" />
        <Box className="h-3.5 w-1/2" />
        <Box className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div
      className="flex gap-3 p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]"
      aria-hidden="true"
    >
      <Box className="w-16 h-16 flex-shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2 py-1">
        <Box className="h-3.5 w-3/4" />
        <Box className="h-4 w-full" />
        <Box className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]" aria-hidden="true">
      <Box className="h-64 rounded-none" />
      <div className="p-5 space-y-4 max-w-2xl mx-auto pt-6">
        <Box className="h-4 w-1/3 rounded-full" />
        <Box className="h-7 w-4/5" />
        <div className="flex gap-2">
          <Box className="h-7 w-24 rounded-full" />
          <Box className="h-7 w-20 rounded-full" />
        </div>
        <div className="space-y-2 pt-2">
          <Box className="h-3.5 w-full" />
          <Box className="h-3.5 w-full" />
          <Box className="h-3.5 w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Box className="h-16 rounded-2xl" />
          <Box className="h-16 rounded-2xl" />
          <Box className="h-16 rounded-2xl" />
          <Box className="h-16 rounded-2xl" />
        </div>
        <Box className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Wird geladen">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-enter" style={{ animationDelay: `${i * 120}ms` }}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}
