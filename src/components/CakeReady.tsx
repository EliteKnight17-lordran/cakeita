import { useEffect, useState } from 'react';
import { cloudEnabled } from '../cloud/config';
import { markReady } from '../domain/orders';
import type { QuoteLink } from '../domain/schemas';
import type { Order } from '../domain/types';
import { repo } from '../data/store';
import { handoffText, niceTime } from '../lib/dates';
import { resizeImage } from '../lib/image';
import { useTx } from '../lib/prefs';
import { IconCamera } from './icons';
import { ShareBox } from './ShareBox';
import { Field, Notice } from './ui';

/** Shrink the finished-cake photo so it fits in a Firestore doc (and this phone's storage). */
async function smallPhoto(file: File): Promise<string> {
  let img = await resizeImage(file, 900, 0.75);
  if (img.dataUrl.length > 300_000) img = await resizeImage(file, 640, 0.6);
  if (img.dataUrl.length > 390_000) throw new Error('too-big');
  return img.dataUrl;
}

/**
 * Baker: "the cake is ready". A photo of the finished cake and a short note go to the customer
 * (live in Cakeita when the quote went through the cloud, and as a Messenger message with the quote link).
 */
export function ReadySender({ order, link, cloud }: { order: Order; link: string | null; cloud: boolean }) {
  const tx = useTx();
  const first = order.customer.name.split(' ')[0];
  const [photo, setPhoto] = useState<string | null>(order.ready?.photo ?? null);
  const [note, setNote] = useState(order.ready?.note ?? '');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(!order.ready);
  const delivery = order.handoff === 'delivery';
  const QUICK: Array<[string, string]> = delivery
    ? [
        [tx('Book your Lalamove or Grab when you are ready; I will hand it over.', 'Mag-book na ng Lalamove o Grab kapag ready ka; ako ang mag-aabot.'), tx('Book your rider', 'Mag-book ng rider')],
        [tx('I can book the delivery for you; you pay the rider.', 'Puwede kong i-book ang delivery; ikaw ang magbabayad sa rider.'), tx('I will book it', 'Ako ang mag-book')],
      ]
    : [
        [tx('You can pick it up anytime today. Please message me when you are on the way.', 'Puwede nang kunin ngayong araw. I-message lang ako kapag papunta ka na.'), tx('Pick up today', 'Kunin ngayong araw')],
        [tx('Please keep the box flat and cool on the way home.', 'Pakipanatiling flat at malamig ang box pauwi.'), tx('Keep it flat', 'Panatilihing flat')],
      ];

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr('');
    try {
      setPhoto(await smallPhoto(f));
    } catch {
      setErr(tx('That picture could not be used. Try another one (JPG or PNG).', 'Hindi magamit ang picture. Subukan ang iba (JPG o PNG).'));
    }
  };

  const send = () => {
    repo.upsertOrder(markReady(order, note, photo));
    setEditing(false);
  };

  const message = tx(
    `Hi ${first}! Your cake is ready. ${handoffText(order, tx, 'you')}.${order.ready?.note ? ` ${order.ready.note}` : ''} ${order.ready?.photo ? (cloud ? 'See the photo here:' : 'Photo below. Your order:') : 'Your order:'}`,
    `Hi ${first}! Handa na ang cake mo. ${handoffText(order, tx, 'you')}.${order.ready?.note ? ` ${order.ready.note}` : ''} ${order.ready?.photo ? (cloud ? 'Tingnan ang picture dito:' : 'Picture sa baba. Ang order mo:') : 'Ang order mo:'}`,
  );

  return (
    <section className="card space-y-3" aria-labelledby="ready-h" data-ready-sender>
      <h2 id="ready-h" className="font-display text-xl font-semibold">
        {order.ready ? tx('Customer told: cake is ready', 'Nasabihan na ang customer: handa na') : tx('Cake ready? Tell the customer', 'Handa na ang cake? Sabihan ang customer')}
      </h2>
      {order.handoff && <p className="text-sm">{handoffText(order, tx, 'baker')}</p>}
      {editing ? (
        <>
          <div className="flex items-center gap-3">
            {photo ? <img src={photo} alt={tx('Finished cake', 'Tapos na cake')} className="h-24 w-24 rounded-xl border border-line object-cover" /> : null}
            <label className="btn-secondary cursor-pointer">
              <IconCamera /> {photo ? tx('Change photo', 'Palitan ang photo') : tx('Add a photo of the cake', 'Lagyan ng photo ng cake')}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} data-ready-photo />
            </label>
          </div>
          {err && <Notice tone="warn">{err}</Notice>}
          <Field id="ready-note" label={tx('Short note (optional)', 'Maikling note (optional)')}>
            <input id="ready-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {QUICK.map(([text, label]) => (
              <button key={label} type="button" className="btn-ghost text-sm" onClick={() => setNote(text)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn w-full" onClick={send} data-mark-ready>
            {tx('Tell the customer: cake is ready', 'Sabihan ang customer: handa na')}
          </button>
        </>
      ) : (
        <>
          {order.ready?.photo && <img src={order.ready.photo} alt={tx('Finished cake', 'Tapos na cake')} className="max-h-64 w-full rounded-2xl border border-line object-cover" />}
          {cloud && <Notice tone="ok">{tx('They see it in Cakeita on their quote page. You can also message them:', 'Makikita nila ito sa Cakeita sa quote page nila. Puwede mo rin silang i-message:')}</Notice>}
          {link && <ShareBox url={link} title="Cake ready" qrLabel={tx('QR code of the order', 'QR code ng order')} message={message} />}
          {order.ready?.photo && !cloud && <p className="text-sm text-ink-soft">{tx('Messenger links can’t carry photos: send the cake photo in the chat too.', 'Hindi kasya ang photo sa link: i-send din ang picture sa chat.')}</p>}
          <button type="button" className="link min-h-11 text-sm" onClick={() => setEditing(true)}>
            {tx('Change the photo or note', 'Palitan ang photo o note')}
          </button>
        </>
      )}
    </section>
  );
}

/** Customer: "Your cake is ready", with the photo and what to do next for pickup or delivery. */
export function ReadyCard({ quote, local }: { quote: QuoteLink; local: Order | undefined }) {
  const tx = useTx();
  const ready = quote.ready!;
  const [cloudPhoto, setPhoto] = useState<string | null>(null);
  // Same phone as the baker (demo): the photo is right here; otherwise fetch it from the cloud.
  const photo = local?.ready?.photo ?? cloudPhoto;
  useEffect(() => {
    if (photo || !ready.hasPhoto || !cloudEnabled()) return;
    let alive = true;
    import('../cloud/data')
      .then((m) => m.loadReadyPhoto(quote.orderId))
      .then((p) => alive && setPhoto(p), () => {});
    return () => {
      alive = false;
    };
  }, [photo, ready.hasPhoto, ready.at, quote.orderId]);
  const delivery = quote.handoff === 'delivery';
  const tips = delivery
    ? [
        tx('Book a Lalamove or Grab car, or ask the baker to book it for you.', 'Mag-book ng Lalamove o Grab na kotse, o ipa-book sa baker.'),
        tx('A car is safest for cakes. Ask the rider to keep the box flat and the aircon on.', 'Pinakaligtas ang kotse para sa cake. Pakisabihan ang rider na panatilihing flat ang box at naka-aircon.'),
      ]
    : [
        tx(`Pick it up at ${quote.bakery.name.replace(' (sample)', '')}${quote.handoffTime ? ` at ${niceTime(quote.handoffTime)}` : ''}. Message the baker when you are on the way.`, `Kunin kay ${quote.bakery.name.replace(' (sample)', '')}${quote.handoffTime ? ` nang ${niceTime(quote.handoffTime)}` : ''}. I-message ang baker kapag papunta ka na.`),
        tx('Keep the box flat and cool on the way home (in the car, on the floor is best).', 'Panatilihing flat at malamig ang box pauwi (sa sasakyan, pinakamainam sa sahig).'),
      ];
  return (
    <section className="card space-y-3 border-ok-ink/40 bg-ok-bg/40" aria-labelledby="ready-card-h" data-cake-ready>
      <h2 id="ready-card-h" className="font-display text-2xl font-semibold">
        {tx('Your cake is ready!', 'Handa na ang cake mo!')}
      </h2>
      {photo ? (
        <img src={photo} alt={tx('Photo of your finished cake from the baker', 'Picture ng tapos mong cake mula sa baker')} className="max-h-80 w-full rounded-2xl border border-line object-cover" data-ready-img />
      ) : ready.hasPhoto ? (
        <p className="text-sm text-ink-soft">{cloudEnabled() ? tx('Loading the photo…', 'Nilo-load ang picture…') : tx('The baker took a photo; they will send it in Messenger.', 'May picture ang baker; ise-send nila sa Messenger.')}</p>
      ) : null}
      {ready.note && (
        <p className="rounded-2xl bg-white p-3">
          <strong>{tx('From the baker', 'Mula sa baker')}:</strong> {ready.note}
        </p>
      )}
      <p className="font-semibold">{quote.handoff ? handoffText(quote, tx, 'you') : tx('Pickup or delivery: as agreed with the baker', 'Pickup o delivery: ayon sa usapan ninyo ng baker')}</p>
      <ul className="list-disc space-y-1 pl-5 text-[0.95rem]">
        {tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
