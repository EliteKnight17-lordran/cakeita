import { SurveyFinishCard } from '../components/SurveyFinish';
import { ReviewCard } from '../components/ReviewCard';
import { celebrate } from '../lib/celebrate';
import { cloudEnabled } from '../cloud/config';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { Layout } from '../components/Layout';
import { ShareBox } from '../components/ShareBox';
import { Field, Notice, SampleBadge } from '../components/ui';
import { IconChevron, IconHeart } from '../components/icons';
import { formatPeso } from '../domain/money';
import { applyConfirmation, applyOffer, isQuoteExpired, quoteLinkPayload } from '../domain/orders';
import { quoteLinkSchema, type OfferLink, type QuoteLink } from '../domain/schemas';
import { confirmSample } from '../data/sampleBakers';
import { repo, useDb, type MyRequest } from '../data/store';
import { decodePayload, linkErrorText } from '../lib/codec';
import { confirmLink, offerLink, quoteCodeFrom } from '../lib/links';
import { usePrefs, useTx } from '../lib/prefs';
import { handoffText, niceDate } from '../lib/dates';

export default function QuotePage() {
  const { id = '' } = useParams();
  const loc = useLocation();
  const code = new URLSearchParams(loc.search).get('q');
  const db = useDb();
  const tx = useTx();
  const [quote, setQuote] = useState<QuoteLink | null>(null);
  const [err, setErr] = useState('');
  const mine = db.myRequests.find((r) => r.id === id);
  // The latest answer this phone has heard (sample bakery, or a cloud baker while the app was open).
  const savedCode = code ? null : quoteCodeFrom(mine?.quoteLink);
  const auto = !!mine?.auto;

  useEffect(() => {
    let alive = true;
    let stop: (() => void) | null = null;
    (async () => {
      if (code) {
        const r = await decodePayload(code, quoteLinkSchema);
        if (!alive) return;
        if (r.ok && r.value.orderId === id) setQuote(r.value);
        else setErr(r.ok ? tx('This quote link does not match.', 'Hindi tugma ang quote link.') : linkErrorText(r.error, tx));
        return;
      }
      // Same device as the baker (demo): build it from the local order.
      const order = repo.get().orders.find((o) => o.id === id);
      const bakery = repo.get().bakery;
      if (order && bakery) {
        setQuote(quoteLinkPayload(bakery, order));
        return;
      }
      if (savedCode) {
        const r = await decodePayload(savedCode, quoteLinkSchema);
        if (!alive) return;
        if (r.ok && r.value.orderId === id) setQuote(r.value);
      }
      // Otherwise the quote may be waiting in the cloud; it also appears live when the baker approves.
      if (cloudEnabled() && !auto) {
        try {
          const { listenQuote } = await import('../cloud/data');
          const off = await listenQuote(id, (q) => alive && setQuote(q));
          if (alive) stop = off;
          else off();
        } catch {
          /* offline */
        }
      }
    })();
    return () => {
      alive = false;
      stop?.();
    };
  }, [code, id, db.orders, savedCode, auto, tx]);

  if (err) {
    return (
      <Layout>
        <div className="py-8">
          <Notice tone="warn" title={tx('We could not open this quote', 'Hindi mabuksan ang quote')}>
            {err}
          </Notice>
        </div>
      </Layout>
    );
  }

  if (!quote) {
    return (
      <Layout>
        <div className="space-y-4 py-6">
          <h1 className="font-display text-2xl font-semibold">{tx('Your cake request', 'Ang cake request mo')}</h1>
          {mine ? (
            <>
              {mine.auto ? (
                <div data-waiting-auto>
                  <Notice tone="info" title={tx(`${mine.bakeryName} is looking at your cake…`, `Tinitingnan ni ${mine.bakeryName} ang cake mo…`)}>
                    <span aria-live="polite">{tx('This is a sample bakery for the demo, so it answers by itself in a few seconds. A real baker answers here too, usually within the day.', 'Sample bakery ito para sa demo, kaya kusang sasagot sa loob ng ilang segundo. Dito rin sasagot ang totoong baker, kadalasan sa loob ng araw.')}</span>
                  </Notice>
                </div>
              ) : mine.cloud ? (
                <Notice tone="ok" title={tx(`Delivered to ${mine.bakeryName}`, `Nasa inbox na ni ${mine.bakeryName}`)}>
                  {tx('Their answer shows up right here and in My cakes: a price, another offer, or a “sorry, we can’t”.', 'Dito lalabas ang sagot nila at sa "Mga cake ko": presyo, ibang alok, o "pasensya, hindi namin kaya".')}
                </Notice>
              ) : (
                <Notice tone="info" title={tx('Waiting for the baker', 'Hinihintay ang baker')}>
                  {tx(`${mine.bakeryName} will send you a quote link in Messenger. Open it to see your final price.`, `Magpapadala si ${mine.bakeryName} ng quote link sa Messenger. Buksan ito para makita ang final na presyo.`)}
                </Notice>
              )}
              <p>{mine.summary}</p>
              {!mine.auto && (mine.cloud ? (
                <details className="card">
                  <summary className="cursor-pointer font-semibold">{tx('Also send it on Messenger (optional)', 'Ipadala rin sa Messenger (optional)')}</summary>
                  <div className="mt-3">
                    <ShareBox url={mine.requestLink} contact={mine.contact} message={tx('Hi! Here is my cake request:', 'Hi po! Ito ang cake request ko:')} title="Cake request" qrLabel="QR" />
                  </div>
                </details>
              ) : (
                <ShareBox url={mine.requestLink} contact={mine.contact} message={tx('Hi! Here is my cake request again:', 'Hi po! Ito ulit ang cake request ko:')} title="Cake request" qrLabel="QR" />
              ))}
              {mine.fromSlug && (
                <Link to={`/near?from=${encodeURIComponent(mine.fromSlug)}`} className="btn-ghost">
                  {tx('Back to the bakers', 'Bumalik sa mga baker')}
                </Link>
              )}
            </>
          ) : (
            <>
              <Notice tone="info">{tx('No quote here yet. Open the quote link the baker sent you, or check My cakes.', 'Wala pang quote dito. Buksan ang quote link na pinadala ng baker, o tingnan ang Mga cake ko.')}</Notice>
              <div className="flex flex-wrap gap-2">
                <Link to="/me" className="btn">{tx('My cakes', 'Mga cake ko')}</Link>
                <Link to="/near" className="btn-ghost">{tx('Find a baker', 'Maghanap ng baker')}</Link>
              </div>
            </>
          )}
        </div>
      </Layout>
    );
  }
  return <QuoteView quote={quote} mine={mine ?? null} />;
}

function QuoteView({ quote, mine }: { quote: QuoteLink; mine: MyRequest | null }) {
  const tx = useTx();
  const prefs = usePrefs();
  const db = useDb();
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerText, setOfferText] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerErr, setOfferErr] = useState('');
  const [sentOffer, setSentOffer] = useState<MyRequest['offer'] | null>(null);
  const [offerUrl, setOfferUrl] = useState<string | null>(null);
  const [cloudConfirm, setCloudConfirm] = useState<'idle' | 'sending' | 'done' | 'none'>('idle');
  const expired = isQuoteExpired(quote.validUntil);
  const local = db.orders.find((o) => o.id === quote.orderId);
  const auto = !!mine?.auto;
  const confirmedHere = (local && ['confirmed', 'baking', 'ready', 'done'].includes(local.status)) || (auto && mine?.status === 'confirmed');
  const desc = describeCake(quote.visual, prefs.lang);
  const other = `/near?from=${encodeURIComponent(mine?.fromSlug ?? 'sample')}`;
  const myOffer = mine?.offer ?? sentOffer;
  const offerPending = !!myOffer && (!quote.offer || quote.offer.answer === 'pending');
  const canOffer = !myOffer && !quote.offer;
  const isCounter = quote.estimate != null && Math.round(quote.estimate) !== Math.round(quote.price);
  // Only the link can reach a baker without Cakeita open on this phone or in the cloud.
  const offerByLink = offerPending && !auto && !local && !mine?.cloud;

  useEffect(() => {
    if (!offerByLink || offerUrl || !myOffer) return;
    let alive = true;
    offerLink({ v: 1, orderId: quote.orderId, price: myOffer.price, note: myOffer.note, customerName: quote.customerName, at: myOffer.at }).then((u) => alive && setOfferUrl(u));
    return () => {
      alive = false;
    };
  }, [offerByLink, offerUrl, myOffer, quote.orderId, quote.customerName]);

  const confirm = async (e?: React.MouseEvent<HTMLElement>) => {
    celebrate(e?.currentTarget);
    const c = { v: 1 as const, orderId: quote.orderId, price: quote.price, confirmedAt: new Date().toISOString(), note: note.slice(0, 300), customerName: quote.customerName };
    if (auto) {
      // Sample bakery: nothing real to send.
      confirmSample(quote.orderId, c.note);
      repo.updateMyRequest(quote.orderId, { status: 'confirmed' });
      return;
    }
    setLink(await confirmLink(c));
    // Tell the baker right away if they have a cloud inbox (the Messenger link still works too).
    // The rating card waits for this: signing in before it lands would hold the write back.
    if (cloudEnabled()) {
      setCloudConfirm('sending');
      import('../cloud/data')
        .then(async ({ quoteOwner, sendConfirmation }) => {
          const owner = await quoteOwner(c.orderId);
          if (!owner) return setCloudConfirm('none');
          await sendConfirmation(c, owner);
          setCloudConfirm('done');
        })
        .catch(() => setCloudConfirm('none'));
    }
    // Demo on one device: apply immediately.
    const res = applyConfirmation(repo.get().orders.find((o) => o.id === quote.orderId), c);
    if (res.ok) repo.upsertOrder(res.order);
    repo.updateMyRequest(quote.orderId, { status: 'confirmed' });
  };

  const sendOffer = async () => {
    const price = Math.round(Number(offerText));
    if (!offerText.trim() || !Number.isFinite(price) || price <= 0) return setOfferErr(tx('Type the price you can pay.', 'I-type ang presyong kaya mo.'));
    if (price >= quote.price) return setOfferErr(tx(`Your offer should be lower than ${formatPeso(quote.price)}.`, `Dapat mas mababa sa ${formatPeso(quote.price)} ang alok mo.`));
    setOfferErr('');
    const o: OfferLink = { v: 1, orderId: quote.orderId, price, note: offerNote.trim().slice(0, 300), customerName: quote.customerName, at: new Date().toISOString() };
    const saved = { price: o.price, note: o.note, at: o.at };
    setSentOffer(saved);
    if (mine) repo.updateMyRequest(quote.orderId, { offer: saved });
    // Demo on one device: straight into the baker's copy.
    const res = applyOffer(repo.get().orders.find((x) => x.id === quote.orderId), o);
    if (res.ok) repo.upsertOrder(res.order);
    if (!auto && cloudEnabled()) {
      import('../cloud/data')
        .then(async ({ quoteOwner, sendOffer: send }) => {
          const owner = await quoteOwner(o.orderId);
          if (owner) await send(o, owner);
        })
        .catch(() => {});
    }
    setOfferOpen(false);
  };

  if (quote.kind === 'declined') {
    return (
      <Layout>
        <div className="space-y-4" data-declined>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-xl font-semibold">{quote.bakery.name}</p>
            <SampleBadge show={quote.bakery.isSample} text={tx('Sample bakery, demo data', 'Sample bakery, demo data')} />
          </div>
          <h1 className="font-display text-3xl font-semibold">{tx(`Sorry, ${quote.bakery.name.replace(' (sample)', '')} can’t bake this one`, `Pasensya, hindi kaya ni ${quote.bakery.name.replace(' (sample)', '')} ang cake na ito`)}</h1>
          {quote.reason && (
            <p className="rounded-2xl bg-berry-soft p-3">
              <strong>{tx('Their reason', 'Dahilan nila')}:</strong> {quote.reason}
            </p>
          )}
          <p>{tx('Your cake is saved. Send it to another baker; each one prices it from their own menu.', 'Naka-save ang cake mo. Ipadala sa ibang baker; sariling menu nila ang presyo.')}</p>
          <Link to={other} className="btn w-full" data-choose-another>
            {tx('Choose another baker', 'Pumili ng ibang baker')}
          </Link>
          <p className="text-sm text-ink-soft">{desc}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-xl font-semibold">{quote.bakery.name}</p>
          <SampleBadge show={quote.bakery.isSample} text={tx('Sample bakery, demo data', 'Sample bakery, demo data')} />
        </div>
        <h1 className="font-display text-3xl font-semibold">
          {tx(`Here's your quote, ${quote.customerName.split(' ')[0]}`, `Sige, ito ang quote mo, ${quote.customerName.split(' ')[0]}`)}
        </h1>
        <CakeView visual={quote.visual} description={desc} />
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-soft">{tx('Price from the baker', 'Presyo mula sa baker')}</p>
            {quote.offer?.answer === 'accepted' ? (
              <span className="tag bg-ok-bg text-ok-ink">{tx('Your offer, accepted', 'Alok mo, tinanggap')}</span>
            ) : isCounter ? (
              <span className="tag bg-amber-bg text-amber-ink" data-counter>{tx('Their counter-offer', 'Alok nilang presyo')}</span>
            ) : quote.estimate != null ? (
              <span className="tag bg-ok-bg text-ok-ink" data-accepted>{tx('Accepted at the app price', 'Tinanggap sa presyo ng app')}</span>
            ) : null}
          </div>
          <p className="price text-4xl" data-quote-price>{formatPeso(quote.price)}</p>
          {isCounter && quote.offer?.answer !== 'accepted' && <p className="text-sm text-ink-soft">{tx(`The app estimate was ${formatPeso(quote.estimate!)}.`, `${formatPeso(quote.estimate!)} ang tantya ng app.`)}</p>}
          <ul className="space-y-1 text-base">
            <li>
              <strong>{tx('Size', 'Laki')}:</strong> {quote.sizeLabel} · {tx('for', 'para sa')} {quote.servings} {tx('people', 'tao')}
            </li>
            <li>
              <strong>{tx('Includes', 'Kasama')}:</strong> {quote.parts.join(', ')}
            </li>
            {quote.textOnCake && (
              <li>
                <strong>{tx('Words on cake', 'Nakasulat')}:</strong> “{quote.textOnCake}”
              </li>
            )}
            <li>
              <strong>{tx('For', 'Para sa')}:</strong> {quote.occasion}, {niceDate(quote.eventDate, prefs.lang)}
            </li>
            {quote.handoff && (
              <li data-quote-handoff={quote.handoff}>
                <strong>{quote.handoff === 'delivery' ? 'Delivery' : 'Pickup'}:</strong> {handoffText(quote, tx, 'you')}
              </li>
            )}
            <li>
              <strong>{tx('Valid until', 'Valid hanggang')}:</strong> {niceDate(quote.validUntil, prefs.lang)}
            </li>
          </ul>
          {quote.note && (
            <p className="rounded-2xl bg-berry-soft p-3">
              <strong>{tx('Note from the baker', 'Note mula sa baker')}:</strong> {quote.note}
            </p>
          )}
        </div>
        {quote.offer?.answer === 'accepted' && (
          <Notice tone="ok" title={tx('They said yes to your offer', 'Pumayag sila sa alok mo')}>
            {tx(`${formatPeso(quote.price)} it is. Confirm below to lock it in.`, `${formatPeso(quote.price)} na. I-confirm sa baba para sigurado.`)}
          </Notice>
        )}
        {quote.offer?.answer === 'kept' && (
          <div data-offer-kept>
            <Notice tone="info" title={tx('They kept their price', 'Hindi nila binago ang presyo')}>
              {tx(`They can't do ${formatPeso(quote.offer.price)}. You can still take ${formatPeso(quote.price)}, or choose another baker.`, `Hindi nila kaya ang ${formatPeso(quote.offer.price)}. Puwede mo pa ring kunin sa ${formatPeso(quote.price)}, o pumili ng ibang baker.`)}
            </Notice>
          </div>
        )}

        {confirmedHere ? (
          <Notice tone="ok" title={tx('Confirmed!', 'Confirmed na!')}>
            {auto
              ? tx('This is a sample bakery, so no real order was made. With a real baker, they get your confirmation in Cakeita right away.', 'Sample bakery ito, kaya walang totoong order. Sa totoong baker, matatanggap nila agad sa Cakeita ang confirmation mo.')
              : tx('The baker has your confirmation.', 'Natanggap na ng baker ang confirmation mo.')}
          </Notice>
        ) : expired ? (
          <Notice tone="warn" title={tx('This quote has expired', 'Expired na ang quote')}>
            {tx('Prices may have changed. Message the baker for a new quote.', 'Baka nagbago ang presyo. I-message ang baker para sa bagong quote.')}
          </Notice>
        ) : link ? (
          <div className="card space-y-3">
            <p className="font-bold">{tx('Last step: send your confirmation to the baker.', 'Huling step: ipadala ang confirmation sa baker.')}</p>
            <ShareBox
              url={link}
              title="Cake confirmation"
              contact={quote.bakery.contact}
              qrLabel="QR"
              message={tx(`Hi ${quote.bakery.name}! I confirm my cake for ${niceDate(quote.eventDate, 'en')} at ${formatPeso(quote.price)}.`, `Hi ${quote.bakery.name}! Kinukumpirma ko po ang cake ko para sa ${niceDate(quote.eventDate, 'tl')}, ${formatPeso(quote.price)}.`)}
            />
          </div>
        ) : offerPending && myOffer ? (
          <div className="card space-y-3" data-offer-pending>
            <p className="font-bold" aria-live="polite">
              {tx(`You offered ${formatPeso(myOffer.price)}. Waiting for their answer…`, `Nag-alok ka ng ${formatPeso(myOffer.price)}. Hinihintay ang sagot nila…`)}
            </p>
            <p className="text-sm text-ink-soft">
              {auto
                ? tx('Sample bakery: it answers by itself in a few seconds.', 'Sample bakery: kusang sasagot sa loob ng ilang segundo.')
                : tx('They will accept it or keep their price. Either way, that is their final answer.', 'Tatanggapin nila o hindi babaguhin ang presyo. Alinman doon, iyon na ang final na sagot nila.')}
            </p>
            {offerByLink && offerUrl && (
              <ShareBox url={offerUrl} title="Cake offer" contact={quote.bakery.contact} qrLabel="QR" message={tx(`Hi ${quote.bakery.name}! Could you do my cake for ${formatPeso(myOffer.price)}?`, `Hi ${quote.bakery.name}! Puwede po ba ang cake ko sa ${formatPeso(myOffer.price)}?`)} />
            )}
            <Link to={other} className="btn-ghost">{tx('Choose another baker instead', 'Pumili na lang ng ibang baker')}</Link>
          </div>
        ) : (
          <div className="card space-y-3">
            <details className="group" open={note ? true : undefined}>
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-ink-soft">
                {tx('Add a note for the baker', 'Magdagdag ng note sa baker')}
                <IconChevron size={16} className="transition group-open:rotate-180" />
              </summary>
              <Field id="cnote" label={tx('Note for the baker (optional)', 'Note para sa baker (optional)')}>
                <textarea id="cnote" className="input min-h-20" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </details>
            <button type="button" className="btn w-full text-lg" onClick={confirm}>
              <IconHeart /> {tx('This is the one I want', 'Ito ang gusto ko')}
            </button>
            {canOffer && offerOpen && (
                <div className="space-y-3 rounded-2xl border border-line p-3" data-offer-form>
                  <Field id="offer" label={tx('Your price (₱)', 'Presyo mo (₱)')} hint={tx('You can do this once. They accept it or keep their price.', 'Isang beses lang ito. Tatanggapin nila o hindi babaguhin ang presyo.')}>
                    <input id="offer" type="number" inputMode="numeric" min={1} max={Math.max(1, quote.price - 1)} step={50} className="input text-xl font-bold" value={offerText} onChange={(e) => setOfferText(e.target.value)} aria-describedby="offer-hint" aria-invalid={!!offerErr} />
                  </Field>
                  <Field id="offer-note" label={tx('Short note (optional)', 'Maikling note (optional)')}>
                    <input id="offer-note" className="input" maxLength={300} value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder={tx('e.g. I can pick it up myself', 'hal. Ako na ang magpi-pickup')} />
                  </Field>
                  {offerErr && <Notice tone="warn">{offerErr}</Notice>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" onClick={sendOffer} data-send-offer>
                      {tx('Send my offer', 'Ipadala ang alok ko')}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setOfferOpen(false)}>
                      {tx('Cancel', 'Huwag na')}
                    </button>
                  </div>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-5 text-sm">
              {canOffer && !offerOpen && (
                <button type="button" className="link min-h-11" onClick={() => setOfferOpen(true)} data-offer-open>
                  {tx('Offer a different price', 'Mag-alok ng ibang presyo')}
                </button>
              )}
              <Link to={other} className="link inline-flex min-h-11 items-center" data-choose-another>
                {tx('Choose another baker', 'Pumili ng ibang baker')}
              </Link>
            </div>
          </div>
        )}
        {(cloudConfirm === 'done' || (cloudConfirm === 'idle' && (confirmedHere || mine?.status === 'confirmed'))) && !auto && !quote.bakery.isSample && cloudEnabled() && (
          <ReviewCard orderId={quote.orderId} slug={quote.bakery.slug} bakeryName={quote.bakery.name} customerName={quote.customerName} />
        )}
        <SurveyFinishCard />
        {quote.bakery.isSample && (
          <p className="text-center">
            <Link to={`/b/${quote.bakery.slug}`} className="text-berry underline">
              {tx('Make another request', 'Gumawa ng bagong request')}
            </Link>
          </p>
        )}
      </div>
    </Layout>
  );
}
