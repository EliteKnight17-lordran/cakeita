import { partFactor, resolveSelection } from './pricing';
import type { Bakery, Order, Unit } from './types';

export interface ShoppingItem {
  ingredientId: string;
  name: string;
  unit: Unit;
  qty: number;
  cost: number;
}

/** Ingredients needed for one order, scaled by cake size. */
export function shoppingForOrder(bakery: Bakery, order: Pick<Order, 'selection' | 'quote'>): ShoppingItem[] {
  const sel = order.quote?.selection ?? order.selection;
  const r = resolveSelection(bakery, sel);
  if (!r) return [];
  const totals = new Map<string, number>();
  const add = (id: string, qty: number) => totals.set(id, (totals.get(id) ?? 0) + qty);
  for (const l of r.base.recipe) add(l.ingredientId, l.qty);
  for (const p of r.parts) {
    const f = partFactor(p, r.base);
    for (const l of p.recipe) add(l.ingredientId, l.qty * f);
  }
  return toItems(bakery, totals);
}

/** Combined list for several orders (e.g. this week's confirmed orders). */
export function combinedShopping(bakery: Bakery, orders: Array<Pick<Order, 'selection' | 'quote'>>): ShoppingItem[] {
  const totals = new Map<string, number>();
  for (const o of orders) for (const it of shoppingForOrder(bakery, o)) totals.set(it.ingredientId, (totals.get(it.ingredientId) ?? 0) + it.qty);
  return toItems(bakery, totals);
}

function toItems(bakery: Bakery, totals: Map<string, number>): ShoppingItem[] {
  const out: ShoppingItem[] = [];
  for (const [id, qty] of totals) {
    const ing = bakery.ingredients.find((i) => i.id === id);
    if (!ing || qty <= 0) continue;
    const q = ing.unit === 'pc' ? Math.ceil(qty - 1e-9) : Math.round(qty);
    out.push({ ingredientId: id, name: ing.name, unit: ing.unit, qty: q, cost: Math.round(qty * ing.costPerUnit * 100) / 100 });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

/** 1250 g -> "1.25 kg", 300 ml -> "300 ml", 4 pc -> "4 pcs". */
export function formatQty(qty: number, unit: Unit): string {
  if (unit === 'pc') return `${qty} ${qty === 1 ? 'pc' : 'pcs'}`;
  if (qty >= 1000) return `${Math.round(qty / 10) / 100} ${unit === 'g' ? 'kg' : 'L'}`;
  return `${qty} ${unit}`;
}
