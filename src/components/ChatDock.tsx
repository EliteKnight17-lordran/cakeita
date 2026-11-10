import { useEffect, useMemo, useState } from 'react';
import { entryKey, quickReplies, rememberChat, savedChats, seenAt, useChat, useChatIndexVersion, type ChatEntry } from '../chat/chat';
import { currentUid } from '../cloud/account';
import { cloudEnabled } from '../cloud/config';
import { useDb } from '../data/store';
import { messengerUrl } from '../lib/links';
import { usePrefs, useTx } from '../lib/prefs';
import { IconArrow, IconChat } from './icons';
import { OrderChat } from './OrderChat';

/**
 * Chats, bottom right, on every page: every conversation this phone has had (as customer or baker),
 * with unread counts. Conversations are never removed from the list, even after an order is deleted.
 */
export function ChatDock() {
  const tx = useTx();
  const db = useDb();
  const version = useChatIndexVersion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [last, setLast] = useState<Record<string, { text: string; at: string }>>({});

  const entries = useMemo(() => {
    const now = new Date().toISOString();
    const uid = cloudEnabled() ? currentUid() : null;
    const derived: ChatEntry[] = [];
    // Baker: requests that can be chatted on in the app.
    for (const o of db.orders) {
      const mode = o.source === 'cloud' && uid ? 'cloud' : o.source === 'same-device' ? 'local' : null;
      if (mode) derived.push({ orderId: o.id, me: 'baker', mode, bakerUid: uid, otherName: o.customer.name.split(' ')[0] || o.customer.name, messengerHref: messengerUrl(o.customer.contact), at: o.createdAt });
    }
    // Customer: requests sent from this phone.
    for (const r of db.myRequests) {
      const local = db.orders.some((o) => o.id === r.id);
      const mode = r.auto ? 'auto' : local ? 'local' : r.cloud && r.bakerUid && cloudEnabled() ? 'cloud' : null;
      if (mode) derived.push({ orderId: r.id, me: 'customer', mode, bakerUid: r.bakerUid ?? null, otherName: r.bakeryName.replace(' (sample)', ''), messengerHref: messengerUrl(r.contact ?? ''), at: r.createdAt });
    }
    const map = new Map<string, ChatEntry>();
    for (const e of [...savedChats(), ...derived]) map.set(entryKey(e), { ...map.get(entryKey(e)), ...e, at: map.get(entryKey(e))?.at ?? e.at ?? now });
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.orders, db.myRequests, version]);

  // Newest conversation first (by last message, else when it started).
  const sorted = [...entries].sort((a, b) => (last[entryKey(b)]?.at ?? b.at).localeCompare(last[entryKey(a)]?.at ?? a.at));
  const total = Object.values(unread).reduce((a, b) => a + b, 0);
  const current = active ? entries.find((e) => entryKey(e) === active) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!entries.length) return null;
  return (
    <div className="no-print" data-chat-dock>
      {/* One quiet watcher per conversation keeps the unread count and last line fresh. */}
      {entries.slice(0, 20).map((e) => (
        <Watch
          key={entryKey(e)}
          entry={e}
          version={version}
          onState={(n, l) => {
            const k = entryKey(e);
            setUnread((u) => (u[k] === n ? u : { ...u, [k]: n }));
            setLast((x) => (l && x[k]?.at === l.at ? x : l ? { ...x, [k]: l } : x));
          }}
        />
      ))}
      {open && (
        <div role="dialog" aria-label={tx('Chats', 'Mga chat')} className="chat-dock-panel fixed right-3 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-[#fffdfa] shadow-[0_24px_60px_-20px_rgb(36_26_23/0.55)]" data-chat-dock-panel>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            {current && (
              <button type="button" className="tool-btn" onClick={() => setActive(null)} aria-label={tx('All chats', 'Lahat ng chat')} data-dock-back>
                <IconArrow className="rotate-180" />
              </button>
            )}
            <p className="flex-1 truncate font-display text-lg font-semibold">{current ? current.otherName : tx('Chats', 'Mga chat')}</p>
            <button type="button" className="tool-btn" onClick={() => setOpen(false)} aria-label={tx('Close chats', 'Isara ang chat')}>
              ✕
            </button>
          </div>
          <div className="overflow-y-auto p-3">
            {current ? (
              <OrderChat key={entryKey(current)} embedded orderId={current.orderId} me={current.me} mode={current.mode} bakerUid={current.bakerUid} otherName={current.otherName} quick={quickReplies(current.me, tx)} messengerHref={current.messengerHref} />
            ) : (
              <ul className="space-y-1">
                {sorted.map((e) => {
                  const k = entryKey(e);
                  const n = unread[k] ?? 0;
                  return (
                    <li key={k}>
                      <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[#f6f1ea]" onClick={() => setActive(k)} data-dock-chat={k}>
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-semibold ${e.me === 'customer' ? 'bg-berry-soft text-berry' : 'bg-[#efe6dc] text-ink'}`} aria-hidden="true">
                          {e.otherName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.otherName}</span>
                          <span className="block truncate text-sm text-ink-soft">{last[k]?.text ?? (e.me === 'customer' ? tx('Your cake request', 'Ang cake request mo') : tx('Customer request', 'Request ng customer'))}</span>
                        </span>
                        {n > 0 && <span className="rounded-full bg-berry px-2 py-0.5 text-xs font-bold text-white" aria-label={tx(`${n} new`, `${n} bago`)}>{n}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className="chat-dock-btn fixed right-3 z-40 grid h-14 w-14 place-items-center rounded-full bg-berry text-white shadow-[0_14px_30px_-12px_rgb(140_34_70/0.7)] transition hover:brightness-110"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={total ? tx(`Chats, ${total} new`, `Mga chat, ${total} bago`) : tx('Chats', 'Mga chat')}
        data-chat-dock-btn
      >
        <IconChat size={26} />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full border-2 border-[#fffdfa] bg-amber-ink px-1 text-center text-xs font-bold leading-4" data-dock-unread>
            {total}
          </span>
        )}
      </button>
    </div>
  );
}

function Watch({ entry, version, onState }: { entry: ChatEntry; version: number; onState: (unread: number, last: { text: string; at: string } | null) => void }) {
  const prefs = usePrefs();
  const { msgs } = useChat(entry.orderId, entry.mode, entry.bakerUid, prefs.lang);
  const seen = seenAt(entryKey(entry));
  const n = msgs.filter((m) => m.from !== entry.me && m.at > seen).length;
  const l = msgs.at(-1);
  // A conversation with messages stays in the list for good, even if the order is deleted later.
  useEffect(() => {
    if (msgs.length) rememberChat({ orderId: entry.orderId, me: entry.me, mode: entry.mode, bakerUid: entry.bakerUid, otherName: entry.otherName, messengerHref: entry.messengerHref });
  }, [msgs.length > 0, entry.orderId, entry.me, entry.mode, entry.bakerUid, entry.otherName, entry.messengerHref]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onState(n, l ? { text: l.text, at: l.at } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, l?.at, version]);
  return null;
}
