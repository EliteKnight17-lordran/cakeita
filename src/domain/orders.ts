import { addDays } from './insights';
import { evaluatePrice, priceSelection, toPublicMenu } from './pricing';
import type { ConfirmLink, QuoteLink } from './schemas';
import type { Bakery, CakeLook, CakeRequest, Order, Selection } from './types';
import { toVisual } from './visual';

export function requestToOrder(req: CakeRequest, source: Order['source'], now = new Date()): Order {
  return {
    ...req,
    status: 'new',
    source,
    quote: null,
    confirmedAt: null,
    customerNote: '',
    paid: false,
    history: [{ at: now.toISOString(), type: source === 'pasted-dm' ? 'pasted' : 'received' }],
  };
}

export function approveOrder(
  bakery: Bakery,
  order: Order,
  input: { selection: Selection; look: CakeLook; price: number; note: string; validDays: number },
  now = new Date(),
): Order {
  const q = priceSelection(bakery, input.selection);
  const cost = q?.costTotal ?? 0;
  const ev = evaluatePrice(input.price, cost, bakery.targetMarginPct);
  return {
    ...order,
    status: 'quoted',
    selection: input.selection,
    look: input.look,
    quote: {
      price: input.price,
      cost,
      marginPct: ev.marginPct,
      note: input.note.slice(0, 500),
      approvedAt: now.toISOString(),
      validUntil: addDays(now, Math.max(1, input.validDays)),
      selection: input.selection,
      look: input.look,
    },
    history: [...order.history, { at: now.toISOString(), type: 'approved', detail: `₱${input.price}` }],
  };
}

export function quoteLinkPayload(bakery: Bakery, order: Order): QuoteLink | null {
  if (!order.quote) return null;
  const menu = toPublicMenu(bakery);
  const sel = order.quote.selection;
  const base = bakery.baseCakes.find((b) => b.id === sel.baseCakeId);
  const visual = toVisual(menu, sel, order.quote.look);
  const names = sel.componentIds
    .map((id) => bakery.components.find((c) => c.id === id))
    .filter((c) => !!c)
    .map((c) => c.name);
  return {
    v: 1,
    orderId: order.id,
    bakery: { name: bakery.name, slug: bakery.slug, contact: bakery.contact, isSample: bakery.isSample },
    customerName: order.customer.name,
    occasion: order.occasion,
    eventDate: order.eventDate,
    servings: order.servings,
    price: order.quote.price,
    note: order.quote.note,
    approvedAt: order.quote.approvedAt,
    validUntil: order.quote.validUntil,
    parts: names,
    sizeLabel: base?.sizeLabel ?? '',
    visual,
    // Words are only promised when a lettering part (piped message or topper) is priced in.
    textOnCake: visual.textStyle ? order.quote.look.textOnCake : '',
  };
}

export type ConfirmResult = { ok: true; order: Order } | { ok: false; reason: 'unknown' | 'not-quoted' | 'price-changed' | 'already' };

/** Apply a customer's "Ito ang gusto ko" link to the baker's copy of the order. */
export function applyConfirmation(order: Order | undefined, c: ConfirmLink, now = new Date()): ConfirmResult {
  if (!order) return { ok: false, reason: 'unknown' };
  if (['confirmed', 'baking', 'ready', 'done'].includes(order.status)) return { ok: false, reason: 'already' };
  if (!order.quote) return { ok: false, reason: 'not-quoted' };
  if (Math.round(order.quote.price) !== Math.round(c.price)) return { ok: false, reason: 'price-changed' };
  return {
    ok: true,
    order: {
      ...order,
      status: 'confirmed',
      confirmedAt: c.confirmedAt || now.toISOString(),
      customerNote: c.note,
      history: [...order.history, { at: now.toISOString(), type: 'confirmed', detail: c.note }],
    },
  };
}

export function isQuoteExpired(validUntil: string, today = new Date()): boolean {
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return validUntil < t;
}
