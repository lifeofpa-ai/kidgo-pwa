// In-memory sliding-window rate limiter.
//
// Caveat: state lives in the Node process. On serverless platforms (Vercel)
// it is per-instance and resets on cold start, so it is best-effort. For a
// hardened limit across instances, swap to Upstash Redis.

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - options.windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + options.windowMs - now),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: options.limit - bucket.timestamps.length,
    retryAfterMs: 0,
  };
}

export function clientIp(req: { headers: { get: (k: string) => string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
