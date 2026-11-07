import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { describeCake } from '../../cake/describe';
import { CakeView } from '../../cake/CakeView';
import { ShareBox } from '../../components/ShareBox';
import { Field, Notice } from '../../components/ui';
import { normalizeSelection } from '../../domain/designs';
import { addDays } from '../../domain/insights';
import { formatPeso } from '../../domain/money';
import { popConfetti } from '../../lib/confetti';
import { approveOrder, quoteLinkPayload } from '../../domain/orders';
import { evaluatePrice, priceSelection, toPublicMenu } from '../../domain/pricing';
import { formatQty, shoppingForOrder } from '../../domain/shopping';
import type { Bakery, CakeLook, Order, Selection } from '../../domain/types';
import { toVisual } from '../../domain/visual';
import { repo, useDb } from '../../data/store';
import { copyText, quoteLink } from '../../lib/links';
import { usePrefs, useTx } from '../../lib/prefs';
import { Customizer } from '../CustomerFlow';
import { BakerShell } from './BakerShell';
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

  const approve = () => {
    const next = approveOrder(bakery, order, { selection, look, price, note, validDays });
    repo.upsertOrder(next);
    setEditing(false);
    popConfetti();
  };

  const replyByHand = async () => {
    const msg = tx(
      `Hi ${order.customer.name.split(' ')[0]}! Thanks for your request. For ${order.servings} people, a ${desc.toLowerCase()} would be ${formatPeso(price)}. Let me know if you want changes!`,
      `Hi ${order.customer.name.split(' ')[0]}! Salamat sa request. Para sa ${order.servings} tao, ang ${desc.toLowerCase()} ay ${formatPeso(price)}. Sabihin lang kung may gusto kang baguhin!`,
    );
    setCopied((await copyText(msg)) ? tx('Reply copied. Paste it in Messenger.', 'Na-copy ang reply. I-paste sa Messenger.') : '');
  };

  const decline = async () => {
    const msg = tx(
      `Hi ${order.customer.name.split(' ')[0]}! Thank you for thinking of us. Sorry, we can't take this order for ${order.eventDate}. We hope to bake for you next time!`,
      `Hi ${order.customer.name.split(' ')[0]}! Salamat sa pag-message. Pasensya na, hindi namin kaya ang order para sa ${order.eventDate}. Sana makapag-bake kami para sa iyo sa susunod!`,
    );
    await copyText(msg);
    repo.updateOrder(order.id, { status: 'declined' }, { type: 'declined' });
    setCopied(tx('Polite reply copied. Paste it in Messenger.', 'Na-copy ang magalang na reply. I-paste sa Messenger.'));
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
          <h1 className="font-display text-3xl font-bold">{order.customer.name}</h1>
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
      {tooSoon && <Notice tone="warn">{tx(`Event is sooner than your ${bakery.leadTimeDays}-day notice.`, `Mas maaga sa ${bakery.leadTimeDays} araw na abiso mo ang event.`)}</Notice>}
      {order.hasInspoPhoto && <Notice tone="info">{tx('The customer has an inspo photo. Ask them to send it in Messenger.', 'May inspo photo ang customer. Hingin sa Messenger.')}</Notice>}
      {order.customerNote && <Notice tone="ok" title={tx('Customer note', 'Note ng customer')}>{order.customerNote}</Notice>}

      <CakeView visual={visual} description={desc} />

      {editing && !confirmed && (
        <details className="card" open={order.source === 'pasted-dm'}>
          <summary className="cursor-pointer font-display text-xl font-bold">{tx('Edit parts', 'I-edit ang parts')}</summary>
          <div className="mt-3">
            <Customizer menu={menu} selection={selection} look={look} servings={order.servings} showPrices onChange={(s, l) => { setSelection(s); setLook(l); setPriceText(''); }} />
          </div>
        </details>
      )}

      {quote && (
        <section className="card space-y-2" aria-labelledby="bd-h">
          <h2 id="bd-h" className="font-display text-xl font-bold">
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
          <h2 id="ap-h" className="font-display text-xl font-bold">
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
          <Field id="qnote" label={tx('Note to the customer (optional)', 'Note sa customer (optional)')}>
            <textarea id="qnote" className="input min-h-20" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('e.g. 50% down payment to reserve the date', 'hal. 50% down payment para ma-reserve ang petsa')} />
          </Field>
          <Field id="valid" label={tx('Quote valid for (days)', 'Valid ang quote nang (araw)')}>
            <input id="valid" type="number" min={1} max={30} className="input" value={validDays} onChange={(e) => setValidDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
          </Field>
          <button type="button" className="btn w-full text-lg" onClick={approve} disabled={!quote || price <= 0}>
            ✅ {tx('Approve', 'I-approve')} {formatPeso(price)}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={replyByHand}>
              ✍️ {tx('Reply by hand', 'Sumagot nang manual')}
            </button>
            <button type="button" className="btn-ghost" onClick={decline}>
              {tx('Decline politely', 'Tanggihan nang magalang')}
            </button>
          </div>
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
          <h2 id="tk-h" className="font-display text-xl font-bold">
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
            🖨 {tx('Print ticket', 'I-print ang ticket')}
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
