import { allowedParts } from './designs';
import { distanceKm, type LatLng } from './geo';
import { estimateFromMenu, isFullDate } from './pricing';
import type { PublicMenu, Selection } from './types';

/**
 * "Which bakers near me can make this cake, and for how much?"
 * Pure code: the customer's cake (part IDs) is translated to each baker's own
 * menu, then priced with that baker's own numbers. AI is not involved.
 */

export interface ListedBakery {
  menu: PublicMenu;
  lat: number;
  lng: number;
  area: string;
  /** 0 = pickup only. */
  deliveryKm: number;
  tags: string[];
}

export interface BakeryMatch {
  slug: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  distanceKm: number;
  /** The customer's cake, rebuilt from this baker's menu. */
  selection: Selection;
  estimate: number | null;
  /** Every part the customer picked is on this baker's menu. */
  canMakeAll: boolean;
  /** Names of parts this baker doesn't make (closest option used instead, or left out). */
  missing: string[];
  /** The baker can be ready by the event date. */
  leadOk: boolean;
  /** The cake feeds everyone. */
  servesOk: boolean;
  /** The baker marked the event date as fully booked. */
  booked: boolean;
  fitsBudget: boolean | null;
  delivers: boolean;
  /** Can make it, on time, for everyone. */
  suitable: boolean;
  leadTimeDays: number;
  deliveryKm: number;
  tags: string[];
}

type NameLookup = (id: string) => string;

/** Rebuild a selection with another baker's menu. Unknown parts are reported, not invented. */
export function translateSelection(sel: Selection, to: PublicMenu, nameOf: NameLookup, sourceServings: number | null): { selection: Selection; missing: string[] } {
  const missing: string[] = [];
  const bases = [...to.baseCakes].sort((a, b) => a.servings - b.servings);
  let base = to.baseCakes.find((b) => b.id === sel.baseCakeId);
  if (!base) {
    const need = sourceServings ?? 1;
    base = bases.find((b) => b.servings >= need) ?? bases[bases.length - 1];
    missing.push(nameOf(sel.baseCakeId));
  }
  const parts = allowedParts(to);
  const ids: string[] = [];
  for (const id of sel.componentIds) {
    if (parts.some((p) => p.id === id)) {
      ids.push(id);
      continue;
    }
    missing.push(nameOf(id));
  }
  // A cake still needs a flavor and a covering: use the baker's first one if theirs is missing.
  for (const cat of ['flavor', 'covering'] as const) {
    if (!ids.some((id) => parts.find((p) => p.id === id)?.category === cat)) {
      const first = parts.find((p) => p.category === cat);
      if (first) ids.push(first.id);
    }
  }
  return { selection: { baseCakeId: base?.id ?? sel.baseCakeId, componentIds: ids }, missing };
}

export interface CakeWanted {
  selection: Selection;
  servings: number | null;
  budget: number | null;
  /** YYYY-MM-DD or '' when not picked yet. */
  eventDate: string;
}

function daysBetween(today: Date, ymd: string): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round((Date.UTC(y!, (m ?? 1) - 1, d ?? 1) - t) / 86_400_000);
}

export function matchBakeries(want: CakeWanted, listed: ListedBakery[], from: LatLng, nameOf: NameLookup, today = new Date()): BakeryMatch[] {
  return listed.map((l) => {
    const { selection, missing } = translateSelection(want.selection, l.menu, nameOf, want.servings);
    const estimate = estimateFromMenu(l.menu, selection);
    const base = l.menu.baseCakes.find((b) => b.id === selection.baseCakeId);
    const km = distanceKm(from, l);
    const leadOk = !want.eventDate || daysBetween(today, want.eventDate) >= l.menu.leadTimeDays;
    const booked = isFullDate(l.menu, want.eventDate);
    const servesOk = want.servings == null || (base?.servings ?? 0) >= want.servings;
    const canMakeAll = missing.length === 0;
    return {
      slug: l.menu.slug,
      name: l.menu.name,
      area: l.area,
      lat: l.lat,
      lng: l.lng,
      distanceKm: km,
      selection,
      estimate,
      canMakeAll,
      missing,
      leadOk,
      servesOk,
      fitsBudget: want.budget == null || estimate == null ? null : estimate <= want.budget,
      delivers: l.deliveryKm > 0 && km <= l.deliveryKm,
      booked,
      suitable: canMakeAll && leadOk && servesOk && !booked,
      leadTimeDays: l.menu.leadTimeDays,
      deliveryKm: l.deliveryKm,
      tags: l.tags,
    };
  });
}

export type MatchSort = 'best' | 'nearest' | 'cheapest';

/** Best = can make it first, then fits the budget, then nearest. */
export function sortMatches(list: BakeryMatch[], by: MatchSort): BakeryMatch[] {
  const price = (m: BakeryMatch) => m.estimate ?? Number.POSITIVE_INFINITY;
  const cmp: Record<MatchSort, (a: BakeryMatch, b: BakeryMatch) => number> = {
    nearest: (a, b) => a.distanceKm - b.distanceKm,
    cheapest: (a, b) => price(a) - price(b) || a.distanceKm - b.distanceKm,
    best: (a, b) =>
      Number(b.suitable) - Number(a.suitable) ||
      Number(b.fitsBudget === true) - Number(a.fitsBudget === true) ||
      a.distanceKm - b.distanceKm,
  };
  return [...list].sort(cmp[by]);
}
