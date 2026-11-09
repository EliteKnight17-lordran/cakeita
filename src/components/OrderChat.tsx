import { useEffect, useRef, useState } from 'react';
import { MAX_CHAT, useChat, type ChatMode } from '../chat/chat';
import { usePrefs, useTx } from '../lib/prefs';

/**
 * Chat on one cake request, inside Cakeita. Quick replies keep the baker fast;
 * Messenger / Facebook stays one tap away for anyone who prefers it.
 */
export function OrderChat({
  orderId,
  me,
  mode,
  bakerUid,
  otherName,
  quick,
  messengerHref,
}: {
  orderId: string;
  me: 'customer' | 'baker';
  mode: ChatMode | null;
  bakerUid: string | null;
  otherName: string;
  quick: string[];
  messengerHref?: string | null;
}) {
  const tx = useTx();
  const prefs = usePrefs();
  const { msgs, send, error } = useChat(orderId, mode, bakerUid, prefs.lang);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const go = async (t: string) => {
    if (!t.trim() || busy) return;
    setBusy(true);
    const ok = await send(me, t);
    setBusy(false);
    if (ok) setText('');
  };

  // Nothing to offer here (a link order with no Messenger link): stay out of the way.
  if (!mode && !messengerHref) return null;
  const time = (iso: string) => new Date(iso).toLocaleTimeString(prefs.lang === 'tl' ? 'fil-PH' : 'en-PH', { hour: 'numeric', minute: '2-digit' });
  const title = me === 'customer' ? tx(`Chat with ${otherName}`, `Chat kay ${otherName}`) : tx(`Chat with ${otherName}`, `Chat kay ${otherName}`);

  return (
    <section className="card space-y-3" aria-labelledby={`chat-h-${orderId}`} data-chat={mode ?? 'none'}>
      <h2 id={`chat-h-${orderId}`} className="font-display text-xl font-semibold">
        {title}
      </h2>
      {mode ? (
        <>
          <div ref={listRef} tabIndex={0} className="max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-[#f6f1ea] p-3" role="log" aria-live="polite" aria-label={tx('Messages', 'Mga message')} data-chat-log>
            {msgs.length === 0 ? (
              <p className="text-center text-sm text-ink-soft">{me === 'customer' ? tx('Ask the baker anything about your cake here.', 'Itanong dito sa baker ang kahit ano tungkol sa cake mo.') : tx('Answer the customer here. Quick replies save time.', 'Sagutin dito ang customer. Mas mabilis gamit ang quick replies.')}</p>
            ) : (
              msgs.map((m) => {
                const mine = m.from === me;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-chat-msg={m.from}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.95rem] ${mine ? 'bg-berry text-white' : 'border border-line bg-white'}`}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-0.5 text-[0.7rem] ${mine ? 'text-white/85' : 'text-ink-soft'}`}>{time(m.at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {quick.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={tx('Quick replies', 'Quick replies')}>
              {quick.map((q) => (
                <button key={q} type="button" className="chip shrink-0 whitespace-nowrap text-sm" onClick={() => go(q)} disabled={busy} data-quick-reply>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go(text);
            }}
          >
            <label htmlFor={`chat-in-${orderId}`} className="sr-only">
              {tx('Your message', 'Message mo')}
            </label>
            <textarea id={`chat-in-${orderId}`} rows={1} className="input min-h-11 flex-1 resize-none" maxLength={MAX_CHAT} placeholder={tx('Type a message', 'Mag-type ng message')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(text); } }} data-chat-input />
            <button type="submit" className="btn shrink-0" disabled={busy || !text.trim()} data-chat-send>
              {tx('Send', 'Send')}
            </button>
          </form>
          {error && <p className="text-sm text-amber-ink" role="status">{tx('Could not send right now. Check your connection, or use Messenger.', 'Hindi maipadala ngayon. I-check ang internet, o gamitin ang Messenger.')}</p>}
          {mode === 'local' && <p className="text-xs text-ink-soft">{tx('Demo chat: saved on this device only.', 'Demo chat: naka-save lang sa device na ito.')}</p>}
        </>
      ) : (
        <p className="text-sm text-ink-soft" data-chat-offline>
          {me === 'customer' ? tx('In-app chat works with bakers who use Cakeita online. For this one, message them on Messenger.', 'Gumagana ang chat sa app sa mga baker na naka-online sa Cakeita. Sa baker na ito, i-message sila sa Messenger.') : tx('This request came by link, so chat with the customer on Messenger.', 'Galing sa link ang request na ito, kaya sa Messenger kausapin ang customer.')}
        </p>
      )}
      {messengerHref && (
        <a href={messengerHref} target="_blank" rel="noreferrer" className="link inline-flex min-h-11 items-center text-sm" data-chat-messenger>
          {tx('Or open Messenger / Facebook page', 'O buksan ang Messenger / Facebook page')}
        </a>
      )}
    </section>
  );
}
