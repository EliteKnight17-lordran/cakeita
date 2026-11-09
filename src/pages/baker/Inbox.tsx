import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { describeCake } from '../../cake/describe';
import { Cake2D } from '../../cake/Cake2D';
import { Field, Notice } from '../../components/ui';
import { BakerAlerts } from '../../push/PushButtons';
import { IconAlert, IconCalc } from '../../components/icons';
import { formatPeso } from '../../domain/money';
import { toPublicMenu } from '../../domain/pricing';
import type { Order } from '../../domain/types';
import { toVisual } from '../../domain/visual';
import { demoOrders, orderFromMessage } from '../../data/seed';
import { repo, useDb } from '../../data/store';
import { usePrefs, useTx } from '../../lib/prefs';
import { niceDate, niceTime } from '../../lib/dates';
import { BakerShell } from './BakerShell';

export function StatusTag({ status }: { status: Order['status'] }) {
  const tx = useTx();
  const map: Record<Order['status'], [string, string, string]> = {
    new: ['New', 'Bago', 'bg-amber-bg text-amber-ink'],
    quoted: ['Quote sent', 'Na-quote na', 'bg-berry-soft text-berry-dark'],
    confirmed: ['Confirmed', 'Confirmed', 'bg-ok-bg text-ok-ink'],
    baking: ['Baking', 'Bine-bake', 'bg-ok-bg text-ok-ink'],
    ready: ['Ready', 'Handa na', 'bg-ok-bg text-ok-ink'],
    done: ['Done', 'Tapos', 'bg-white text-ink-soft border border-line'],
    declined: ['Declined', 'Hindi tinanggap', 'bg-white text-ink-soft border border-line'],
    cancelled: ['Cancelled', 'Kinansela', 'bg-white text-ink-soft border border-line'],
  };
  const [en, tl, cls] = map[status];
  return <span className={`tag ${cls}`}>{tx(en, tl)}</span>;
}

export function OrderRow({ order }: { order: Order }) {
  const db = useDb();
  const prefs = usePrefs();
  const tx = useTx();
  const menu = toPublicMenu(db.bakery!);
  const v = toVisual(menu, order.quote?.selection ?? order.selection, order.quote?.look ?? order.look);
  return (
    <li>
      <Link to={`/baker/order/${order.id}`} className="card flex items-center gap-3 hover:border-berry">
        <Cake2D visual={v} title={describeCake(v, prefs.lang)} crop className="h-20 w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-bold">{order.customer.name}</p>
            <StatusTag status={order.status} />
            {order.offer?.answer === 'pending' && order.status === 'quoted' && <span className="tag bg-amber-bg text-amber-ink" data-offer-tag>{tx(`Offer ${formatPeso(order.offer.price)}`, `Alok ${formatPeso(order.offer.price)}`)}</span>}
            {order.unavailable.length > 0 && <span className="tag bg-amber-bg text-amber-ink"><IconAlert size={13} /> {order.unavailable.length}</span>}
          </div>
          <p className="text-sm text-ink-soft">
            {order.occasion} · {niceDate(order.eventDate, prefs.lang)}{order.handoffTime ? ` ${niceTime(order.handoffTime)}` : ''} · {order.servings} {tx('people', 'tao')}{order.handoff === 'delivery' ? ' · Delivery' : ''}
          </p>
          <p className="text-sm">
            {order.quote ? <strong>{formatPeso(order.quote.price)}</strong> : order.estimate ? `${tx('Est.', 'Tantya')} ${formatPeso(order.estimate)}` : ''}
            {order.budget != null && <span className="text-ink-soft"> · budget {formatPeso(order.budget)}</span>}
          </p>
        </div>
        <span aria-hidden="true" className="text-2xl text-berry">
          ›
        </span>
      </Link>
    </li>
  );
}

export default function Inbox() {
  const db = useDb();
  const tx = useTx();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [who, setWho] = useState('');
  const bakery = db.bakery;
  const open = db.orders.filter((o) => o.status === 'new' || o.status === 'quoted').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const fromDm = () => {
    if (!bakery || !text.trim()) return;
    const o = orderFromMessage(bakery, text, who.trim() ? { customer: { name: who.trim().slice(0, 80), contact: 'via Messenger' } } : {});
    repo.upsertOrder(o);
    setText('');
    setWho('');
    nav(`/baker/order/${o.id}`);
  };

  const quickQuote = () => {
    if (!bakery) return;
    const o = orderFromMessage(bakery, '', { customer: { name: tx('Walk-in quote', 'Walk-in quote'), contact: '-' } }, 'pasted-dm');
    repo.upsertOrder(o);
    nav(`/baker/order/${o.id}`);
  };

  return (
    <BakerShell>
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-semibold">{tx('Requests', 'Mga request')}</h1>
        <BakerAlerts />

        <section className="card space-y-3" aria-labelledby="dm-h">
          <h2 id="dm-h" className="font-display text-xl font-semibold">
            {tx('Got a DM? Paste it here', 'May DM? I-paste dito')}
          </h2>
          <p className="text-sm text-ink-soft">{tx('Cakeita reads it, picks parts from your menu, and prices it. You check before anything is sent.', 'Babasahin ng Cakeita, pipili ng parts sa menu mo, at ipe-presyo. Ikaw ang magche-check bago ipadala.')}</p>
          <Field id="dm" label={tx('Customer message', 'Message ng customer')}>
            <textarea id="dm" className="input min-h-28" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hi po! Pa-quote ng 2 tier pink cake, 30 pax, budget 2.5k…" />
          </Field>
          <Field id="dmwho" label={tx('Customer name (optional)', 'Pangalan ng customer (optional)')}>
            <input id="dmwho" className="input" maxLength={80} value={who} onChange={(e) => setWho(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn flex-1" disabled={!text.trim()} onClick={fromDm}>
              {tx('Read and price it', 'Basahin at i-presyo')}
            </button>
            <button type="button" className="btn-secondary" onClick={quickQuote}>
              <IconCalc /> {tx('Quick quote', 'Quick quote')}
            </button>
          </div>
        </section>

        <section aria-labelledby="open-h" className="space-y-3">
          <h2 id="open-h" className="font-display text-xl font-semibold">
            {tx('Waiting on you or the customer', 'Naghihintay sa iyo o sa customer')}
          </h2>
          {open.length === 0 ? (
            <div className="space-y-3">
              <Notice tone="info">{tx('No open requests. Share your link so customers can build their cake.', 'Wala pang request. I-share ang link mo para makagawa ng cake ang customer.')}</Notice>
              <div className="flex flex-wrap gap-2">
                <Link to="/baker/share" className="btn-secondary">
                  {tx('Share my link', 'I-share ang link ko')}
                </Link>
                {bakery?.isSample && (
                  <button type="button" className="btn-secondary" onClick={() => demoOrders(bakery).forEach((o) => repo.upsertOrder(o))}>
                    {tx('Load demo requests', 'Mag-load ng demo requests')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {open.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </BakerShell>
  );
}
