import { aiReadingSchema, type AiReading } from '../domain/schemas';
import type { PublicMenu } from '../domain/types';

/**
 * Server-side helper that asks Gemini to READ a cake request (text and/or inspo photo)
 * and pick parts from the baker's menu. It never prices anything.
 *
 * Kept free of Node/Vercel APIs so it can be unit-tested with a fake fetch.
 */

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export interface GeminiInput {
  apiKey: string;
  model?: string;
  text: string;
  image?: { mimeType: string; base64: string } | null;
  menu: PublicMenu;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export type GeminiResult = { ok: true; reading: AiReading; attempts: number } | { ok: false; error: string; attempts: number };

export function buildPrompt(menu: PublicMenu, text: string, hasImage: boolean): string {
  const parts = menu.components.map((c) => ({ id: c.id, name: c.name, category: c.category }));
  const sizes = menu.baseCakes.map((b) => ({ id: b.id, name: b.name, tiers: b.tiers.length, servings: b.servings }));
  return [
    'You read custom cake requests for a Filipino home bakery. Messages may be English, Tagalog or Taglish.',
    'Return ONLY a JSON object with these keys:',
    '{"baseCakeId": string|null, "flavorId": string|null, "coveringId": string|null, "componentIds": string[],',
    ' "detectedButUnavailable": string[], "colors": string[], "textOnCake": string, "occasion": string,',
    ' "servings": number|null, "budget": number|null, "tiers": number|null, "theme": string,',
    ' "summaryTaglish": string, "confidence": number}',
    'Rules:',
    '- Use ONLY ids from the lists below. If something is wanted but not in the list, put a short name in detectedButUnavailable.',
    '- Never write a price. "budget" is only the amount the customer wrote, in pesos (2k = 2000). Otherwise null.',
    '- Copy numbers exactly as written. Never guess servings or budget.',
    '- Do not name trademarked characters (Disney, Marvel, Sanrio, etc). Describe a generic theme instead.',
    '- colors: simple English color names like "pink", "gold", "baby blue".',
    '- summaryTaglish: one or two short friendly sentences in Taglish describing the cake.',
    hasImage ? '- An inspiration photo is attached. Describe what you SEE in it using the menu ids.' : '',
    `Cake sizes: ${JSON.stringify(sizes)}`,
    `Parts: ${JSON.stringify(parts)}`,
    `Max tiers this baker makes: ${menu.maxTiers}. Things the baker does not do: ${JSON.stringify(menu.cannotDo)}`,
    `Customer message: """${text.slice(0, 1500)}"""`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Pull the first JSON object out of a model reply (handles ```json fences). */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function readWithGemini(input: GeminiInput): Promise<GeminiResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const model = (input.model || DEFAULT_GEMINI_MODEL).replace(/[^a-zA-Z0-9.\-_]/g, '');
  const url = `${GEMINI_ENDPOINT}/${model}:generateContent`;
  const prompt = buildPrompt(input.menu, input.text, !!input.image);
  const contentParts: unknown[] = [{ text: prompt }];
  if (input.image) contentParts.push({ inline_data: { mime_type: input.image.mimeType, data: input.image.base64 } });
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: contentParts }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 800 },
  });

  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), input.timeoutMs ?? 12_000);
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': input.apiKey },
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        lastError = `Gemini HTTP ${res.status}`;
        // 4xx (bad key, quota) won't fix itself on retry.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        continue;
      }
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      const parsed = aiReadingSchema.safeParse(extractJson(text));
      if (parsed.success) return { ok: true, reading: parsed.data, attempts: attempt };
      lastError = 'AI reply did not match the expected format';
    } catch (e) {
      lastError = (e as Error).name === 'AbortError' ? 'AI took too long' : 'AI reply was not valid JSON';
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastError, attempts: 2 };
}
