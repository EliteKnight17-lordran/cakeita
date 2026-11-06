/**
 * Small fixed-window rate limiter to protect the free Gemini quota.
 * In-memory, so on serverless it is per warm instance: good enough for a demo,
 * documented as a known limit (use Upstash/Vercel KV for production).
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSec: number } {
    if (this.hits.size > 5000) this.prune(now);
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterSec: 0 };
    }
    if (cur.count >= this.limit) {
      return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
    }
    cur.count += 1;
    return { allowed: true, remaining: this.limit - cur.count, retryAfterSec: 0 };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
