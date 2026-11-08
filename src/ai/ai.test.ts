import { describe, expect, it, vi } from 'vitest';
import { toPublicMenu } from '../domain/pricing';
import { readRequest } from '../domain/requestReader';
import { aiReadingSchema, cakeRequestSchema, confirmLinkSchema } from '../domain/schemas';
import { createBakeryFromStarter, createSampleBakery } from '../domain/starterMenus';
import { decodePayload, encodePayload } from '../lib/codec';
import { buildPrompt, DEFAULT_GEMINI_MODELS, extractJson, modelList, readWithGemini } from './gemini';
import { mergeReading } from './merge';
import { RateLimiter } from './rateLimit';

const TODAY = new Date(2026, 10, 6);
const menu = toPublicMenu(createSampleBakery(TODAY), TODAY);

const reply = (text: string, status = 200) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status, headers: { 'content-type': 'application/json' } });

describe('AI output validation', () => {
  it('has no price field, so AI can never set a price', () => {
    const parsed = aiReadingSchema.parse({ componentIds: ['dc-drip'], price: 99999, suggestedPrice: 1 });
    expect('price' in parsed).toBe(false);
    expect('suggestedPrice' in parsed).toBe(false);
  });
  it('rejects wrong types', () => {
    expect(aiReadingSchema.safeParse({ componentIds: 'dc-drip' }).success).toBe(false);
    expect(aiReadingSchema.safeParse({ servings: -5 }).success).toBe(false);
    expect(aiReadingSchema.safeParse({ confidence: 7 }).success).toBe(false);
  });
  it('extracts JSON from fenced replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson('sorry, I cannot')).toThrow();
  });
  it('prompt lists only offered menu ids and forbids prices', () => {
    const home = toPublicMenu(createBakeryFromStarter('home', { name: 'H' }), TODAY);
    const p = buildPrompt(home, 'pink cake', false);
    expect(p).toContain('dc-drip');
    expect(p).toMatch(/Never write a price/);
    expect(p).not.toContain('"cv-fondant"'); // not offered by this baker
    expect(p).not.toMatch(/costPerUnit|targetMargin|laborRate/);
  });
});

describe('readWithGemini', () => {
  it('returns a validated reading', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(JSON.stringify({ componentIds: ['dc-drip'], colors: ['pink'], confidence: 0.8 })));
    const r = await readWithGemini({ apiKey: 'k', text: 'pink drip', menu, fetchFn });
    expect(r.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain(':generateContent');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'k' });
  });
  it('retries once on invalid JSON, then gives up', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply('not json at all'));
    const r = await readWithGemini({ apiKey: 'k', text: 'x', menu, fetchFn });
    expect(r.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('succeeds on the retry', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(reply('{bad')).mockResolvedValueOnce(reply('{"componentIds":[]}'));
    const r = await readWithGemini({ apiKey: 'k', text: 'x', menu, fetchFn });
    expect(r).toMatchObject({ ok: true, attempts: 2 });
  });
  it('does not retry a bad API key (400)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
    const r = await readWithGemini({ apiKey: 'bad', text: 'x', menu, fetchFn });
    expect(r).toMatchObject({ ok: false, error: 'Gemini HTTP 400' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('moves to the next model when one is retired, gated or out of quota', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockResolvedValueOnce(reply('{"componentIds":[]}'));
    const r = await readWithGemini({ apiKey: 'k', text: 'x', menu, fetchFn });
    expect(r).toMatchObject({ ok: true, model: DEFAULT_GEMINI_MODELS[2] });
    const urls = fetchFn.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain(DEFAULT_GEMINI_MODELS[0]);
    expect(urls[1]).toContain(DEFAULT_GEMINI_MODELS[1]);
  });
  it('GEMINI_MODEL can list its own models, comma-separated', () => {
    expect(modelList(' gemini-x , gemini-y ')).toEqual(['gemini-x', 'gemini-y']);
    expect(modelList('')).toEqual(DEFAULT_GEMINI_MODELS);
    expect(modelList('bad/../name')).toEqual(['bad..name']);
  });
  it('times out slow calls', async () => {
    const fetchFn = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const r = await readWithGemini({ apiKey: 'k', text: 'x', menu, fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 10 });
    expect(r).toMatchObject({ ok: false, error: 'AI took too long' });
  });
});

describe('mergeReading', () => {
  it('drops unknown or miscategorized ids from the AI', () => {
    const rule = readRequest('cake for 10 people', menu, TODAY);
    const ai = aiReadingSchema.parse({ componentIds: ['dc-drip', 'evil-id'], flavorId: 'dc-drip', colors: ['pink', 'neon plaid'] });
    const m = mergeReading(rule, ai, menu);
    expect(m.componentIds).toEqual(['dc-drip']);
    expect(m.flavorId).toBeNull();
    expect(m.droppedIds).toEqual(expect.arrayContaining(['evil-id', 'dc-drip']));
    expect(m.colors.map((c) => c.name)).toEqual(['pink']);
  });
  it('keeps the numbers the customer typed over AI numbers', () => {
    const rule = readRequest('budget 2k for 20 pax', menu, TODAY);
    const ai = aiReadingSchema.parse({ budget: 5000, servings: 50 });
    const m = mergeReading(rule, ai, menu);
    expect(m.budget).toBe(2000);
    expect(m.servings).toBe(20);
  });
  it('genericizes a character the AI saw in a photo', () => {
    const rule = readRequest('', menu, TODAY);
    const ai = aiReadingSchema.parse({ theme: 'Hello Kitty', summaryTaglish: 'Hello Kitty cake' });
    const m = mergeReading(rule, ai, menu);
    expect(m.theme).toBe('cute kitten with a bow');
    expect(m.licensedNote).toMatch(/licensed/);
    expect(m.summary).toBe('');
  });
});

describe('RateLimiter', () => {
  it('allows N per window per key', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.check('a', 0).allowed).toBe(true);
    expect(rl.check('a', 1).allowed).toBe(true);
    expect(rl.check('a', 2)).toMatchObject({ allowed: false, retryAfterSec: 1 });
    expect(rl.check('b', 2).allowed).toBe(true);
    expect(rl.check('a', 1001).allowed).toBe(true);
  });
});

describe('share link codec', () => {
  it('round-trips a request and validates it', async () => {
    const req = {
      id: 'r1', bakerySlug: 'sample', createdAt: new Date().toISOString(), customer: { name: 'Ana', contact: '0917 000 0000' },
      occasion: 'Birthday', eventDate: '2026-12-12', servings: 30, budget: 2500, description: 'pink 2 tier', tier: 'classic' as const,
      selection: { baseCakeId: 't2-6-8', componentIds: ['fl-ube', 'cv-buttercream'] }, look: { colors: ['#f4a7c0'], textOnCake: 'Hi', candles: 7 },
      theme: '', licensedNote: '', unavailable: [], estimate: 2500, hasInspoPhoto: false, lang: 'tl' as const,
    };
    const code = await encodePayload(req);
    expect(code.length).toBeLessThan(1200);
    const back = await decodePayload(code, cakeRequestSchema);
    expect(back).toEqual({ ok: true, value: req });
  });
  it('the whole public menu fits in a link', async () => {
    const code = await encodePayload(menu);
    expect(code.length).toBeLessThan(4000);
  });
  it('rejects tampered or junk links without throwing', async () => {
    const code = await encodePayload({ v: 1, orderId: 'x', price: -5, confirmedAt: '', note: '', customerName: '' });
    expect((await decodePayload(code, confirmLinkSchema)).ok).toBe(false);
    expect((await decodePayload('zzzz', confirmLinkSchema)).ok).toBe(false);
    expect((await decodePayload('', confirmLinkSchema)).ok).toBe(false);
    expect((await decodePayload('q123', confirmLinkSchema)).ok).toBe(false);
    expect((await decodePayload('z' + 'A'.repeat(20000), confirmLinkSchema)).ok).toBe(false);
  });
});
