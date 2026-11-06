import type { Order } from './types';

export interface Insights {
  requests: number;
  quoted: number;
  confirmed: number;
  conversionPct: number;
  avgQuoteMinutes: number | null;
  avgOrderValue: number | null;
  belowTargetPct: number | null;
  tierMix: Record<'simple' | 'classic' | 'showstopper' | 'custom', number>;
  withBudgetPct: number | null;
  revenueConfirmed: number;
  unpaidConfirmed: number;
}

const CONFIRMED = new Set(['confirmed', 'baking', 'ready', 'done']);

export function computeInsights(orders: Order[], targetMarginPct: number): Insights {
  const quotedOrders = orders.filter((o) => o.quote);
  const confirmed = orders.filter((o) => CONFIRMED.has(o.status));
  const quoteMinutes = quotedOrders
    .map((o) => (Date.parse(o.quote!.approvedAt) - Date.parse(o.createdAt)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0);
  const tierMix = { simple: 0, classic: 0, showstopper: 0, custom: 0 };
  for (const o of orders) tierMix[o.tier] += 1;
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    requests: orders.length,
    quoted: quotedOrders.length,
    confirmed: confirmed.length,
    conversionPct: orders.length ? Math.round((confirmed.length / orders.length) * 100) : 0,
    avgQuoteMinutes: avg(quoteMinutes),
    avgOrderValue: avg(confirmed.map((o) => o.quote?.price ?? 0)),
    belowTargetPct: quotedOrders.length
      ? Math.round((quotedOrders.filter((o) => o.quote!.marginPct + 1e-9 < targetMarginPct).length / quotedOrders.length) * 100)
      : null,
    tierMix,
    withBudgetPct: orders.length ? Math.round((orders.filter((o) => o.budget != null).length / orders.length) * 100) : null,
    revenueConfirmed: confirmed.reduce((a, o) => a + (o.quote?.price ?? 0), 0),
    unpaidConfirmed: confirmed.filter((o) => !o.paid).length,
  };
}

/** Group by event date: this week (Mon-Sun), next week, later, past. */
export function weekBucket(eventDate: string, today: Date): 'past' | 'thisWeek' | 'nextWeek' | 'later' {
  const [y, m, d] = eventDate.split('-').map(Number);
  const ev = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (ev < t) return 'past';
  const dow = (t.getDay() + 6) % 7; // Monday = 0
  const weekStart = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow);
  const nextStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const laterStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 14);
  if (ev < nextStart) return 'thisWeek';
  if (ev < laterStart) return 'nextWeek';
  return 'later';
}

export function addDays(iso: string | Date, days: number): string {
  const base = typeof iso === 'string' ? new Date(`${iso.slice(0, 10)}T00:00:00`) : new Date(iso);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function earliestDate(leadTimeDays: number, today: Date): string {
  return addDays(today, leadTimeDays);
}
