import { itemAllergens } from './allergens';
import { round2, roundUpTo50 } from './money';
import type { BaseCake, Bakery, CakeComponent, Ingredient, PublicMenu, RecipeLine, Selection } from './types';

/**
 * Pricing engine. Pure functions, no AI, no I/O.
 *
 * suggested price = cost / (1 - target margin), rounded UP to the nearest ₱50,
 * never below the bakery's minimum order price.
 *
 * To keep the customer's estimate and the baker's price identical, every item is
 * turned into a "price contribution" the same way on both sides:
 *   p = round2(itemCost / (1 - margin))   then scaled by cake size for scaling parts.
 */

export const MAX_MARGIN_PCT = 90;

export interface PricingRates {
  laborRatePerHour: number;
  targetMarginPct: number;
  minOrderPrice: number;
}

export interface ItemCost {
  ingredients: number;
  labor: number;
  extra: number;
  total: number;
  /** Ingredient names used by this item that have no price yet (cost 0 or unknown). */
  missing: string[];
}

export interface QuoteLine {
  id: string;
  name: string;
  kind: 'base' | 'part';
  factor: number;
  ingredients: number;
  labor: number;
  extra: number;
  cost: number;
  /** Price contribution (before rounding the total to ₱50). */
  price: number;
}

export interface Quote {
  lines: QuoteLine[];
  ingredientsTotal: number;
  laborTotal: number;
  extrasTotal: number;
  costTotal: number;
  suggestedPrice: number;
  marginPct: number;
  belowTarget: boolean;
  minApplied: boolean;
  missingPrices: string[];
}

export function clampMargin(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(MAX_MARGIN_PCT, Math.max(0, pct));
}

export function recipeCost(recipe: RecipeLine[], ingredients: Ingredient[]): { cost: number; missing: string[] } {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  let cost = 0;
  const missing: string[] = [];
  for (const line of recipe) {
    const ing = byId.get(line.ingredientId);
    if (!ing) {
      missing.push(line.ingredientId);
      continue;
    }
    if (!(ing.costPerUnit > 0)) missing.push(ing.name);
    cost += Math.max(0, line.qty) * Math.max(0, ing.costPerUnit || 0);
  }
  return { cost, missing };
}

export function itemCost(
  item: { recipe: RecipeLine[]; laborMinutes: number; extraCost?: number },
  ingredients: Ingredient[],
  laborRatePerHour: number,
): ItemCost {
  const { cost: ing, missing } = recipeCost(item.recipe, ingredients);
  const labor = (Math.max(0, item.laborMinutes) / 60) * Math.max(0, laborRatePerHour);
  const extra = Math.max(0, item.extraCost ?? 0);
  return { ingredients: ing, labor, extra, total: ing + labor + extra, missing };
}

/** Price contribution of one unscaled item. Shared by baker pricing and public menus. */
export function priceContribution(unscaledCost: number, targetMarginPct: number): number {
  const m = clampMargin(targetMarginPct) / 100;
  return round2(unscaledCost / (1 - m));
}

export function partFactor(part: { scales: boolean }, base: { scale: number }): number {
  return part.scales ? Math.max(0, base.scale) : 1;
}

export function finishPrice(sumOfContributions: number, minOrderPrice: number): { price: number; minApplied: boolean } {
  const rounded = roundUpTo50(sumOfContributions);
  const min = Math.max(0, minOrderPrice || 0);
  return rounded < min ? { price: min, minApplied: true } : { price: rounded, minApplied: false };
}

export function marginOf(price: number, cost: number): number {
  if (!(price > 0)) return 0;
  return round2(((price - cost) / price) * 100);
}

/**
 * Price an order from the baker's full data.
 * `components` must already be resolved objects (use resolveSelection for IDs).
 */
export function priceOrder(
  baseCake: BaseCake,
  components: CakeComponent[],
  rates: PricingRates,
  ingredients: Ingredient[],
): Quote {
  const lines: QuoteLine[] = [];
  const missing = new Set<string>();

  const pushLine = (
    id: string,
    name: string,
    kind: QuoteLine['kind'],
    c: ItemCost,
    factor: number,
  ) => {
    c.missing.forEach((m) => missing.add(m));
    lines.push({
      id,
      name,
      kind,
      factor,
      ingredients: round2(c.ingredients * factor),
      labor: round2(c.labor * factor),
      extra: round2(c.extra * factor),
      cost: round2(c.total * factor),
      price: round2(priceContribution(c.total, rates.targetMarginPct) * factor),
    });
  };

  pushLine(baseCake.id, `${baseCake.name}`, 'base', itemCost(baseCake, ingredients, rates.laborRatePerHour), 1);
  for (const comp of components) {
    pushLine(comp.id, comp.name, 'part', itemCost(comp, ingredients, rates.laborRatePerHour), partFactor(comp, baseCake));
  }

  const sum = (k: 'ingredients' | 'labor' | 'extra' | 'cost' | 'price') => round2(lines.reduce((a, l) => a + l[k], 0));
  const costTotal = sum('cost');
  const { price, minApplied } = finishPrice(sum('price'), rates.minOrderPrice);
  const marginPct = marginOf(price, costTotal);
  return {
    lines,
    ingredientsTotal: sum('ingredients'),
    laborTotal: sum('labor'),
    extrasTotal: sum('extra'),
    costTotal,
    suggestedPrice: price,
    marginPct,
    belowTarget: marginPct + 1e-9 < clampMargin(rates.targetMarginPct),
    minApplied,
    missingPrices: [...missing],
  };
}

/** Check a price the baker typed by hand. */
export function evaluatePrice(price: number, cost: number, targetMarginPct: number) {
  const marginPct = marginOf(price, cost);
  return { marginPct, belowTarget: marginPct + 1e-9 < clampMargin(targetMarginPct), loss: price < cost };
}

export function resolveSelection(bakery: Bakery, sel: Selection): { base: BaseCake; parts: CakeComponent[] } | null {
  const base = bakery.baseCakes.find((b) => b.id === sel.baseCakeId);
  if (!base) return null;
  const byId = new Map(bakery.components.map((c) => [c.id, c]));
  const parts = sel.componentIds.map((id) => byId.get(id)).filter((c): c is CakeComponent => !!c);
  return { base, parts };
}

export function priceSelection(bakery: Bakery, sel: Selection): Quote | null {
  const r = resolveSelection(bakery, sel);
  if (!r) return null;
  return priceOrder(r.base, r.parts, bakery, bakery.ingredients);
}

/** Customer-side estimate from a public menu. Gives the same number as priceSelection. */
export function estimateFromMenu(menu: PublicMenu, sel: Selection): number | null {
  const base = menu.baseCakes.find((b) => b.id === sel.baseCakeId);
  if (!base) return null;
  let sum = base.p;
  for (const id of sel.componentIds) {
    const c = menu.components.find((x) => x.id === id);
    if (c) sum += round2(c.p * partFactor(c, base));
  }
  return finishPrice(round2(sum), menu.minOrderPrice).price;
}

/** Build the customer-safe menu. Hides costs, margin and labor rate. */
export function toPublicMenu(bakery: Bakery, now = new Date()): PublicMenu {
  const cost = (item: { recipe: RecipeLine[]; laborMinutes: number; extraCost?: number }) =>
    itemCost(item, bakery.ingredients, bakery.laborRatePerHour).total;
  return {
    v: 1,
    slug: bakery.slug,
    name: bakery.name,
    contact: bakery.contact,
    city: bakery.city,
    minOrderPrice: bakery.minOrderPrice,
    leadTimeDays: bakery.leadTimeDays,
    showEstimates: bakery.settings.showEstimates,
    maxTiers: bakery.skills.maxTiers,
    cannotDo: bakery.skills.cannotDo,
    baseCakes: bakery.baseCakes
      .filter((b) => b.tiers.length <= bakery.skills.maxTiers)
      .map((b) => ({
        id: b.id,
        name: b.name,
        sizeLabel: b.sizeLabel,
        tiers: b.tiers,
        heights: b.heights,
        servings: b.servings,
        scale: b.scale,
        p: priceContribution(cost(b), bakery.targetMarginPct),
        a: itemAllergens(bakery, { recipe: b.recipe, name: 'sponge' }),
      })),
    components: bakery.components
      .filter((c) => c.canMake)
      .map((c) => ({
        id: c.id,
        name: c.name,
        nameTl: c.nameTl,
        category: c.category,
        visual: c.visual,
        scales: c.scales,
        keywords: c.keywords,
        color: c.color,
        p: priceContribution(cost(c), bakery.targetMarginPct),
        a: itemAllergens(bakery, c),
      })),
    notOffered: bakery.components
      .filter((c) => !c.canMake)
      .map((c) => ({ name: c.name, keywords: c.keywords })),
    isSample: bakery.isSample,
    ...(bakery.cloudUid ? { owner: bakery.cloudUid } : {}),
    publishedAt: now.toISOString(),
    ...(bakery.fullDates?.length ? { fullDates: upcomingDates(bakery.fullDates, now) } : {}),
  };
}

/** Today's date as YYYY-MM-DD in local time. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fully booked days from today on, sorted, unique, at most 120. */
export function upcomingDates(dates: string[], now = new Date()): string[] {
  const today = ymd(now);
  return [...new Set(dates.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= today))].sort().slice(0, 120);
}

/** Is the baker fully booked on this day? */
export function isFullDate(menu: Pick<PublicMenu, 'fullDates'>, date: string): boolean {
  return !!date && !!menu.fullDates?.includes(date);
}

/** Margin the baker actually earns at their current menu price for a plain cake. */
export function menuPriceCheck(bakery: Bakery, base: BaseCake, plainParts: CakeComponent[]) {
  const q = priceOrder(base, plainParts, bakery, bakery.ingredients);
  if (!base.menuPrice || base.menuPrice <= 0) return { quote: q, menuPrice: null, marginPct: null, belowTarget: false };
  const ev = evaluatePrice(base.menuPrice, q.costTotal, bakery.targetMarginPct);
  return { quote: q, menuPrice: base.menuPrice, marginPct: ev.marginPct, belowTarget: ev.belowTarget, loss: ev.loss };
}
