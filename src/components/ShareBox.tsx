import { useEffect, useState } from 'react';
import { canShareSheet, copyText, messengerUrl, shareOrCopy } from '../lib/links';
import { useTx } from '../lib/prefs';
import { IconChat, IconCopy, IconSend } from './icons';

export function QR({ value, label, size = 220 }: { value: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((m) => m.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: value.length > 1500 ? 'L' : 'M', color: { dark: '#241a17', light: '#ffffff' } }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [value, size]);
  if (err) return null;
  return src ? (
    <img src={src} width={size} height={size} alt={label} className="mx-auto rounded-xl border border-line bg-white p-2" />
  ) : (
    <div className="mx-auto animate-pulse rounded-xl bg-[#f1ebe4]" style={{ width: size, height: size }} aria-hidden="true" />
  );
}

/**
 * Share a link the way Filipinos actually send things: Messenger, share sheet, or copy.
 * "Send" opens the phone's share menu. Laptop browsers usually have none, so there the
 * buttons say what they really do (copy, then open Messenger) instead of a "Send" that only copies.
 */
export function ShareBox({ url, message, title, contact, qrLabel, showQr = true }: { url: string; message: string; title: string; contact?: string; qrLabel: string; showQr?: boolean }) {
  const tx = useTx();
  const [status, setStatus] = useState('');
  const [qr, setQr] = useState(false);
  const mUrl = contact ? messengerUrl(contact) : null;
  const sheet = canShareSheet();

  const share = async () => {
    const r = await shareOrCopy({ title, text: message, url });
    setStatus(r === 'shared' ? tx('Done. Check that it went through in the app you picked.', 'Ayos. Tingnan kung naipadala sa app na pinili mo.') : r === 'copied' ? tx('Copied. Paste it in Messenger.', 'Na-copy na. I-paste sa Messenger.') : r === 'cancelled' ? '' : tx('Could not share. Copy the link below.', 'Hindi ma-share. I-copy ang link sa baba.'));
  };
  const copy = async () => {
    const ok = await copyText(`${message}\n${url}`);
    setStatus(ok ? tx('Copied. Paste it in Messenger.', 'Na-copy na. I-paste sa Messenger.') : tx('Copy failed. Long-press the link to copy.', 'Hindi na-copy. I-long press ang link.'));
  };
  const openMessenger = async () => {
    const ok = await copyText(`${message}\n${url}`);
    setStatus(ok ? tx('Message copied. Paste it in the chat that opened.', 'Na-copy ang message. I-paste sa chat na bumukas.') : tx('Copy failed. Copy the link below, then paste it in the chat.', 'Hindi na-copy. I-copy ang link sa baba at i-paste sa chat.'));
    if (mUrl) window.open(mUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3" data-share-box={sheet ? 'sheet' : 'copy'}>
      <div className="grid gap-2 sm:grid-cols-2">
        {sheet ? (
          <button type="button" className="btn" onClick={share} data-share-send>
            <IconSend /> {tx('Send', 'Ipadala')}
          </button>
        ) : mUrl ? (
          <button type="button" className="btn sm:col-span-2" onClick={openMessenger} data-share-messenger>
            <IconChat /> {tx('Copy and open Messenger', 'I-copy at buksan ang Messenger')}
          </button>
        ) : null}
        <button type="button" className={sheet || mUrl ? 'btn-secondary' : 'btn sm:col-span-2'} onClick={copy} data-share-copy>
          <IconCopy /> {tx('Copy message', 'I-copy ang message')}
        </button>
        {sheet && mUrl && (
          <button type="button" className="btn-secondary sm:col-span-2" onClick={openMessenger} data-share-messenger>
            <IconChat /> {tx('Open Messenger', 'Buksan ang Messenger')}
          </button>
        )}
      </div>
      <p className="text-center text-sm text-ink-soft">
        {sheet
          ? tx('Send opens your share menu. Pick Messenger, Viber or SMS.', 'Bubuksan ng Ipadala ang share menu. Piliin ang Messenger, Viber o SMS.')
          : tx('Copy it, then paste it in Messenger or any chat.', 'I-copy, tapos i-paste sa Messenger o kahit anong chat.')}
      </p>
      <p className="min-h-6 text-center font-semibold text-ok-ink" aria-live="polite">
        {status}
      </p>
      <details className="rounded-xl border border-line bg-white p-3.5">
        <summary className="cursor-pointer font-semibold">{tx('See the message and link', 'Tingnan ang message at link')}</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm">{message}</p>
        <a href={url} className="mt-2 block break-all text-sm text-berry underline">
          {url.length > 120 ? `${url.slice(0, 120)}…` : url}
        </a>
      </details>
      {showQr && (
        <div className="text-center">
          <button type="button" className="btn-ghost" onClick={() => setQr((q) => !q)} aria-expanded={qr}>
            {qr ? tx('Hide QR code', 'Itago ang QR') : tx('Show QR code', 'Ipakita ang QR')}
          </button>
          {qr && (
            <div className="mt-3">
              <QR value={url} label={qrLabel} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
