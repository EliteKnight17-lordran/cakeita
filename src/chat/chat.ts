import { useCallback, useEffect, useState } from 'react';

/**
 * In-app chat on one cake request (customer <-> baker), so neither side has to dig through Messenger.
 *   cloud: Firestore chats/{orderId}/messages (rules in firestore.rules). The order id is the secret.
 *   local: this browser only (demo on one laptop; other tabs follow through the storage event).
 *   auto:  a labeled sample bakery answers by itself, like its quotes do.
 */
export interface ChatMsg {
  id: string;
  from: 'customer' | 'baker';
  text: string;
  at: string;
}
export type ChatMode = 'cloud' | 'local' | 'auto';
export const MAX_CHAT = 500;

const key = (id: string) => `cakeita.chat.${id}`;
const local = new Map<string, Set<() => void>>();

function readLocal(id: string): ChatMsg[] {
  try {
    const raw = localStorage.getItem(key(id));
    const list = raw ? (JSON.parse(raw) as ChatMsg[]) : [];
    return Array.isArray(list) ? list.filter((m) => m && typeof m.text === 'string' && (m.from === 'customer' || m.from === 'baker')) : [];
  } catch {
    return [];
  }
}

function writeLocal(id: string, m: ChatMsg) {
  try {
    localStorage.setItem(key(id), JSON.stringify([...readLocal(id), m].slice(-100)));
  } catch {
    /* storage full or blocked */
  }
  local.get(id)?.forEach((f) => f());
}

function msgId(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return `m${Date.now().toString(36)}${Array.from(a, (b) => (b % 36).toString(36)).join('')}`;
}

/** What a sample bakery says back (it's a demo, and says so). */
export function autoReply(text: string, lang: 'tl' | 'en'): string {
  const t = text.toLowerCase();
  const tl = lang === 'tl';
  if (/deliver|lalamove|grab|rider/.test(t)) return tl ? 'Puwede po! Kayo ang magbo-book ng rider o ako, kayo po ang magbabayad ng delivery fee. (Sample bakery lang ito para sa demo.)' : 'Sure! You or I can book the rider; you pay the delivery fee. (This is a sample bakery for the demo.)';
  if (/pickup|kunin|oras|time|ready|handa/.test(t)) return tl ? 'Sasabihan ko po kayo dito pag handa na, may picture pa. (Sample bakery lang ito para sa demo.)' : "I'll tell you here when it's ready, with a photo. (This is a sample bakery for the demo.)";
  if (/kulay|color|design|disenyo|palit|change/.test(t)) return tl ? 'Kaya po! Sabihin lang kung ano ang gusto ninyong baguhin at ia-update ko ang quote. (Sample bakery lang ito para sa demo.)' : "Can do! Tell me what to change and I'll update the quote. (This is a sample bakery for the demo.)";
  return tl ? 'Salamat po sa message! Sasagot ang totoong baker dito mismo. (Sample bakery lang ito para sa demo.)' : 'Thanks for your message! A real baker answers right here. (This is a sample bakery for the demo.)';
}

export function useChat(orderId: string, mode: ChatMode | null, bakerUid: string | null, lang: 'tl' | 'en') {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mode || !orderId) return;
    if (mode !== 'cloud') {
      const load = () => setMsgs(readLocal(orderId));
      load();
      const set = local.get(orderId) ?? new Set();
      set.add(load);
      local.set(orderId, set);
      const onStorage = (e: StorageEvent) => e.key === key(orderId) && load();
      window.addEventListener('storage', onStorage);
      return () => {
        set.delete(load);
        window.removeEventListener('storage', onStorage);
      };
    }
    let alive = true;
    let stop: (() => void) | null = null;
    import('../cloud/data')
      .then((m) => m.listenChat(orderId, (list) => alive && setMsgs(list), () => alive && setError(true)))
      .then((off) => (alive ? (stop = off) : off()))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
      stop?.();
    };
  }, [orderId, mode]);

  const send = useCallback(
    async (from: ChatMsg['from'], text: string): Promise<boolean> => {
      const clean = text.trim().slice(0, MAX_CHAT);
      if (!clean || !mode) return false;
      const m: ChatMsg = { id: msgId(), from, text: clean, at: new Date().toISOString() };
      if (mode === 'cloud') {
        if (!bakerUid) return false;
        try {
          const { sendChat } = await import('../cloud/data');
          await sendChat(orderId, bakerUid, m);
          setError(false);
          return true;
        } catch {
          setError(true);
          return false;
        }
      }
      writeLocal(orderId, m);
      if (mode === 'auto' && from === 'customer') {
        window.setTimeout(() => writeLocal(orderId, { id: msgId(), from: 'baker', text: autoReply(clean, lang), at: new Date().toISOString() }), 1500);
      }
      return true;
    },
    [orderId, mode, bakerUid, lang],
  );

  return { msgs, send, error };
}
