import { describe, expect, it } from 'vitest';
import { computeInsights, weekBucket, addDays } from './insights';
import { parsePriceUpdate } from './priceUpdate';
import { combinedShopping, formatQty, shoppingForOrder } from './shopping';
import { createSampleBakery, SAMPLE_INGREDIENTS } from './starterMenus';
import type { Order } from './types';

describe('parsePriceUpdate', () => {
  it('converts per-kilo, each, pack and tray prices to per-unit costs', () => {
    const r = parsePriceUpdate('butter 520 per kilo, itlog 9.50 each, whipping cream 62 per 250ml, eggs 270 per tray', SAMPLE_INGREDIENTS);
    const byId = Object.fromEntries(r.changes.map((c) => [c.ingredientId + c.raw, c]));
    expect(r.changes).toHaveLength(4);
    expect(Object.values(byId).find((c) => c.ingredientId === 'butter')!.newCost).toBe(0.52);
    expect(r.changes.find((c) => c.raw.startsWith('itlog'))!.newCost).toBe(9.5);
    expect(r.changes.find((c) => c.ingredientId === 'whip-cream')!.newCost).toBe(0.248);
    expect(r.changes.find((c) => c.raw.includes('tray'))!.newCost).toBe(9);
  });
  it('handles ₱ signs, /kg and thousands separators', () => {
    const r = parsePriceUpdate('fondant ₱1,200/kg', SAMPLE_INGREDIENTS);
    expect(r.changes[0]!.newCost).toBe(1.2);
  });
  it('asks the baker to check when no unit is given', () => {
    const r = parsePriceUpdate('asukal 85', SAMPLE_INGREDIENTS);
    expect(r.changes[0]!.ingredientId).toBe('sugar');
    expect(r.changes[0]!.newCost).toBe(0.085);
    expect(r.changes[0]!.warning).toMatch(/kilo/i);
  });
  it('warns on big jumps', () => {
    const r = parsePriceUpdate('butter 5 per gram', SAMPLE_INGREDIENTS);
    expect(r.changes[0]!.warning).toMatch(/Malaki/);
  });
  it('lists parts it could not read', () => {
    const r = parsePriceUpdate('unicorn dust 99, ', SAMPLE_INGREDIENTS);
    expect(r.changes).toHaveLength(0);
    expect(r.unknown).toEqual(['unicorn dust 99']);
  });
  it('splits on "at" and "tapos" for spoken updates', () => {
    const r = parsePriceUpdate('harina 60 per kilo tapos butter 540 per kilo', SAMPLE_INGREDIENTS);
    expect(r.changes.map((c) => c.ingredientId)).toEqual(['flour', 'butter']);
  });
});

const bakery = createSampleBakery(new Date(2026, 10, 6));
function order(partial: Partial<Order>): Order {
  return {
    id: 'o1', bakerySlug: 'sample', createdAt: '2026-11-06T08:00:00.000Z', customer: { name: 'A', contact: '0917' },
    occasion: 'Birthday', eventDate: '2026-11-10', servings: 12, budget: 1500, description: '', tier: 'classic',
    selection: { baseCakeId: 'r6-2', componentIds: ['fl-vanilla', 'cv-buttercream'] }, look: { colors: [], textOnCake: '', candles: 0 },
    theme: '', licensedNote: '', unavailable: [], estimate: null, hasInspoPhoto: false, lang: 'tl', status: 'new', source: 'link',
    quote: null, confirmedAt: null, customerNote: '', paid: false, history: [], ...partial,
  };
}

describe('shopping lists', () => {
  it('scales coverings with cake size and rounds pieces up', () => {
    const small = shoppingForOrder(bakery, order({}));
    const big = shoppingForOrder(bakery, order({ selection: { baseCakeId: 't2-6-8', componentIds: ['fl-vanilla', 'cv-buttercream'] } }));
    const butter = (l: typeof small) => l.find((i) => i.ingredientId === 'butter')!.qty;
    expect(butter(big)).toBeGreaterThan(butter(small) * 2);
    expect(small.find((i) => i.ingredientId === 'eggs')!.qty).toBe(4);
    expect(Number.isInteger(big.find((i) => i.ingredientId === 'box')!.qty)).toBe(true);
  });
  it('combines several orders', () => {
    const one = shoppingForOrder(bakery, order({}));
    const two = combinedShopping(bakery, [order({}), order({})]);
    expect(two.find((i) => i.ingredientId === 'flour')!.qty).toBe(one.find((i) => i.ingredientId === 'flour')!.qty * 2);
  });
  it('formats quantities', () => {
    expect(formatQty(1250, 'g')).toBe('1.25 kg');
    expect(formatQty(300, 'ml')).toBe('300 ml');
    expect(formatQty(1, 'pc')).toBe('1 pc');
    expect(formatQty(4, 'pc')).toBe('4 pcs');
  });
});

describe('insights', () => {
  it('computes conversion, average time to quote and tier mix', () => {
    const q = (price: number, margin: number, minutes: number) => ({
      price, cost: price * (1 - margin / 100), marginPct: margin, note: '',
      approvedAt: new Date(Date.parse('2026-11-06T08:00:00.000Z') + minutes * 60000).toISOString(),
      validUntil: '2026-11-09', selection: { baseCakeId: 'r6-2', componentIds: [] }, look: { colors: [], textOnCake: '', candles: 0 },
    });
    const orders = [
      order({ id: 'a', status: 'confirmed', quote: q(1500, 35, 10), tier: 'classic', paid: true }),
      order({ id: 'b', status: 'quoted', quote: q(1000, 20, 30), tier: 'simple', budget: null }),
      order({ id: 'c', status: 'new', tier: 'showstopper' }),
    ];
    const i = computeInsights(orders, 30);
    expect(i.requests).toBe(3);
    expect(i.confirmed).toBe(1);
    expect(i.conversionPct).toBe(33);
    expect(i.avgQuoteMinutes).toBe(20);
    expect(i.avgOrderValue).toBe(1500);
    expect(i.belowTargetPct).toBe(50);
    expect(i.tierMix).toEqual({ simple: 1, classic: 1, showstopper: 1, custom: 0 });
    expect(i.unpaidConfirmed).toBe(0);
  });
  it('empty board does not divide by zero', () => {
    const i = computeInsights([], 30);
    expect(i.conversionPct).toBe(0);
    expect(i.avgQuoteMinutes).toBeNull();
  });
  it('buckets orders by week (Monday start)', () => {
    const fri = new Date(2026, 10, 6); // Friday
    expect(weekBucket('2026-11-05', fri)).toBe('past');
    expect(weekBucket('2026-11-08', fri)).toBe('thisWeek'); // Sunday
    expect(weekBucket('2026-11-09', fri)).toBe('nextWeek'); // Monday
    expect(weekBucket('2026-11-16', fri)).toBe('later');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});
