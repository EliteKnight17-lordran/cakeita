import { buildDesigns } from '../domain/designs';
import { addDays } from '../domain/insights';
import { motifFor } from '../domain/motifs';
import { approveOrder, requestToOrder } from '../domain/orders';
import { priceSelection, toPublicMenu } from '../domain/pricing';
import { readRequest } from '../domain/requestReader';
import type { Bakery, CakeRequest, Order } from '../domain/types';
import { SCENARIOS, type Scenario } from './demoScenarios';
import { newId } from './store';

/** Turn a typed or pasted message into a draft order with a Classic design. */
export function orderFromMessage(
  bakery: Bakery,
  message: string,
  extra: Partial<Pick<CakeRequest, 'customer' | 'occasion' | 'eventDate' | 'servings' | 'budget'>> = {},
  source: Order['source'] = 'pasted-dm',
  now = new Date(),
): Order {
  const menu = toPublicMenu(bakery, now);
  const r = readRequest(message, menu, now);
  const servings = extra.servings ?? r.servings;
  const budget = extra.budget !== undefined ? extra.budget : r.budget;
  const d = buildDesigns(menu, {
    servings, budget, tiers: r.tiers, sizeIn: r.sizeIn, flavorId: r.flavorId, coveringId: r.coveringId, componentIds: r.componentIds, textOnCake: r.textOnCake,
  });
  const pick = d.options.find((o) => o.tier === 'classic') ?? d.options[0]!;
  const minDate = addDays(now, bakery.leadTimeDays);
  const req: CakeRequest = {
    id: newId('rq'),
    bakerySlug: bakery.slug,
    createdAt: now.toISOString(),
    customer: extra.customer ?? { name: 'Messenger customer', contact: 'via Messenger' },
    occasion: extra.occasion ?? (r.occasion || 'Other'),
    eventDate: extra.eventDate ?? (r.eventDate && r.eventDate >= minDate ? r.eventDate : minDate),
    servings: servings ?? menu.baseCakes.find((b) => b.id === pick.selection.baseCakeId)?.servings ?? 12,
    budget: budget ?? null,
    description: message.slice(0, 1000),
    tier: pick.tier,
    selection: pick.selection,
    look: { colors: r.colors.slice(0, 2).map((c) => c.hex), textOnCake: r.textOnCake.slice(0, 32), candles: r.age ? Math.min(10, r.age) : 1, motif: motifFor(r.theme, extra.occasion ?? r.occasion) },
    theme: r.theme,
    licensedNote: r.licensedNote,
    unavailable: r.unavailable,
    estimate: pick.estimate,
    hasInspoPhoto: false,
    lang: 'tl',
  };
  return requestToOrder(req, source, now);
}

export function scenarioOrder(bakery: Bakery, s: Scenario, now = new Date()): Order {
  return orderFromMessage(
    bakery,
    s.message,
    { customer: s.customer, occasion: s.occasion, servings: s.servings ?? undefined, budget: s.budget, eventDate: addDays(now, Math.max(s.inDays, bakery.leadTimeDays)) },
    'link',
    now,
  );
}

/** A realistic board: new requests, a sent quote, confirmed and baking orders. */
export function demoOrders(bakery: Bakery, now = new Date()): Order[] {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  const out: Order[] = [];
  SCENARIOS.forEach((s, i) => {
    const created = hoursAgo(30 - i * 5);
    let o = scenarioOrder(bakery, s, created);
    if (i === 1 || i === 2 || i === 3) {
      const q = priceSelection(bakery, o.selection)!;
      o = approveOrder(bakery, o, { selection: o.selection, look: o.look, price: q.suggestedPrice, note: 'Salamat po! 50% down payment to reserve the date.', validDays: 3 }, new Date(created.getTime() + (12 + i * 9) * 60000));
    }
    if (i === 2 || i === 3) {
      o = { ...o, status: i === 3 ? 'baking' : 'confirmed', confirmedAt: new Date(created.getTime() + 3600_000).toISOString(), paid: i === 3, history: [...o.history, { at: created.toISOString(), type: 'confirmed' }] };
    }
    out.push(o);
  });
  // One more confirmed order later this month for the shopping list.
  const extra = orderFromMessage(bakery, 'Mocha cake with rosettes for 24 pax, "Happy Anniversary"', { customer: { name: 'Gina Lim (sample)', contact: '0917 000 0006' }, occasion: 'Anniversary', eventDate: addDays(now, 16) }, 'link', hoursAgo(50));
  const q = priceSelection(bakery, extra.selection)!;
  const approved = approveOrder(bakery, extra, { selection: extra.selection, look: extra.look, price: q.suggestedPrice, note: '', validDays: 3 }, hoursAgo(49));
  out.push({ ...approved, status: 'confirmed', confirmedAt: hoursAgo(48).toISOString(), paid: false });
  return out;
}
