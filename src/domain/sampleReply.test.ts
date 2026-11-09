import { describe, expect, it } from 'vitest';
import { marginOf, priceSelection } from './pricing';
import { floorPrice, sampleBakerReply, sampleOfferAnswer } from './sampleReply';
import { createSampleBakery } from './starterMenus';
import type { CakeRequest } from './types';

const NOW = new Date(2026, 10, 9, 10, 0, 0);
const bakery = { ...createSampleBakery(NOW), leadTimeDays: 3, fullDates: ['2026-12-24'] };
const sel = { baseCakeId: 'r6-2', componentIds: ['fl-ube', 'cv-buttercream', 'dc-drip'] };
const q = priceSelection(bakery, sel)!;
const req = (p: Partial<CakeRequest> = {}): CakeRequest => ({
  id: 'r1', bakerySlug: 'sample', createdAt: NOW.toISOString(), customer: { name: 'Ana', contact: '0917' }, occasion: 'Birthday',
  eventDate: '2026-12-12', servings: 12, budget: null, description: '', tier: 'classic', selection: sel,
  look: { colors: [], textOnCake: '', candles: 0 }, theme: '', licensedNote: '', unavailable: [], estimate: q.suggestedPrice, hasInspoPhoto: false, lang: 'en', ...p,
});

describe('sample bakeries answer by plain rules (demo only)', () => {
  it('says no, with a reason, when the date is too soon or fully booked', () => {
    expect(sampleBakerReply(bakery, req({ eventDate: '2026-11-10' }))).toMatchObject({ kind: 'declined', reason: expect.stringMatching(/3 days/) });
    expect(sampleBakerReply(bakery, req({ eventDate: '2026-12-24' }))).toMatchObject({ kind: 'declined', reason: expect.stringMatching(/booked/) });
  });

  it('accepts at its own code price when there is no budget or it fits', () => {
    expect(sampleBakerReply(bakery, req())).toMatchObject({ kind: 'quote', price: q.suggestedPrice });
    expect(sampleBakerReply(bakery, req({ budget: q.suggestedPrice + 100 }))).toMatchObject({ kind: 'quote', price: q.suggestedPrice });
  });

  it('counters an over-budget request, but never below its minimum margin', () => {
    const floor = floorPrice(bakery, q.costTotal);
    expect(floor).toBeLessThan(q.suggestedPrice);
    expect(marginOf(floor, q.costTotal)).toBeGreaterThanOrEqual(Math.max(10, bakery.targetMarginPct - 12) - 0.01);
    // A budget between the floor and the price: it meets the budget.
    const mid = Math.ceil((floor + q.suggestedPrice) / 2 / 50) * 50;
    const a = sampleBakerReply(bakery, req({ budget: mid }));
    expect(a.kind === 'quote' && a.price <= mid && a.price >= floor).toBe(true);
    // A budget far too low: it offers its lowest price instead.
    const b = sampleBakerReply(bakery, req({ budget: 100 }));
    expect(b).toMatchObject({ kind: 'quote', price: floor });
  });

  it('takes a counter-offer only at or above its minimum', () => {
    const floor = floorPrice(bakery, q.costTotal);
    expect(sampleOfferAnswer(bakery, req(), floor)).toBe(true);
    expect(sampleOfferAnswer(bakery, req(), floor - 50)).toBe(false);
  });
});
