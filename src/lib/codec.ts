import type { ZodType } from 'zod';

/**
 * Pack small JSON payloads into URL-safe strings so requests and quotes can travel
 * through Messenger as links. No server stores them. Format:
 *   "z" + base64url(deflate-raw(json))   when CompressionStream exists
 *   "j" + base64url(json)                fallback
 */

export const MAX_ENCODED_LENGTH = 12_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const res = new Response(blob.stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encodePayload(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  if (canCompress()) {
    try {
      return 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through */
    }
  }
  return 'j' + toBase64Url(json);
}

export type LinkError = 'empty' | 'unsupported' | 'format' | 'too-big' | 'changed' | 'broken';
export type DecodeResult<T> = { ok: true; value: T } | { ok: false; error: LinkError };

/** Friendly, bilingual text for a link problem. */
export function linkErrorText(e: LinkError, tx: (en: string, tl: string) => string): string {
  switch (e) {
    case 'unsupported':
      return tx('This browser is too old to open the link. Please update it or use Chrome.', 'Luma na ang browser para sa link. Paki-update o gamitin ang Chrome.');
    case 'changed':
      return tx('This link is incomplete or was changed.', 'Kulang o binago ang link na ito.');
    default:
      return tx('This link is broken. Ask for a new one.', 'Sira ang link na ito. Humingi ng bago.');
  }
}

export async function decodePayload<T>(code: string, schema: ZodType<T>): Promise<DecodeResult<T>> {
  try {
    if (!code || code.length > MAX_ENCODED_LENGTH) return { ok: false, error: 'empty' };
    const kind = code[0];
    const body = fromBase64Url(code.slice(1));
    let jsonBytes: Uint8Array;
    if (kind === 'z') {
      if (!canCompress()) return { ok: false, error: 'unsupported' };
      jsonBytes = await pipe(body, new DecompressionStream('deflate-raw'));
    } else if (kind === 'j') jsonBytes = body;
    else return { ok: false, error: 'format' };
    if (jsonBytes.length > 64_000) return { ok: false, error: 'too-big' };
    const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(jsonBytes)));
    if (!parsed.success) return { ok: false, error: 'changed' };
    return { ok: true, value: parsed.data };
  } catch {
    return { ok: false, error: 'broken' };
  }
}
