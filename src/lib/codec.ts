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

export type DecodeResult<T> = { ok: true; value: T } | { ok: false; error: string };

export async function decodePayload<T>(code: string, schema: ZodType<T>): Promise<DecodeResult<T>> {
  try {
    if (!code || code.length > MAX_ENCODED_LENGTH) return { ok: false, error: 'Link is empty or too long.' };
    const kind = code[0];
    const body = fromBase64Url(code.slice(1));
    let jsonBytes: Uint8Array;
    if (kind === 'z') {
      if (!canCompress()) return { ok: false, error: 'This browser cannot open compressed links. Please update it.' };
      jsonBytes = await pipe(body, new DecompressionStream('deflate-raw'));
    } else if (kind === 'j') jsonBytes = body;
    else return { ok: false, error: 'Unknown link format.' };
    if (jsonBytes.length > 64_000) return { ok: false, error: 'Link content is too big.' };
    const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(jsonBytes)));
    if (!parsed.success) return { ok: false, error: 'This link is incomplete or was changed.' };
    return { ok: true, value: parsed.data };
  } catch {
    return { ok: false, error: 'This link is broken. Ask for a new one.' };
  }
}
