import { addDays } from './insights';
import { evaluatePrice, priceSelection, toPublicMenu } from './pricing';
import type { ConfirmLink, OfferLink, QuoteLink } from './schemas';
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

/**
 * What the customer sees: the baker's approved quote, or their "sorry, we can't" with a reason.
 * Never includes cost or margin.
 */
export function quoteLinkPayload(bakery: Bakery, order: Order): QuoteLink | null {
  const declined = order.status === 'declined';
  if (!order.quote && !declined) return null;
  const menu = toPublicMenu(bakery);
  const sel = order.quote && !declined ? order.quote.selection : order.selection;
  const look = order.quote && !declined ? order.quote.look : order.look;
  const base = bakery.baseCakes.find((b) => b.id === sel.baseCakeId);
  const visual = toVisual(menu, sel, look);
  const names = sel.componentIds
    .map((id) => bakery.components.find((c) => c.id === id))
    .filter((c) => !!c)
    .map((c) => c.name);
  const declinedAt = [...order.history].reverse().find((h) => h.type === 'declined')?.at ?? order.createdAt;
  return {
    v: 1,
    orderId: order.id,
    bakery: { name: bakery.name, slug: bakery.slug, contact: bakery.contact, isSample: bakery.isSample },
    customerName: order.customer.name,
    occasion: order.occasion,
    eventDate: order.eventDate,
    servings: order.servings,
    price: declined || !order.quote ? 0 : order.quote.price,
    note: declined || !order.quote ? '' : order.quote.note,
    approvedAt: declined || !order.quote ? declinedAt : order.quote.approvedAt,
    validUntil: declined || !order.quote ? order.eventDate : order.quote.validUntil,
    parts: names,
    sizeLabel: base?.sizeLabel ?? '',
    visual,
    // Words are only promised when a lettering part (piped message or topper) is priced in.
    textOnCake: visual.textStyle ? look.textOnCake : '',
    kind: declined ? 'declined' : 'quote',
    reason: declined ? (order.declineReason ?? '').slice(0, 300) : '',
    estimate: order.estimate ?? null,
    offer: order.offer ? { price: order.offer.price, note: order.offer.note.slice(0, 300), answer: order.offer.answer } : null,
    handoff: order.handoff ?? null,
    handoffTime: order.handoffTime ?? '',
    address: (order.address ?? '').slice(0, 200),
    ready: !declined && order.ready && ['ready', 'done'].includes(order.status) ? { at: order.ready.at, note: order.ready.note.slice(0, 300), hasPhoto: !!order.ready.photo } : null,
  };
}

/** The baker says no, with a reason the customer will see. */
export function declineOrder(order: Order, reason: string, now = new Date()): Order {
  const r = reason.trim().slice(0, 300);
  return { ...order, status: 'declined', declineReason: r, history: [...order.history, { at: now.toISOString(), type: 'declined', detail: r }] };
}

export type OfferResult = { ok: true; order: Order } | { ok: false; reason: 'unknown' | 'not-quoted' | 'already' | 'bad-price' };

/** Apply the customer's one counter-offer. Only on an open quote, only once, only below the quoted price. */
export function applyOffer(order: Order | undefined, o: OfferLink, now = new Date()): OfferResult {
  if (!order) return { ok: false, reason: 'unknown' };
  if (order.status !== 'quoted' || !order.quote) return { ok: false, reason: 'not-quoted' };
  if (order.offer) return { ok: false, reason: 'already' };
  const price = Math.round(o.price);
  if (!(price > 0) || price >= order.quote.price) return { ok: false, reason: 'bad-price' };
  return {
    ok: true,
    order: {
      ...order,
      offer: { price, note: o.note.slice(0, 300), at: o.at || now.toISOString(), answer: 'pending' },
      history: [...order.history, { at: now.toISOString(), type: 'offer', detail: `₱${price}` }],
    },
  };
}

/**
 * The baker answers the counter-offer. Accepting re-approves the same cake at the customer's price
 * (cost and margin still from code); keeping leaves the quote as it was. Either way it is final.
 */
export function answerOffer(bakery: Bakery, order: Order, accept: boolean, now = new Date()): Order {
  if (!order.offer || order.offer.answer !== 'pending' || !order.quote || order.status !== 'quoted') return order;
  if (!accept) {
    return { ...order, offer: { ...order.offer, answer: 'kept' }, history: [...order.history, { at: now.toISOString(), type: 'offer-kept' }] };
  }
  const q = order.quote;
  const days = Math.max(1, Math.round((Date.parse(q.validUntil) - Date.parse(q.approvedAt.slice(0, 10))) / 86_400_000)) || 3;
  const next = approveOrder(bakery, order, { selection: q.selection, look: q.look, price: order.offer.price, note: q.note, validDays: Math.min(30, days) }, now);
  return { ...next, offer: { ...order.offer, answer: 'accepted' }, history: [...next.history, { at: now.toISOString(), type: 'offer-accepted', detail: `₱${order.offer.price}` }] };
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

/** The baker says the cake is ready, with an optional photo of the finished cake and a short note. */
export function markReady(order: Order, note: string, photo: string | null, now = new Date()): Order {
  const at = now.toISOString();
  return {
    ...order,
    status: 'ready',
    ready: { at, note: note.trim().slice(0, 300), photo },
    history: [...order.history, { at, type: 'ready', detail: photo ? 'with photo' : '' }],
  };
}
