/**
 * Simple in-memory sliding-window rate limiter.
 * State resets on cold starts — fine for a beta to prevent rapid abuse.
 */

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) windows.delete(key);
  }
}

export function checkRateLimit(
  ip: string,
  { maxRequests = 20, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;
  const entry = windows.get(ip) ?? { timestamps: [] };

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  windows.set(ip, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}
