import { useState } from 'react';
import { Notice } from '../../components/ui';
import { IconPrint } from '../../components/icons';
import { weekBucket } from '../../domain/insights';
import { formatPeso } from '../../domain/money';
import { combinedShopping, formatQty } from '../../domain/shopping';
import { useDb } from '../../data/store';
import { useTx } from '../../lib/prefs';
import { BakerShell } from './BakerShell';
import { OrderRow } from './Inbox';

const ACTIVE = new Set(['confirmed', 'baking', 'ready']);

export default function Board() {
  const db = useDb();
  const tx = useTx();
  const [showList, setShowList] = useState(false);
  const today = new Date();
  const active = db.orders.filter((o) => ACTIVE.has(o.status)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const groups = {
    thisWeek: active.filter((o) => weekBucket(o.eventDate, today) === 'thisWeek'),
    nextWeek: active.filter((o) => weekBucket(o.eventDate, today) === 'nextWeek'),
    later: active.filter((o) => weekBucket(o.eventDate, today) === 'later'),
    past: active.filter((o) => weekBucket(o.eventDate, today) === 'past'),
  };
  const done = db.orders.filter((o) => o.status === 'done' || o.status === 'cancelled' || o.status === 'declined');
  const week = [...groups.thisWeek, ...groups.past];
  const list = db.bakery ? combinedShopping(db.bakery, week) : [];
  const unpaid = active.filter((o) => !o.paid);

  const section = (title: string, items: typeof active) =>
    items.length > 0 && (
      <section className="space-y-2" aria-label={title}>
        <h2 className="font-display text-xl font-semibold">
          {title} <span className="text-base text-ink-soft">({items.length})</span>
        </h2>
        <ul className="space-y-2">
          {items.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </ul>
      </section>
    );

  return (
    <BakerShell>
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-semibold">{tx('Order board', 'Order board')}</h1>
        {active.length === 0 ? (
          <Notice tone="info">{tx('No confirmed orders yet. Approved quotes appear here once customers confirm.', 'Wala pang confirmed na order. Lalabas dito kapag nag-confirm ang customer.')}</Notice>
        ) : (
          <>
            {unpaid.length > 0 && (
              <Notice tone="warn">
                {tx(`${unpaid.length} confirmed order(s) not marked paid yet: ${formatPeso(unpaid.reduce((a, o) => a + (o.quote?.price ?? 0), 0))}.`, `${unpaid.length} confirmed order na hindi pa naka-mark na bayad: ${formatPeso(unpaid.reduce((a, o) => a + (o.quote?.price ?? 0), 0))}.`)}
              </Notice>
            )}
            {section(tx('Past date, still open', 'Lampas na ang petsa, bukas pa'), groups.past)}
            {section(tx('This week', 'Ngayong linggo'), groups.thisWeek)}
            {section(tx('Next week', 'Susunod na linggo'), groups.nextWeek)}
            {section(tx('Later', 'Sa susunod pa'), groups.later)}
            <section className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold">{tx("This week's shopping list", 'Bibilhin ngayong linggo')}</h2>
                <button type="button" className="btn-ghost" aria-expanded={showList} onClick={() => setShowList((s) => !s)}>
                  {showList ? tx('Hide', 'Itago') : tx('Show', 'Ipakita')}
                </button>
              </div>
              {showList &&
                (list.length ? (
                  <>
                    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {list.map((s) => (
                        <li key={s.ingredientId} className="flex justify-between rounded-xl bg-cream px-3 py-1">
                          <span>{s.name}</span>
                          <span className="font-semibold">{formatQty(s.qty, s.unit)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-ink-soft">
                      {tx('About', 'Mga')} {formatPeso(list.reduce((a, s) => a + s.cost, 0))} {tx('at your saved prices.', 'sa naka-save mong presyo.')}
                    </p>
                    <button type="button" className="btn-ghost" onClick={() => window.print()}>
                      <IconPrint /> {tx('Print', 'I-print')}
                    </button>
                  </>
                ) : (
                  <p>{tx('Nothing due this week.', 'Walang due ngayong linggo.')}</p>
                ))}
            </section>
          </>
        )}
        {done.length > 0 && (
          <details>
            <summary className="cursor-pointer font-bold">
              {tx('Finished and closed', 'Tapos at sarado')} ({done.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {done.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </BakerShell>
  );
}
