import { useEffect, useState } from 'react';
import { RatingLine } from '../../components/ReviewCard';
import { Notice } from '../../components/ui';
import { cloudEnabled } from '../../cloud/config';
import { summarize, type RatingSummary } from '../../domain/reviews';
import { computeInsights } from '../../domain/insights';
import { formatPeso } from '../../domain/money';
import { useDb } from '../../data/store';
import { useTx } from '../../lib/prefs';
import { BakerShell } from './BakerShell';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm font-semibold text-ink-soft">{label}</p>
      <p className="font-display text-3xl font-semibold">{value}</p>
      {sub && <p className="text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

export default function Insights() {
  const db = useDb();
  const tx = useTx();
  if (!db.bakery) return null;
  const i = computeInsights(db.orders, db.bakery.targetMarginPct);
  const mixTotal = Object.values(i.tierMix).reduce((a, b) => a + b, 0) || 1;
  const mix: Array<[string, number, string]> = [
    ['Simple', i.tierMix.simple, '#e9b9c9'],
    ['Classic', i.tierMix.classic, '#c94a78'],
    ['Showstopper', i.tierMix.showstopper, '#8e0f3d'],
    [tx('Custom', 'Custom'), i.tierMix.custom, '#6b4a52'],
  ];
  return (
    <BakerShell>
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-semibold">Insights</h1>
        {i.requests === 0 && <Notice tone="info">{tx('Numbers appear after your first requests.', 'Lalabas ang mga numero pagkatapos ng unang requests.')}</Notice>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={tx('Requests', 'Requests')} value={String(i.requests)} sub={`${i.quoted} ${tx('quoted', 'na-quote')}`} />
          <Stat label={tx('Confirmed', 'Confirmed')} value={String(i.confirmed)} sub={`${i.conversionPct}% ${tx('of requests', 'ng requests')}`} />
          <Stat label={tx('Avg. time to quote', 'Avg. oras bago ma-quote')} value={i.avgQuoteMinutes == null ? '–' : `${i.avgQuoteMinutes} min`} />
          <Stat label={tx('Avg. order value', 'Avg. halaga ng order')} value={i.avgOrderValue == null ? '–' : formatPeso(i.avgOrderValue)} />
          <Stat label={tx('Quotes below target margin', 'Quotes na mababa sa target')} value={i.belowTargetPct == null ? '–' : `${i.belowTargetPct}%`} sub={tx(`target ${db.bakery.targetMarginPct}%`, `target ${db.bakery.targetMarginPct}%`)} />
          <Stat label={tx('Requests with a budget', 'Requests na may budget')} value={i.withBudgetPct == null ? '–' : `${i.withBudgetPct}%`} />
          <Stat label={tx('Confirmed sales', 'Confirmed na benta')} value={formatPeso(i.revenueConfirmed)} sub={`${i.unpaidConfirmed} ${tx('not marked paid', 'hindi pa bayad')}`} />
        </div>
        {db.bakery.cloudUid && !db.bakery.isSample && <MyReviews slug={db.bakery.slug} />}
        <section className="card space-y-3" aria-labelledby="mix-h">
          <h2 id="mix-h" className="font-display text-xl font-semibold">
            {tx('Which design customers pick', 'Aling design ang pinipili')}
          </h2>
          <div className="flex h-6 w-full overflow-hidden rounded-full bg-berry-soft" role="img" aria-label={mix.map(([n, c]) => `${n} ${c}`).join(', ')}>
            {mix.map(([n, c, color]) => (c ? <div key={n} style={{ width: `${(c / mixTotal) * 100}%`, background: color }} /> : null))}
          </div>
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {mix.map(([n, c, color]) => (
              <li key={n} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden="true" /> {n}: <strong>{c}</strong>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-soft">{tx('If most people pick Classic, it is your best seller. Price it with care.', 'Kung Classic ang madalas piliin, iyan ang best seller mo. Ingatan ang presyo nito.')}</p>
        </section>
      </div>
    </BakerShell>
  );
}

/** What customers said, from confirmed orders only. Bakers can read but not remove them. */
function MyReviews({ slug }: { slug: string }) {
  const tx = useTx();
  const [r, setR] = useState<RatingSummary | null | undefined>(undefined);
  useEffect(() => {
    if (!cloudEnabled()) return;
    let alive = true;
    import('../../cloud/data')
      .then((m) => m.fetchReviews([slug]))
      .then((list) => alive && setR(summarize(list)))
      .catch(() => alive && setR(null));
    return () => {
      alive = false;
    };
  }, [slug]);
  if (r === undefined) return null;
  return (
    <section className="card space-y-2" aria-labelledby="rev-h" data-my-reviews>
      <h2 id="rev-h" className="font-display text-xl font-semibold">{tx('Your reviews', 'Mga review mo')}</h2>
      {!r ? (
        <p className="text-ink-soft">{tx('No reviews yet. Customers can rate you after they confirm an order.', 'Wala pang review. Puwedeng mag-rate ang customer pagkatapos nilang mag-confirm ng order.')}</p>
      ) : (
        <>
          <RatingLine avg={r.avg} count={r.count} />
          <ul className="space-y-2 text-sm">
            {r.latest.map((x) => (
              <li key={`${x.name}-${x.createdAt}`}>
                <span className="font-semibold">{x.stars}/5 · {x.name}</span>
                {x.text && <p className="text-ink-soft">“{x.text}”</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
