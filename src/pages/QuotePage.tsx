import { celebrate } from '../lib/celebrate';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { Layout } from '../components/Layout';
import { ShareBox } from '../components/ShareBox';
import { Field, Notice, SampleBadge } from '../components/ui';
import { IconHeart } from '../components/icons';
import { formatPeso } from '../domain/money';
import { applyConfirmation, isQuoteExpired, quoteLinkPayload } from '../domain/orders';
import { quoteLinkSchema, type QuoteLink } from '../domain/schemas';
import { repo, useDb } from '../data/store';
import { decodePayload, linkErrorText } from '../lib/codec';
import { confirmLink } from '../lib/links';
import { usePrefs, useTx } from '../lib/prefs';

export default function QuotePage() {
  const { id = '' } = useParams();
  const loc = useLocation();
  const code = new URLSearchParams(loc.search).get('q');
  const db = useDb();
  const tx = useTx();
  const [quote, setQuote] = useState<QuoteLink | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
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
      if (order && bakery) setQuote(quoteLinkPayload(bakery, order));
    })();
    return () => {
      alive = false;
    };
  }, [code, id, db.orders, tx]);

  const mine = db.myRequests.find((r) => r.id === id);

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
              <Notice tone="info" title={tx('Waiting for the baker', 'Hinihintay ang baker')}>
                {tx(`${mine.bakeryName} will send you a quote link in Messenger. Open it to see your final price.`, `Magpapadala si ${mine.bakeryName} ng quote link sa Messenger. Buksan ito para makita ang final na presyo.`)}
              </Notice>
              <p>{mine.summary}</p>
              <ShareBox url={mine.requestLink} message={tx('Hi! Here is my cake request again:', 'Hi po! Ito ulit ang cake request ko:')} title="Cake request" qrLabel="QR" />
            </>
          ) : (
            <Notice tone="info">{tx('No quote here yet. Open the quote link the baker sent you.', 'Wala pang quote dito. Buksan ang quote link na pinadala ng baker.')}</Notice>
          )}
        </div>
      </Layout>
    );
  }
  return <QuoteView quote={quote} />;
}

function QuoteView({ quote }: { quote: QuoteLink }) {
  const tx = useTx();
  const prefs = usePrefs();
  const db = useDb();
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const expired = isQuoteExpired(quote.validUntil);
  const local = db.orders.find((o) => o.id === quote.orderId);
  const confirmedHere = local && ['confirmed', 'baking', 'ready', 'done'].includes(local.status);
  const desc = describeCake(quote.visual, prefs.lang);

  const confirm = async (e?: React.MouseEvent<HTMLElement>) => {
    celebrate(e?.currentTarget);
    const c = { v: 1 as const, orderId: quote.orderId, price: quote.price, confirmedAt: new Date().toISOString(), note: note.slice(0, 300), customerName: quote.customerName };
    setLink(await confirmLink(c));
    // Demo on one device: apply immediately.
    const res = applyConfirmation(repo.get().orders.find((o) => o.id === quote.orderId), c);
    if (res.ok) repo.upsertOrder(res.order);
    repo.updateMyRequest(quote.orderId, { status: 'confirmed' });
  };

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
          <p className="text-sm font-semibold text-ink-soft">{tx('Price from the baker', 'Presyo mula sa baker')}</p>
          <p className="price text-4xl">{formatPeso(quote.price)}</p>
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
              <strong>{tx('For', 'Para sa')}:</strong> {quote.occasion}, {quote.eventDate}
            </li>
            <li>
              <strong>{tx('Valid until', 'Valid hanggang')}:</strong> {quote.validUntil}
            </li>
          </ul>
          {quote.note && (
            <p className="rounded-2xl bg-berry-soft p-3">
              <strong>{tx('Note from the baker', 'Note mula sa baker')}:</strong> {quote.note}
            </p>
          )}
        </div>
        <Notice tone="info" title={tx('About payment', 'Tungkol sa bayad')}>
          {tx('Cakeita never asks for or handles payment. Pay only the baker you are talking to, the way you both agree.', 'Hindi humihingi o humahawak ng bayad ang Cakeita. Sa baker ka lang mismo magbayad, sa paraang napag-usapan ninyo.')}
        </Notice>

        {confirmedHere ? (
          <Notice tone="ok" title={tx('Confirmed!', 'Confirmed na!')}>
            {tx('The baker has your confirmation.', 'Natanggap na ng baker ang confirmation mo.')}
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
              message={tx(`Hi ${quote.bakery.name}! I confirm my cake for ${quote.eventDate} at ${formatPeso(quote.price)}.`, `Hi ${quote.bakery.name}! Kinukumpirma ko po ang cake ko para sa ${quote.eventDate}, ${formatPeso(quote.price)}.`)}
            />
          </div>
        ) : (
          <div className="card space-y-3">
            <Field id="cnote" label={tx('Note for the baker (optional)', 'Note para sa baker (optional)')}>
              <textarea id="cnote" className="input min-h-20" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <button type="button" className="btn w-full text-lg" onClick={confirm}>
              <IconHeart /> {tx('This is the one I want', 'Ito ang gusto ko')}
            </button>
            <p className="hint text-center">{tx('Not ready? Just reply to the baker in Messenger.', 'Hindi pa sigurado? Mag-reply lang sa baker sa Messenger.')}</p>
          </div>
        )}
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
