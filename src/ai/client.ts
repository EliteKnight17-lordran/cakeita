import { readRequest, type ParsedRequest } from '../domain/requestReader';
import { aiReadingSchema } from '../domain/schemas';
import type { PublicMenu } from '../domain/types';
import { mergeReading } from './merge';

/**
 * Browser side of request reading.
 * 1. Always run the offline rule-based reader (instant, free, works with no signal).
 * 2. If the optional AI route is set up and allowed, ask it too and merge the results.
 * Any AI problem silently falls back to step 1. The customer never sees a raw error.
 */

export type Reading = ParsedRequest & { summary: string; usedAi: boolean; aiNote: string };

let aiCache: Promise<boolean> | null = null;

export function aiAvailable(): Promise<boolean> {
  aiCache ??= (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch('/api/parse', { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return false;
      const data = (await res.json()) as { ai?: boolean };
      return data.ai === true;
    } catch {
      return false;
    }
  })();
  return aiCache;
}

export async function analyzeRequest(
  text: string,
  menu: PublicMenu,
  opts: { image?: { mimeType: string; base64: string } | null; allowAi: boolean; timeoutMs?: number },
): Promise<Reading> {
  const rule = readRequest(text, menu);
  const offline: Reading = { ...rule, summary: '', usedAi: false, aiNote: '' };
  if (!opts.allowAi || (!text.trim() && !opts.image)) return offline;
  if (!(await aiAvailable())) return { ...offline, aiNote: opts.image ? 'photo-not-read' : '' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 2000), image: opts.image ?? null, menu }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ...offline, aiNote: res.status === 429 ? 'busy' : 'failed' };
    const data = (await res.json()) as { ok?: boolean; reading?: unknown };
    const parsed = aiReadingSchema.safeParse(data.reading);
    if (!data.ok || !parsed.success) return { ...offline, aiNote: 'failed' };
    const merged = mergeReading(rule, parsed.data, menu);
    return { ...merged, usedAi: true, aiNote: '' };
  } catch {
    return { ...offline, aiNote: 'failed' };
  }
}
