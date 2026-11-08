import { useEffect, useState } from 'react';
import { copyText, messengerUrl, shareOrCopy } from '../lib/links';
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

/** Share a link the way Filipinos actually send things: Messenger, share sheet, or copy. */
export function ShareBox({ url, message, title, contact, qrLabel, showQr = true }: { url: string; message: string; title: string; contact?: string; qrLabel: string; showQr?: boolean }) {
  const tx = useTx();
  const [status, setStatus] = useState('');
  const [qr, setQr] = useState(false);
  const mUrl = contact ? messengerUrl(contact) : null;

  const share = async () => {
    const r = await shareOrCopy({ title, text: message, url });
    setStatus(r === 'shared' ? tx('Sent!', 'Naipadala!') : r === 'copied' ? tx('Copied. Paste it in Messenger.', 'Na-copy na. I-paste sa Messenger.') : r === 'cancelled' ? '' : tx('Could not share. Copy the link below.', 'Hindi ma-share. I-copy ang link sa baba.'));
  };
  const copy = async () => {
    const ok = await copyText(`${message}\n${url}`);
    setStatus(ok ? tx('Copied. Paste it in Messenger.', 'Na-copy na. I-paste sa Messenger.') : tx('Copy failed. Long-press the link to copy.', 'Hindi na-copy. I-long press ang link.'));
  };
  const openMessenger = async () => {
    await copyText(`${message}\n${url}`);
    setStatus(tx('Message copied. Paste it in the chat.', 'Na-copy ang message. I-paste sa chat.'));
    if (mUrl) window.open(mUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="btn" onClick={share}>
          <IconSend /> {tx('Send', 'Ipadala')}
        </button>
        <button type="button" className="btn-secondary" onClick={copy}>
          <IconCopy /> {tx('Copy message', 'I-copy ang message')}
        </button>
        {mUrl && (
          <button type="button" className="btn-secondary sm:col-span-2" onClick={openMessenger}>
            <IconChat /> {tx('Open Messenger', 'Buksan ang Messenger')}
          </button>
        )}
      </div>
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
