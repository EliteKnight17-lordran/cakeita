import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { describeCake } from '../../cake/describe';
import { CakeView } from '../../cake/CakeView';
import { ShareBox } from '../../components/ShareBox';
import { Chip, Field, Notice } from '../../components/ui';
import { IconCheck, IconPen, IconPrint } from '../../components/icons';
import { normalizeSelection } from '../../domain/designs';
import { addDays } from '../../domain/insights';
import { formatPeso } from '../../domain/money';
import { answerOffer, approveOrder, declineOrder, quoteLinkPayload } from '../../domain/orders';
import { evaluatePrice, priceSelection, toPublicMenu } from '../../domain/pricing';
import { formatQty, shoppingForOrder } from '../../domain/shopping';
import type { Bakery, CakeLook, Order, Selection } from '../../domain/types';
import { toVisual } from '../../domain/visual';
import { repo, useDb } from '../../data/store';
import { copyText, quoteLink } from '../../lib/links';
import { usePrefs, useTx } from '../../lib/prefs';
import { Customizer } from '../CustomerFlow';
import { celebrate } from '../../lib/celebrate';
import { currentUid } from '../../cloud/account';
import { cloudEnabled } from '../../cloud/config';
import { BakerShell } from './BakerShell';
import { ownText } from '../../domain/placement';
import { StatusTag } from './Inbox';

export default function OrderDetail() {
  const { id = '' } = useParams();
  const db = useDb();
  const tx = useTx();
  const order = db.orders.find((o) => o.id === id);
  if (!db.bakery) return <BakerShell>{null}</BakerShell>;
  if (!order) {
    return (
      <BakerShell>
        <Notice tone="warn" title={tx('Order not found', 'Hindi makita ang order')}>
          <Link to="/baker" className="underline">
            {tx('Back to requests', 'Bumalik sa requests')}
          </Link>
        </Notice>
      </BakerShell>
    );
  }
  return (
    <BakerShell>
      <Detail key={order.id} bakery={db.bakery} order={order} />
    </BakerShell>
  );
}

function Detail({ bakery, order }: { bakery: Bakery; order: Order }) {
  const tx = useTx();
  const prefs = usePrefs();
  const nav = useNavigate();
  const menu = useMemo(() => toPublicMenu(bakery), [bakery]);
  const [selection, setSelection] = useState<Selection>(() => normalizeSelection(menu, order.quote?.selection ?? order.selection).selection);
  const [look, setLook] = useState<CakeLook>(order.quote?.look ?? order.look);
  const [priceText, setPriceText] = useState<string>('');
  const [note, setNote] = useState(order.quote?.note ?? '');
  const [validDays, setValidDays] = useState(3);
  const [editing, setEditing] = useState(order.status === 'new');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const quote = priceSelection(bakery, selection);
  const suggested = quote?.suggestedPrice ?? 0;
  const price = priceText.trim() ? Math.max(0, Math.round(Number(priceText))) : suggested;
  const ev = evaluatePrice(price, quote?.costTotal ?? 0, bakery.targetMarginPct);
  const visual = toVisual(menu, selection, look);
  const desc = describeCake(visual, prefs.lang);
  const confirmed = ['confirmed', 'baking', 'ready', 'done'].includes(order.status);
  const tooSoon = order.eventDate < addDays(new Date(order.createdAt), bakery.leadTimeDays);

  useEffect(() => {
    let alive = true;
    const payload = quoteLinkPayload(bakery, order);
    if (payload && !editing) quoteLink(payload).then((l) => alive && setLink(l));
    return () => {
      alive = false;
    };
  }, [bakery, order, editing]);

  const approve = (e?: React.MouseEvent<HTMLElement>) => {
    celebrate(e?.currentTarget);
    const next = approveOrder(bakery, order, { selection, look, price, note, validDays });
    repo.upsertOrder(next);
    setEditing(false);
  };

  const replyByHand = async () => {
    const msg = tx(
      `Hi ${order.customer.name.split(' ')[0]}! Thanks for your request. For ${order.servings} people, a ${desc.toLowerCase()} would be ${formatPeso(price)}. Let me know if you want changes!`,
      `Hi ${order.customer.name.split(' ')[0]}! Salamat sa request. Para sa ${order.servings} tao, ang ${desc.toLowerCase()} ay ${formatPeso(price)}. Sabihin lang kung may gusto kang baguhin!`,
    );
    setCopied((await copyText(msg)) ? tx('Reply copied. Paste it in Messenger.', 'Na-copy ang reply. I-paste sa Messenger.') : '');
  };

  const REASONS: Array<[string, string]> = [
    [tx(`We're fully booked on ${order.eventDate}.`, `Puno na kami sa ${order.eventDate}.`), tx('Fully booked', 'Puno na')],
    [tx(`We need ${bakery.leadTimeDays} days' notice, so your date is too soon.`, `Kailangan namin ng ${bakery.leadTimeDays} araw na abiso, kaya masyadong maaga ang petsa mo.`), tx('Too soon', 'Masyadong maaga')],
    [tx("We don't make this kind of design.", 'Hindi namin ginagawa ang ganitong design.'), tx("Don't make this", 'Hindi namin ginagawa')],
    [tx("We can't make it work for this budget.", 'Hindi namin kaya sa budget na ito.'), tx('Budget too low', 'Kulang ang budget')],
  ];

  const decline = async () => {
    const why = reason.trim();
    const msg = tx(
      `Hi ${order.customer.name.split(' ')[0]}! Thank you for thinking of us. Sorry, we can't take this order for ${order.eventDate}.${why ? ` ${why}` : ''} We hope to bake for you next time!`,
      `Hi ${order.customer.name.split(' ')[0]}! Salamat sa pag-message. Pasensya na, hindi namin kaya ang order para sa ${order.eventDate}.${why ? ` ${why}` : ''} Sana makapag-bake kami para sa iyo sa susunod!`,
    );
    const ok = await copyText(msg);
    repo.upsertOrder(declineOrder(order, why));
    setDeclining(false);
    setCopied(
      order.source === 'cloud' || order.source === 'same-device'
        ? tx('Sent. The customer sees your reason in Cakeita. A polite reply is also copied for Messenger.', 'Naipadala. Makikita ng customer ang dahilan mo sa Cakeita. Na-copy din ang magalang na reply para sa Messenger.')
        : ok
          ? tx('Polite reply copied. Paste it in Messenger.', 'Na-copy ang magalang na reply. I-paste sa Messenger.')
          : '',
    );
  };

  const answer = (accept: boolean) => {
    repo.upsertOrder(answerOffer(bakery, order, accept));
  };

  const remove = () => {
    if (window.confirm(tx('Delete this order from this device?', 'Burahin ang order na ito sa device na ito?'))) {
      repo.removeOrder(order.id);
      nav('/baker');
    }
  };

  const shopping = shoppingForOrder(bakery, order);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to={confirmed ? '/baker/board' : '/baker'} className="text-sm text-berry underline">
            ← {tx('Back', 'Bumalik')}
          </Link>
          <h1 className="font-display text-3xl font-semibold">{order.customer.name}</h1>
          <p className="text-ink-soft">
            {order.customer.contact} · {order.source === 'pasted-dm' ? tx('pasted DM', 'pasted DM') : tx('from your link', 'galing sa link mo')}
          </p>
        </div>
        <StatusTag status={order.status} />
      </div>

      <dl className="card grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-ink-soft">{tx('Occasion', 'Okasyon')}</dt>
          <dd className="font-bold">{order.occasion}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{tx('Date', 'Petsa')}</dt>
          <dd className="font-bold">{order.eventDate}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">{tx('People', 'Tao')}</dt>
          <dd className="font-bold">{order.servings}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-soft">Budget</dt>
          <dd className="font-bold">{order.budget != null ? formatPeso(order.budget) : tx('none given', 'wala')}</dd>
        </div>
      </dl>

      {order.description && (
        <blockquote className="rounded-2xl border-l-4 border-berry bg-white p-3 whitespace-pre-wrap">
          <p className="text-sm font-bold text-ink-soft">{tx('Customer wrote', 'Sabi ng customer')}</p>
          {order.description}
        </blockquote>
      )}
      {order.unavailable.length > 0 && (
        <Notice tone="warn" title={tx('You do not make:', 'Hindi mo ito ginagawa:')}>
          {order.unavailable.join(', ')}. {tx('The design uses your closest options. Tell the customer.', 'Ginamit ang pinakamalapit mong option. Sabihan ang customer.')}
        </Notice>
      )}
      {order.licensedNote && <Notice tone="warn" title={tx('Character request', 'May character')}>{order.licensedNote}</Notice>}
      {order.look.own?.length ? <Notice tone="info" title={tx('Customer brings their own', 'May dadalhin ang customer')}><span data-own-baker>{ownText(order.look.own, prefs.lang)} {tx('Not included in your price. Ask for its size before the bake.', 'Hindi kasama sa presyo mo. Itanong ang laki bago mag-bake.')}</span></Notice> : null}
      {tooSoon && <Notice tone="warn">{tx(`Event is sooner than your ${bakery.leadTimeDays}-day notice.`, `Mas maaga sa ${bakery.leadTimeDays} araw na abiso mo ang event.`)}</Notice>}
      {order.hasInspoPhoto && <InspoPhoto order={order} />}
      {order.customerNote && <Notice tone="ok" title={tx('Customer note', 'Note ng customer')}>{order.customerNote}</Notice>}
      {order.status === 'declined' && (
        <Notice tone="info" title={tx('You said no to this one', 'Tinanggihan mo ito')}>
          {order.declineReason || tx('No reason given.', 'Walang dahilan.')} {tx('You can still approve a quote below if you change your mind.', 'Puwede ka pang mag-approve sa baba kung magbago ang isip mo.')}
        </Notice>
      )}
      {order.offer && order.quote && order.status === 'quoted' && order.offer.answer === 'pending' && (
        <OfferCard bakery={bakery} quoted={order.quote.price} cost={order.quote.cost} offer={order.offer} onAnswer={answer} />
      )}
      {order.offer && order.offer.answer !== 'pending' && (
        <p className="text-sm text-ink-soft" data-offer-answered>
          {order.offer.answer === 'accepted'
            ? tx(`You accepted the customer's offer of ${formatPeso(order.offer.price)}.`, `Tinanggap mo ang alok ng customer na ${formatPeso(order.offer.price)}.`)
            : tx(`You kept your price. The customer offered ${formatPeso(order.offer.price)}.`, `Hindi mo binago ang presyo. Nag-alok ang customer ng ${formatPeso(order.offer.price)}.`)}
        </p>
      )}

      <CakeView visual={visual} description={desc} />

      {editing && !confirmed && (
        <details className="card" open={order.source === 'pasted-dm'}>
          <summary className="cursor-pointer font-display text-xl font-semibold">{tx('Edit parts', 'I-edit ang parts')}</summary>
          <div className="mt-3">
            <Customizer menu={menu} selection={selection} look={look} servings={order.servings} showPrices onChange={(s, l) => { setSelection(s); setLook(l); setPriceText(''); }} />
          </div>
        </details>
      )}

      {quote && (
        <section className="card space-y-2" aria-labelledby="bd-h">
          <h2 id="bd-h" className="font-display text-xl font-semibold">
            {tx('Price breakdown', 'Breakdown ng presyo')}
          </h2>
          <table className="w-full text-left text-[0.95rem]">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="py-1 font-semibold">{tx('Part', 'Part')}</th>
                <th className="py-1 text-right font-semibold">{tx('Cost', 'Gastos')}</th>
                <th className="py-1 text-right font-semibold">{tx('Price', 'Presyo')}</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((l) => (
                <tr key={l.id} className="border-b border-line/60">
                  <td className="py-1">
                    {l.name}
                    {l.factor !== 1 && <span className="text-xs text-ink-soft"> ×{l.factor}</span>}
                  </td>
                  <td className="py-1 text-right">{formatPeso(l.cost)}</td>
                  <td className="py-1 text-right">{formatPeso(l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-2 gap-1 text-[0.95rem]">
            <dt>{tx('Ingredients', 'Sangkap')}</dt>
            <dd className="text-right">{formatPeso(quote.ingredientsTotal)}</dd>
            <dt>{tx('Your labor', 'Labor mo')}</dt>
            <dd className="text-right">{formatPeso(quote.laborTotal)}</dd>
            <dt>{tx('Bought-in extras', 'Binili na extras')}</dt>
            <dd className="text-right">{formatPeso(quote.extrasTotal)}</dd>
            <dt className="font-bold">{tx('Total cost', 'Kabuuang gastos')}</dt>
            <dd className="text-right font-bold">{formatPeso(quote.costTotal)}</dd>
            <dt className="font-bold">{tx(`Suggested price (${bakery.targetMarginPct}% margin, rounded up to ₱50)`, `Suggested price (${bakery.targetMarginPct}% tubo, rounded up sa ₱50)`)}</dt>
            <dd className="text-right font-bold">{formatPeso(suggested)}</dd>
          </dl>
          {quote.minApplied && <p className="text-sm text-ink-soft">{tx('Your minimum order price was applied.', 'Ginamit ang minimum order price mo.')}</p>}
          {quote.missingPrices.length > 0 && (
            <Notice tone="warn" title={tx('Some ingredients have no price', 'May sangkap na walang presyo')}>
              {quote.missingPrices.join(', ')}. <Link to="/baker/menu" className="underline">{tx('Add prices', 'Lagyan ng presyo')}</Link>
            </Notice>
          )}
        </section>
      )}

      {editing && !confirmed ? (
        <section className="card space-y-3" aria-labelledby="ap-h">
          <h2 id="ap-h" className="font-display text-xl font-semibold">
            {tx('Approve the quote', 'I-approve ang quote')}
          </h2>
          <Field id="price" label={tx('Price to send (₱)', 'Presyong ipapadala (₱)')} hint={tx('Leave as is to use the suggested price.', 'Hayaan lang para gamitin ang suggested price.')}>
            <input id="price" type="number" inputMode="numeric" min={0} step={50} className="input text-xl font-bold" placeholder={String(suggested)} value={priceText} onChange={(e) => setPriceText(e.target.value)} aria-describedby="price-hint" />
          </Field>
          <p aria-live="polite" className="font-semibold">
            {tx('Your margin', 'Tubo mo')}: {ev.marginPct}% ({tx('target', 'target')} {bakery.targetMarginPct}%)
          </p>
          {ev.loss ? (
            <Notice tone="danger" title={tx('You will lose money', 'Lugi ka rito')}>
              {tx(`This price is below your cost of ${formatPeso(quote?.costTotal ?? 0)}.`, `Mas mababa ito sa gastos mong ${formatPeso(quote?.costTotal ?? 0)}.`)}
            </Notice>
          ) : ev.belowTarget ? (
            <Notice tone="danger" title={tx('Below your target margin', 'Mababa sa target mong tubo')}>
              {tx(`Suggested: ${formatPeso(suggested)}. Or offer the customer a simpler design.`, `Suggested: ${formatPeso(suggested)}. O mag-alok ng mas simpleng design.`)}
            </Notice>
          ) : null}
          {order.budget != null && price > order.budget && (
            <Notice tone="info">{tx(`This is ${formatPeso(price - order.budget)} over the customer's budget.`, `Lampas ito ng ${formatPeso(price - order.budget)} sa budget ng customer.`)}</Notice>
          )}
          {order.estimate != null && (
            <p className="text-sm" data-app-estimate>
              {price === Math.round(order.estimate)
                ? tx(`Same as the ${formatPeso(order.estimate)} the customer saw in the app: this accepts their request.`, `Pareho sa ${formatPeso(order.estimate)} na nakita ng customer sa app: tatanggapin nito ang request nila.`)
                : tx(`The customer saw ${formatPeso(order.estimate)} in the app, so this goes to them as your counter-offer.`, `${formatPeso(order.estimate)} ang nakita ng customer sa app, kaya alok mo itong ibang presyo.`)}
            </p>
          )}
          <Field id="qnote" label={tx('Note to the customer (optional)', 'Note sa customer (optional)')}>
            <textarea id="qnote" className="input min-h-20" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('e.g. 50% down payment to reserve the date', 'hal. 50% down payment para ma-reserve ang petsa')} />
          </Field>
          <Field id="valid" label={tx('Quote valid for (days)', 'Valid ang quote nang (araw)')}>
            <input id="valid" type="number" min={1} max={30} className="input" value={validDays} onChange={(e) => setValidDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
          </Field>
          <button type="button" className="btn w-full text-lg" onClick={approve} disabled={!quote || price <= 0}>
            <IconCheck />{' '}
            {order.estimate == null
              ? `${tx('Approve', 'I-approve')} ${formatPeso(price)}`
              : price === Math.round(order.estimate)
                ? tx(`Accept at ${formatPeso(price)}`, `Tanggapin sa ${formatPeso(price)}`)
                : tx(`Send counter-offer ${formatPeso(price)}`, `Ipadala ang alok na ${formatPeso(price)}`)}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={replyByHand}>
              <IconPen /> {tx('Reply by hand', 'Sumagot nang manual')}
            </button>
            {order.status !== 'declined' && (
              <button type="button" className="btn-ghost" onClick={() => setDeclining((d) => !d)} aria-expanded={declining} data-decline-open>
                {tx('Decline politely', 'Tanggihan nang magalang')}
              </button>
            )}
          </div>
          {declining && (
            <div className="space-y-3 rounded-2xl border border-line p-3" data-decline-form>
              <p className="font-semibold">{tx('Why? The customer sees this, so they can pick another baker.', 'Bakit? Makikita ito ng customer para makapili sila ng ibang baker.')}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Reasons', 'Mga dahilan')}>
                {REASONS.map(([full, label]) => (
                  <Chip key={label} pressed={reason === full} onClick={() => setReason(full)}>
                    {label}
                  </Chip>
                ))}
              </div>
              <Field id="dreason" label={tx('Reason (you can edit it)', 'Dahilan (puwedeng i-edit)')}>
                <input id="dreason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <button type="button" className="btn-danger" onClick={decline} data-send-decline>
                {tx('Send “sorry, we can’t”', 'Ipadala ang “pasensya, hindi namin kaya”')}
              </button>
            </div>
          )}
          <p className="min-h-6 font-semibold text-ok-ink" aria-live="polite">
            {copied}
          </p>
        </section>
      ) : (
        order.quote && (
          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-soft">{tx('Approved price', 'Approved na presyo')}</p>
                <p className="price">{formatPeso(order.quote.price)}</p>
                <p className="text-sm">
                  {tx('Margin', 'Tubo')} {order.quote.marginPct}% · {tx('valid until', 'valid hanggang')} {order.quote.validUntil}
                </p>
              </div>
              {!confirmed && (
                <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
                  {tx('Edit quote', 'I-edit ang quote')}
                </button>
              )}
            </div>
            {!confirmed && link && (
              <>
                <p className="font-bold">{tx('Send the quote to the customer', 'Ipadala ang quote sa customer')}</p>
                <ShareBox
                  url={link}
                  title="Cake quote"
                  qrLabel={tx('QR code of the quote', 'QR code ng quote')}
                  message={tx(
                    `Hi ${order.customer.name.split(' ')[0]}! Here's the quote for your cake: ${formatPeso(order.quote.price)}, valid until ${order.quote.validUntil}. See the design and confirm here:`,
                    `Hi ${order.customer.name.split(' ')[0]}! Ito na po ang quote para sa cake mo: ${formatPeso(order.quote.price)}, valid hanggang ${order.quote.validUntil}. Tingnan ang design at i-confirm dito:`,
                  )}
                />
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => repo.updateOrder(order.id, { status: 'confirmed', confirmedAt: new Date().toISOString() }, { type: 'confirmed', detail: 'by baker (customer confirmed in chat)' })}
                >
                  {tx('Customer said yes in chat: mark confirmed', 'Pumayag na sa chat: i-mark na confirmed')}
                </button>
              </>
            )}
          </section>
        )
      )}

      {confirmed && (
        <section className="card space-y-3" aria-labelledby="tk-h">
          <h2 id="tk-h" className="font-display text-xl font-semibold">
            {tx('Order ticket', 'Order ticket')}
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Status', 'Status')}>
            {(['confirmed', 'baking', 'ready', 'done'] as const).map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={order.status === s} onClick={() => repo.updateOrder(order.id, { status: s }, { type: s })}>
                {{ confirmed: tx('Confirmed', 'Confirmed'), baking: tx('Baking', 'Bine-bake'), ready: tx('Ready', 'Handa na'), done: tx('Done', 'Tapos') }[s]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-lg font-bold">
            <input type="checkbox" className="h-7 w-7 accent-[#155a2b]" checked={order.paid} onChange={(e) => repo.updateOrder(order.id, { paid: e.target.checked }, { type: e.target.checked ? 'paid' : 'unpaid' })} />
            {tx('Paid (recorded by you)', 'Bayad na (ikaw ang nag-record)')}
          </label>
          <p className="text-sm text-ink-soft">{tx('Cakeita only records what you tick. It never takes payments.', 'Itinatala lang ng Cakeita ang tsine-check mo. Hindi ito tumatanggap ng bayad.')}</p>
          <h3 className="font-bold">{tx('Shopping list for this cake', 'Bibilhin para sa cake na ito')}</h3>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {shopping.map((s) => (
              <li key={s.ingredientId} className="flex justify-between rounded-xl bg-cream px-3 py-1">
                <span>{s.name}</span>
                <span className="font-semibold">{formatQty(s.qty, s.unit)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            <IconPrint /> {tx('Print ticket', 'I-print ang ticket')}
          </button>
        </section>
      )}

      <section className="no-print flex flex-wrap gap-2">
        {confirmed && order.status !== 'done' && (
          <button type="button" className="btn-danger" onClick={() => window.confirm(tx('Cancel this order?', 'Kanselahin ang order?')) && repo.updateOrder(order.id, { status: 'cancelled' }, { type: 'cancelled' })}>
            {tx('Cancel order', 'Kanselahin')}
          </button>
        )}
        <button type="button" className="btn-danger" onClick={remove}>
          {tx('Delete', 'Burahin')}
        </button>
      </section>

      {order.history.length > 0 && (
        <details className="text-sm text-ink-soft">
          <summary className="cursor-pointer">{tx('History', 'History')}</summary>
          <ul className="mt-1 space-y-1">
            {order.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString()} · {h.type}
                {h.detail ? ` · ${h.detail}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The customer's inspo photo: fetched from the cloud inbox when it came with the request. */
function InspoPhoto({ order }: { order: Order }) {
  const tx = useTx();
  const [photo, setPhoto] = useState<string | null | 'loading'>(order.source === 'cloud' && cloudEnabled() && currentUid() ? 'loading' : null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (photo !== 'loading') return;
    let alive = true;
    import('../../cloud/data')
      .then((m) => m.loadRequestPhoto(order.id))
      .then((p) => alive && setPhoto(p), () => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (photo === 'loading') return <p className="text-sm text-ink-soft">{tx('Loading the inspo photo…', 'Nilo-load ang inspo photo…')}</p>;
  if (!photo) return <Notice tone="info">{tx('The customer has an inspo photo. Ask them to send it in Messenger.', 'May inspo photo ang customer. Hingin sa Messenger.')}</Notice>;
  return (
    <figure className="card space-y-2">
      <figcaption className="font-display text-lg">{tx("Customer's inspo photo", 'Inspo photo ng customer')}</figcaption>
      <button type="button" className="block w-full" onClick={() => setBig((b) => !b)} aria-expanded={big} aria-label={big ? tx('Make the photo smaller', 'Paliitin ang photo') : tx('Make the photo bigger', 'Palakihin ang photo')}>
        <img src={photo} alt={tx('Inspo photo sent by the customer', 'Inspo photo na pinadala ng customer')} className={`mx-auto rounded-xl object-contain ${big ? 'max-h-[80vh]' : 'max-h-64'}`} />
      </button>
      <p className="text-sm text-ink-soft">{tx('Price from your menu, not the photo. The photo may show more than the budget allows.', 'Sa menu mo ang presyo, hindi sa photo. Puwedeng mas mahal ang nasa photo kaysa sa budget.')}</p>
    </figure>
  );
}

/** The customer's one counter-offer: accept it or keep your price. Both are final. */
function OfferCard({ bakery, quoted, cost, offer, onAnswer }: { bakery: Bakery; quoted: number; cost: number; offer: NonNullable<Order['offer']>; onAnswer: (accept: boolean) => void }) {
  const tx = useTx();
  const ev = evaluatePrice(offer.price, cost, bakery.targetMarginPct);
  return (
    <section className="card space-y-3 !border-amber-ink" aria-labelledby="offer-h" data-offer-card>
      <h2 id="offer-h" className="font-display text-xl font-semibold">
        {tx(`The customer offers ${formatPeso(offer.price)}`, `Nag-aalok ang customer ng ${formatPeso(offer.price)}`)}
      </h2>
      <p>
        {tx(`Your quote was ${formatPeso(quoted)}.`, `${formatPeso(quoted)} ang quote mo.`)} {offer.note && <span>“{offer.note}”</span>}
      </p>
      <p className="font-semibold" aria-live="polite">
        {tx('Your margin at their price', 'Tubo mo sa presyo nila')}: {ev.marginPct}% ({tx('target', 'target')} {bakery.targetMarginPct}%)
      </p>
      {ev.loss ? (
        <Notice tone="danger" title={tx('You will lose money', 'Lugi ka rito')}>{tx(`Below your cost of ${formatPeso(cost)}.`, `Mas mababa sa gastos mong ${formatPeso(cost)}.`)}</Notice>
      ) : ev.belowTarget ? (
        <Notice tone="warn">{tx('Below your target margin, but not a loss.', 'Mababa sa target mong tubo, pero hindi lugi.')}</Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => onAnswer(true)} data-offer-accept>
          <IconCheck /> {tx(`Accept ${formatPeso(offer.price)}`, `Tanggapin ang ${formatPeso(offer.price)}`)}
        </button>
        <button type="button" className="btn-secondary" onClick={() => onAnswer(false)} data-offer-keep>
          {tx(`Keep ${formatPeso(quoted)}`, `Manatili sa ${formatPeso(quoted)}`)}
        </button>
      </div>
      <p className="text-sm text-ink-soft">{tx('One offer each way: your answer is final, and the customer can then confirm or choose another baker.', 'Isang alok bawat panig: final ang sagot mo, tapos puwedeng mag-confirm o pumili ng ibang baker ang customer.')}</p>
    </section>
  );
}
