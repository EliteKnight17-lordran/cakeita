import { z } from 'zod';
import { readWithGemini } from '../src/ai/gemini.js';
import { RateLimiter } from '../src/ai/rateLimit.js';
import { publicMenuSchema } from '../src/domain/schemas.js';

/**
 * POST /api/parse  (Vercel serverless function, optional)
 * Reads a cake request with Gemini. The browser falls back to the offline
 * rule-based reader whenever this route is missing, slow, rate-limited or failing.
 * The photo is processed in memory and never stored.
 */

const limiter = new RateLimiter(10, 60 * 60 * 1000); // 10 requests per hour per IP

const bodySchema = z.object({
  text: z.string().max(2000),
  image: z
    .object({
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z.string().max(2_800_000),
    })
    .nullable()
    .optional(),
  menu: publicMenuSchema,
});

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ ok: false, error: 'AI is not set up. Using the offline reader.' }, 503);

  const rl = limiter.check(clientIp(req));
  if (!rl.allowed) return json({ ok: false, error: 'Too many requests. Try again later.' }, 429, { 'retry-after': String(rl.retryAfterSec) });

  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > 3_500_000) return json({ ok: false, error: 'Photo is too big.' }, 413);

  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ ok: false, error: 'Bad request.' }, 400);
    body = parsed.data;
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  const result = await readWithGemini({
    apiKey,
    model: process.env.GEMINI_MODEL,
    text: body.text,
    image: body.image ?? null,
    menu: body.menu,
    timeoutMs: 12_000,
  });
  if (!result.ok) return json({ ok: false, error: result.error }, 502);
  return json({ ok: true, reading: result.reading });
}

export function GET(): Response {
  return json({ ok: true, ai: !!process.env.GEMINI_API_KEY });
}
