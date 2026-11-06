import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPublicMenu } from '../domain/pricing';
import { createSampleBakery } from '../domain/starterMenus';
import { GET, POST } from '../../api/parse';

const menu = toPublicMenu(createSampleBakery());
const req = (body: unknown, ip = '1.1.1.1') =>
  new Request('http://x/api/parse', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('/api/parse', () => {
  it('says AI is off when no key is set (app then uses the offline reader)', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await (await GET()).json()).toEqual({ ok: true, ai: false });
    expect((await POST(req({ text: 'x', menu }))).status).toBe(503);
  });

  it('rejects bad bodies', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k');
    expect((await POST(req({ text: 5, menu }, '2.2.2.2'))).status).toBe(400);
    expect((await POST(req({ text: 'x', menu: { v: 2 } }, '2.2.2.3'))).status).toBe(400);
  });

  it('returns a validated reading and never a price', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"componentIds":["dc-drip"],"price":1}' }] } }] }), { status: 200 }),
      ),
    );
    const res = await POST(req({ text: 'pink drip cake', menu }, '3.3.3.3'));
    const data = (await res.json()) as { ok: boolean; reading: Record<string, unknown> };
    expect(res.status).toBe(200);
    expect(data.reading.componentIds).toEqual(['dc-drip']);
    expect('price' in data.reading).toBe(false);
  });

  it('rate-limits to 10 per hour per IP', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k');
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await POST(req({ text: 5, menu }, '9.9.9.9'))).status;
    expect(last).toBe(429);
  });
});

describe('Vercel function imports', () => {
  // Vercel runs api/ as plain Node ESM, which needs ".js" on every relative import.
  it('uses .js extensions on the whole server import chain', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['../../api/parse.ts', './gemini.ts', './rateLimit.ts', '../domain/schemas.ts']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      const rel = [...src.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]!);
      for (const spec of rel) expect(spec, `${f}: ${spec}`).toMatch(/\.js$/);
    }
  });
});
