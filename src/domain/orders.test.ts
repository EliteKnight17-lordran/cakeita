import { describe, expect, it } from 'vitest';
import { applyConfirmation, approveOrder, isQuoteExpired, quoteLinkPayload, requestToOrder } from './orders';
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
