import { describe, expect, it } from 'vitest';
import { roundUpTo50, round2, formatPeso } from './money';
import {
  clampMargin,
  estimateFromMenu,
  evaluatePrice,
  menuPriceCheck,
  priceOrder,
  priceSelection,
  recipeCost,
  toPublicMenu,
} from './pricing';
import { createBakeryFromStarter, createSampleBakery, STARTER_PRESETS } from './starterMenus';
import type { BaseCake, CakeComponent, Ingredient } from './types';

const ING: Ingredient[] = [
  { id: 'flour', name: 'Flour', unit: 'g', costPerUnit: 0.1 },
  { id: 'butter', name: 'Butter', unit: 'g', costPerUnit: 0.5 },
  { id: 'egg', name: 'Egg', unit: 'pc', costPerUnit: 10 },
  { id: 'unpriced', name: 'Vanilla', unit: 'ml', costPerUnit: 0 },
];
const BASE: BaseCake = {
  id: 'b', name: 'Test cake', sizeLabel: '6"', tiers: [6], heights: [4], servings: 12,
  recipe: [{ ingredientId: 'flour', qty: 100 }, { ingredientId: 'butter', qty: 100 }, { ingredientId: 'egg', qty: 2 }],
  laborMinutes: 60, scale: 2,
};
const COVER: CakeComponent = {
  id: 'cv', name: 'Buttercream', category: 'covering', visual: 'buttercream', recipe: [{ ingredientId: 'butter', qty: 50 }],
  laborMinutes: 30, extraCost: 0, canMake: true, scales: true, keywords: [],
};
const TOPPER: CakeComponent = {
  id: 'tp', name: 'Topper', category: 'topper', visual: 'acrylic', recipe: [], laborMinutes: 0, extraCost: 100, canMake: true, scales: false, keywords: [],
};
const RATES = { laborRatePerHour: 100, targetMarginPct: 30, minOrderPrice: 0 };

describe('money helpers', () => {
  it('rounds up to the nearest 50', () => {
    expect(roundUpTo50(1901)).toBe(1950);
    expect(roundUpTo50(1950)).toBe(1950);
    expect(roundUpTo50(1950.004)).toBe(1950); // float noise does not bump a tier
    expect(roundUpTo50(1950.01)).toBe(2000);
    expect(roundUpTo50(1)).toBe(50);
    expect(roundUpTo50(0)).toBe(0);
    expect(roundUpTo50(-5)).toBe(0);
    expect(roundUpTo50(Number.NaN)).toBe(0);
  });
  it('round2 avoids float drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
  it('formats pesos', () => {
    expect(formatPeso(1950)).toBe('₱1,950');
    expect(formatPeso(12345.6)).toBe('₱12,346');
  });
});

describe('priceOrder', () => {
  it('computes ingredients, labor, extras, cost and the rounded price', () => {
    const q = priceOrder(BASE, [COVER, TOPPER], RATES, ING);
    // base: 10 + 50 + 20 = 80 ingredients, 100 labor -> 180
    // covering scales x2: (25 + 50) * 2 = 150 ; topper: 100 extra
    expect(q.ingredientsTotal).toBe(80 + 50);
    expect(q.laborTotal).toBe(100 + 100);
    expect(q.extrasTotal).toBe(100);
    expect(q.costTotal).toBe(430);
    // contributions: 257.14 + 214.28 + 142.86 = 614.28 -> 650
    expect(q.suggestedPrice).toBe(650);
    expect(q.marginPct).toBeCloseTo(33.85, 2);
    expect(q.belowTarget).toBe(false);
    expect(q.minApplied).toBe(false);
    expect(q.lines).toHaveLength(3);
    expect(q.lines[1]!.factor).toBe(2);
    expect(q.lines[2]!.factor).toBe(1);
  });

  it('never goes below the minimum order price', () => {
    const q = priceOrder(BASE, [], { ...RATES, minOrderPrice: 1000 }, ING);
    expect(q.suggestedPrice).toBe(1000);
    expect(q.minApplied).toBe(true);
  });

  it('with 0% margin the price is cost rounded up to 50', () => {
    const q = priceOrder(BASE, [COVER, TOPPER], { ...RATES, targetMarginPct: 0 }, ING);
    expect(q.suggestedPrice).toBe(450);
  });

  it('clamps silly margins instead of dividing by zero', () => {
    expect(clampMargin(100)).toBe(90);
    expect(clampMargin(-10)).toBe(0);
    expect(clampMargin(Number.NaN)).toBe(0);
    const q = priceOrder(BASE, [], { ...RATES, targetMarginPct: 100 }, ING);
    expect(Number.isFinite(q.suggestedPrice)).toBe(true);
    expect(q.suggestedPrice).toBe(1800); // 180 / 0.1
  });

  it('reports ingredients with no price yet', () => {
    const withVanilla = { ...BASE, recipe: [...BASE.recipe, { ingredientId: 'unpriced', qty: 5 }, { ingredientId: 'ghost', qty: 1 }] };
    const q = priceOrder(withVanilla, [], RATES, ING);
    expect(q.missingPrices).toContain('Vanilla');
    expect(q.missingPrices).toContain('ghost');
  });

  it('ignores negative quantities and costs', () => {
    const r = recipeCost([{ ingredientId: 'flour', qty: -100 }], [{ id: 'flour', name: 'F', unit: 'g', costPerUnit: -1 }]);
    expect(r.cost).toBe(0);
  });

  it('flags a hand-typed price below target margin and below cost', () => {
    expect(evaluatePrice(500, 430, 30)).toMatchObject({ belowTarget: true, loss: false });
    expect(evaluatePrice(400, 430, 30)).toMatchObject({ belowTarget: true, loss: true });
    expect(evaluatePrice(700, 430, 30).belowTarget).toBe(false);
    expect(evaluatePrice(0, 430, 30).marginPct).toBe(0);
  });

  it('a price exactly at target margin is not below target', () => {
    // cost 700, margin 30% -> 1000 exactly
    const ev = evaluatePrice(1000, 700, 30);
    expect(ev.marginPct).toBe(30);
    expect(ev.belowTarget).toBe(false);
  });
});

describe('public menu estimate matches the baker price', () => {
  for (const preset of STARTER_PRESETS) {
    it(`same number on both sides for every cake size (${preset.key})`, () => {
      const bakery = createBakeryFromStarter(preset.key, { name: 'Test' });
      const menu = toPublicMenu(bakery);
      const made = bakery.components.filter((c) => c.canMake);
      for (const base of menu.baseCakes) {
        for (let i = 0; i < made.length; i++) {
          const sel = { baseCakeId: base.id, componentIds: made.slice(0, i + 1).map((c) => c.id) };
          expect(estimateFromMenu(menu, sel)).toBe(priceSelection(bakery, sel)!.suggestedPrice);
        }
      }
    });
  }

  it('hides costs, margin and labor rate from customers', () => {
    const menu = toPublicMenu(createSampleBakery());
    const json = JSON.stringify(menu);
    expect(json).not.toContain('costPerUnit');
    expect(json).not.toContain('laborRatePerHour');
    expect(json).not.toContain('targetMarginPct');
    expect(json).not.toContain('recipe');
  });

  it('does not offer parts the baker cannot make, but lists them as not offered', () => {
    const bakery = createBakeryFromStarter('home', { name: 'Home' });
    const menu = toPublicMenu(bakery);
    expect(menu.components.some((c) => c.id === 'cv-fondant')).toBe(false);
    expect(menu.notOffered.some((n) => n.name === 'Fondant')).toBe(true);
    expect(menu.baseCakes.every((b) => b.tiers.length <= bakery.skills.maxTiers)).toBe(true);
  });

  it('returns null for unknown cake ids', () => {
    const bakery = createSampleBakery();
    expect(estimateFromMenu(toPublicMenu(bakery), { baseCakeId: 'nope', componentIds: [] })).toBeNull();
    expect(priceSelection(bakery, { baseCakeId: 'nope', componentIds: [] })).toBeNull();
  });
});

describe('menu price check (lugi alert)', () => {
  it('flags a menu price that earns less than the target margin', () => {
    const bakery = createSampleBakery();
    const base = { ...bakery.baseCakes.find((b) => b.id === 'r6-2')!, menuPrice: 300 };
    const plain = bakery.components.filter((c) => c.id === 'fl-vanilla' || c.id === 'cv-buttercream');
    const r = menuPriceCheck(bakery, base, plain);
    expect(r.belowTarget).toBe(true);
    expect(r.quote.suggestedPrice).toBeGreaterThan(300);
  });
  it('no alert when there is no menu price', () => {
    const bakery = createSampleBakery();
    const base = { ...bakery.baseCakes[0]!, menuPrice: undefined };
    expect(menuPriceCheck(bakery, base, []).belowTarget).toBe(false);
  });
});

describe('starter menu sanity', () => {
  it('every recipe line points to a real ingredient with a price', () => {
    const b = createSampleBakery();
    const ids = new Set(b.ingredients.map((i) => i.id));
    for (const item of [...b.baseCakes, ...b.components]) for (const l of item.recipe) expect(ids.has(l.ingredientId)).toBe(true);
    expect(b.ingredients.every((i) => i.costPerUnit > 0)).toBe(true);
  });
  it('bigger cakes cost more', () => {
    const b = createSampleBakery();
    const prices = b.baseCakes.map((base) => priceSelection(b, { baseCakeId: base.id, componentIds: ['fl-vanilla', 'cv-buttercream'] })!.suggestedPrice);
    for (let i = 1; i < prices.length; i++) expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
  });
  it('sample 6" 2-layer buttercream is in a believable home-baker range', () => {
    const b = createSampleBakery();
    const p = priceSelection(b, { baseCakeId: 'r6-2', componentIds: ['fl-vanilla', 'cv-buttercream'] })!.suggestedPrice;
    expect(p).toBeGreaterThanOrEqual(600);
    expect(p).toBeLessThanOrEqual(1500);
  });
});
