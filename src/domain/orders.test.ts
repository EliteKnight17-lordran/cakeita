import { describe, expect, it } from 'vitest';
import { answerOffer, applyConfirmation, applyOffer, approveOrder, declineOrder, isQuoteExpired, markReady, quoteLinkPayload, requestToOrder } from './orders';
import { priceSelection } from './pricing';
import { quoteLinkSchema } from './schemas';
import { createSampleBakery } from './starterMenus';
import type { CakeRequest } from './types';

const NOW = new Date(2026, 10, 6, 10, 0, 0);
const bakery = createSampleBakery(NOW);
const req: CakeRequest = {
  id: 'r1', bakerySlug: 'sample', createdAt: NOW.toISOString(), customer: { name: 'Ana', contact: '0917' }, occasion: 'Birthday',
  eventDate: '2026-12-12', servings: 12, budget: 1500, description: '', tier: 'classic',
  selection: { baseCakeId: 'r6-2', componentIds: ['fl-ube', 'cv-buttercream', 'dc-drip'] }, look: { colors: ['#f4a7c0'], textOnCake: '', candles: 0 },
  theme: '', licensedNote: '', unavailable: [], estimate: 1450, hasInspoPhoto: false, lang: 'tl',
};

describe('order lifecycle (review gate)', () => {
  it('a new request is not quoted until the baker approves', () => {
    const o = requestToOrder(req, 'link', NOW);
    expect(o.status).toBe('new');
    expect(o.quote).toBeNull();
    expect(quoteLinkPayload(bakery, o)).toBeNull(); // nothing to send to the customer yet
  });

  it('approval records the baker price, cost and margin from code', () => {
    const o = requestToOrder(req, 'link', NOW);
    const q = priceSelection(bakery, req.selection)!;
    const a = approveOrder(bakery, o, { selection: req.selection, look: req.look, price: q.suggestedPrice, note: 'Salamat!', validDays: 3 }, NOW);
    expect(a.status).toBe('quoted');
    expect(a.quote!.cost).toBe(q.costTotal);
    expect(a.quote!.marginPct).toBeCloseTo(q.marginPct, 1);
    expect(a.quote!.validUntil).toBe('2026-11-09');
    const payload = quoteLinkPayload(bakery, a)!;
    expect(quoteLinkSchema.safeParse(payload).success).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/cost|margin/i); // customer never sees cost
  });

  it('confirmation only works for a quoted order at the same price', () => {
    const o = requestToOrder(req, 'link', NOW);
    const c = { v: 1 as const, orderId: o.id, price: 1450, confirmedAt: NOW.toISOString(), note: 'Thank you', customerName: 'Ana' };
    expect(applyConfirmation(undefined, c)).toEqual({ ok: false, reason: 'unknown' });
    expect(applyConfirmation(o, c)).toEqual({ ok: false, reason: 'not-quoted' });
    const a = approveOrder(bakery, o, { selection: req.selection, look: req.look, price: 1450, note: '', validDays: 3 }, NOW);
    expect(applyConfirmation(a, { ...c, price: 999 })).toEqual({ ok: false, reason: 'price-changed' });
    const ok = applyConfirmation(a, c);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.order.status).toBe('confirmed');
      expect(applyConfirmation(ok.order, c)).toEqual({ ok: false, reason: 'already' });
    }
  });

  it('never promises words on the cake unless a lettering part is priced in', () => {
    const o = requestToOrder({ ...req, look: { ...req.look, textOnCake: 'Happy 7th' } }, 'link', NOW);
    const noText = approveOrder(bakery, o, { selection: req.selection, look: o.look, price: 1500, note: '', validDays: 3 }, NOW);
    expect(quoteLinkPayload(bakery, noText)!.textOnCake).toBe('');
    const sel = { ...req.selection, componentIds: [...req.selection.componentIds, 'tp-text'] };
    const withText = approveOrder(bakery, o, { selection: sel, look: o.look, price: 1500, note: '', validDays: 3 }, NOW);
    expect(quoteLinkPayload(bakery, withText)!.textOnCake).toBe('Happy 7th');
  });

  it('quote expiry', () => {
    expect(isQuoteExpired('2026-11-05', NOW)).toBe(true);
    expect(isQuoteExpired('2026-11-06', NOW)).toBe(false);
  });
});

describe('accept, decline, and one counter-offer each way', () => {
  const quoted = () => approveOrder(bakery, requestToOrder(req, 'cloud', NOW), { selection: req.selection, look: req.look, price: 1600, note: 'Rush fee', validDays: 3 }, NOW);
  const offer = (price: number) => ({ v: 1 as const, orderId: 'r1', price, note: 'Pickup ako', customerName: 'Ana', at: NOW.toISOString() });

  it('a decline reaches the customer with the reason and no price', () => {
    const d = declineOrder(requestToOrder(req, 'cloud', NOW), "We're fully booked.", NOW);
    expect(d.status).toBe('declined');
    const p = quoteLinkPayload(bakery, d)!;
    expect(quoteLinkSchema.safeParse(p).success).toBe(true);
    expect(p).toMatchObject({ kind: 'declined', reason: "We're fully booked.", price: 0 });
    expect(JSON.stringify(p)).not.toMatch(/cost|margin/i);
  });

  it('the quote tells the customer what the app estimated, so a counter-offer is visible', () => {
    const p = quoteLinkPayload(bakery, quoted())!;
    expect(p).toMatchObject({ kind: 'quote', price: 1600, estimate: 1450, offer: null });
  });

  it('older quote links (before offers) still open', () => {
    const p = quoteLinkPayload(bakery, quoted())!;
    const old: Record<string, unknown> = { ...p };
    for (const k of ['kind', 'reason', 'estimate', 'offer']) delete old[k];
    const r = quoteLinkSchema.safeParse(old);
    expect(r.success && r.data.kind).toBe('quote');
  });

  it('the customer can offer once, only below the quote, only on an open quote', () => {
    expect(applyOffer(undefined, offer(1400))).toEqual({ ok: false, reason: 'unknown' });
    expect(applyOffer(requestToOrder(req, 'cloud', NOW), offer(1400))).toEqual({ ok: false, reason: 'not-quoted' });
    expect(applyOffer(quoted(), offer(1600))).toEqual({ ok: false, reason: 'bad-price' });
    expect(applyOffer(quoted(), offer(0))).toEqual({ ok: false, reason: 'bad-price' });
    const r = applyOffer(quoted(), offer(1400));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.offer).toMatchObject({ price: 1400, answer: 'pending' });
    expect(applyOffer(r.order, offer(1300))).toEqual({ ok: false, reason: 'already' });
  });

  it('accepting re-prices the same cake at the offer, with cost from code, and confirmation then needs the new price', () => {
    const r = applyOffer(quoted(), offer(1400));
    if (!r.ok) throw new Error('offer');
    const a = answerOffer(bakery, r.order, true, NOW);
    expect(a.quote!.price).toBe(1400);
    expect(a.quote!.cost).toBe(priceSelection(bakery, req.selection)!.costTotal);
    expect(a.offer!.answer).toBe('accepted');
    expect(quoteLinkPayload(bakery, a)!.offer).toEqual({ price: 1400, note: 'Pickup ako', answer: 'accepted' });
    const c = { v: 1 as const, orderId: 'r1', price: 1600, confirmedAt: NOW.toISOString(), note: '', customerName: 'Ana' };
    expect(applyConfirmation(a, c)).toEqual({ ok: false, reason: 'price-changed' });
    expect(applyConfirmation(a, { ...c, price: 1400 }).ok).toBe(true);
    // Final: answering again changes nothing.
    expect(answerOffer(bakery, a, false, NOW)).toBe(a);
  });

  it('keeping the price leaves the quote as it was', () => {
    const r = applyOffer(quoted(), offer(1400));
    if (!r.ok) throw new Error('offer');
    const k = answerOffer(bakery, r.order, false, NOW);
    expect(k.quote!.price).toBe(1600);
    expect(k.offer!.answer).toBe('kept');
  });
});

describe('cake is ready', () => {
  it('tells the customer, but the photo never goes in the link', () => {
    const q = priceSelection(bakery, req.selection)!;
    const a = approveOrder(bakery, requestToOrder({ ...req, handoff: 'delivery', handoffTime: '15:30', address: 'Cubao' }, 'link', NOW), { selection: req.selection, look: req.look, price: q.suggestedPrice, note: '', validDays: 3 }, NOW);
    expect(quoteLinkPayload(bakery, a)!.ready).toBeNull();
    const r = markReady({ ...a, status: 'baking' }, '  Book your rider  ', 'data:image/jpeg;base64,AAAA', NOW);
    expect(r.status).toBe('ready');
    const p = quoteLinkPayload(bakery, r)!;
    expect(p.ready).toEqual({ at: NOW.toISOString(), note: 'Book your rider', hasPhoto: true });
    expect(p.handoff).toBe('delivery');
    expect(JSON.stringify(p)).not.toContain('base64');
    expect(quoteLinkSchema.safeParse(p).success).toBe(true);
  });
});
