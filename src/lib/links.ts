import { toPublicMenu } from '../domain/pricing';
import type { ConfirmLink, QuoteLink } from '../domain/schemas';
import type { Bakery, CakeRequest } from '../domain/types';
import { encodePayload } from './codec';

/** Base URL of the running app, e.g. https://cakeita.vercel.app/ */
export function appBase(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

export async function menuLink(bakery: Bakery): Promise<string> {
  if (bakery.isSample && bakery.slug === 'sample') return `${appBase()}#/b/sample`;
  return `${appBase()}#/b/${encodeURIComponent(bakery.slug)}?m=${await encodePayload(toPublicMenu(bakery))}`;
}

export async function requestLink(req: CakeRequest): Promise<string> {
  return `${appBase()}#/baker/import?r=${await encodePayload(req)}`;
}

export async function quoteLink(q: QuoteLink): Promise<string> {
  return `${appBase()}#/o/${encodeURIComponent(q.orderId)}?q=${await encodePayload(q)}`;
}

export async function confirmLink(c: ConfirmLink): Promise<string> {
  return `${appBase()}#/baker/import?c=${await encodePayload(c)}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'failed' | 'cancelled';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Use the phone's share sheet (Messenger, Viber, SMS) when available, else copy. */
export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  const full = `${data.text}\n${data.url}`;
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: data.title, text: data.text, url: data.url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(full)) ? 'copied' : 'failed';
}

/** If the baker's contact is a Messenger link, return a safe https URL to open it. */
export function messengerUrl(contact: string): string | null {
  const m = /(?:https?:\/\/)?(?:www\.)?(m\.me|messenger\.com\/t|facebook\.com)\/([A-Za-z0-9.\-_]{2,80})/i.exec(contact);
  if (!m) return null;
  return `https://m.me/${m[2]}`;
}

/** Read a query param from the hash route: #/b/x?m=CODE */
export function hashParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}
