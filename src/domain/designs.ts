import { estimateFromMenu } from './pricing';
import type { DesignTier, PublicMenu, Selection } from './types';

/**
 * Budget-first design builder. Pure code, no AI.
 *
 * Simple       cheapest cake that feeds everyone, plain covering.
 * Classic      the most of what the customer asked for that still fits the budget.
 * Showstopper  the closest match to the request, may go over ("Lampas sa budget").
 */

export interface Wants {
  servings: number | null;
  budget: number | null;
  tiers: number | null;
  sizeIn: number | null;
  flavorId: string | null;
  coveringId: string | null;
  componentIds: string[];
  textOnCake: string;
}

export interface DesignOption {
  tier: Exclude<DesignTier, 'custom'>;
  selection: Selection;
  estimate: number;
  overBudget: boolean;
  servings: number;
  /** True when even the biggest cake can't feed the requested number of people. */
  servingsShort: boolean;
}

export interface DesignResult {
  options: DesignOption[];
  /** Budget is below even the Simple design. */
  budgetTooLow: boolean;
  lowestPrice: number;
}

type MenuPart = PublicMenu['components'][number];
type MenuBase = PublicMenu['baseCakes'][number];

export function allowedParts(menu: PublicMenu): MenuPart[] {
  const blocked = menu.cannotDo.map((s) => s.toLowerCase().trim()).filter(Boolean);
  return menu.components.filter((c) => {
    const words = [c.name, ...c.keywords].map((w) => w.toLowerCase());
    return !blocked.some((b) => words.includes(b));
  });
}

export function selectionKey(sel: Selection): string {
  return `${sel.baseCakeId}|${[...sel.componentIds].sort().join(',')}`;
}

function uniq(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const id of ids) if (id && !out.includes(id)) out.push(id);
  return out;
}

export function buildDesigns(menu: PublicMenu, wants: Wants): DesignResult {
  const parts = allowedParts(menu);
  const partById = new Map(parts.map((p) => [p.id, p]));
  const bases = [...menu.baseCakes].filter((b) => b.tiers.length <= menu.maxTiers).sort((a, b) => a.p - b.p);
  if (!bases.length) return { options: [], budgetTooLow: false, lowestPrice: 0 };

  const est = (sel: Selection) => estimateFromMenu(menu, sel) ?? Number.POSITIVE_INFINITY;
  const need = wants.servings ?? 0;
  let fit = bases.filter((b) => b.servings >= need);
  const servingsShort = fit.length === 0;
  if (servingsShort) fit = [bases.reduce((a, b) => (b.servings > a.servings ? b : a))];

  const flavors = parts.filter((p) => p.category === 'flavor');
  const coverings = parts.filter((p) => p.category === 'covering').sort((a, b) => a.p - b.p);
  const decorations = parts.filter((p) => p.category === 'decoration' || p.category === 'finish');
  const textPart = parts.find((p) => p.visual === 'text');

  const flavor = (wants.flavorId && partById.get(wants.flavorId)?.id) || flavors[0]?.id || null;
  const cheapCovering = coverings[0]?.id ?? null;
  // The baker's first-listed covering is their "house" default (usually buttercream).
  const houseCovering = parts.find((p) => p.category === 'covering')?.id ?? cheapCovering;
  const wantedCovering = (wants.coveringId && partById.get(wants.coveringId)?.id) || houseCovering;
  const wanted = uniq(wants.componentIds.filter((id) => {
    const p = partById.get(id);
    return p && p.category !== 'flavor' && p.category !== 'covering';
  }));
  const withText = wants.textOnCake && textPart && !wanted.includes(textPart.id) ? [textPart.id] : [];

  // ----- bases -----
  const simpleBase = fit[0]!;
  let showBase: MenuBase = simpleBase;
  if (wants.tiers) {
    const t = Math.min(wants.tiers, menu.maxTiers);
    const exact = fit.filter((b) => b.tiers.length === t);
    const lower = fit.filter((b) => b.tiers.length <= t).sort((a, b) => b.tiers.length - a.tiers.length || a.p - b.p);
    showBase = exact[0] ?? lower[0] ?? simpleBase;
  } else if (wants.sizeIn) {
    showBase = fit.find((b) => b.tiers.length === 1 && b.tiers[0] === wants.sizeIn) ?? fit.find((b) => (b.tiers[0] ?? 0) >= wants.sizeIn!) ?? simpleBase;
  } else {
    showBase = fit[1] ?? fit[0]!;
  }

  // ----- showstopper -----
  const extras = decorations.map((d) => d.id).filter((id) => !wanted.includes(id));
  const wantedDecorCount = wanted.filter((id) => {
    const c = partById.get(id)?.category;
    return c === 'decoration' || c === 'finish';
  }).length;
  const showExtras = extras.slice(0, Math.max(0, 2 - wantedDecorCount));
  // Classic adds a surprise decoration only when the customer didn't name any themselves.
  const classicExtras = wantedDecorCount ? [] : showExtras;
  // A size or tier count they typed is a requirement, not a suggestion.
  const askedBase = wants.tiers || wants.sizeIn ? showBase : simpleBase;
  const showSel: Selection = { baseCakeId: showBase.id, componentIds: uniq([flavor, wantedCovering, ...wanted, ...withText, ...showExtras]) };

  // ----- simple -----
  // Simple: house frosting (or what they asked for). If that is over budget, drop the
  // message, then fall back to the cheapest frosting.
  const simpleTries: Selection[] = [
    { baseCakeId: simpleBase.id, componentIds: uniq([flavor, wantedCovering, ...withText]) },
    { baseCakeId: simpleBase.id, componentIds: uniq([flavor, wantedCovering]) },
    { baseCakeId: simpleBase.id, componentIds: uniq([flavor, cheapCovering, ...withText]) },
    { baseCakeId: simpleBase.id, componentIds: uniq([flavor, cheapCovering]) },
  ];
  let simpleSel: Selection = simpleTries[0]!;
  if (wants.budget != null) {
    simpleSel = simpleTries.find((t) => est(t) <= wants.budget!) ?? simpleTries[simpleTries.length - 1]!;
  }
  const simplePrice = est(simpleSel);
  const budgetTooLow = wants.budget != null && simplePrice > wants.budget;

  // ----- classic -----
  const priority = uniq([...wanted, ...withText, ...classicExtras]);
  let classicSel: Selection;
  if (wants.budget == null) {
    // No budget: the request as asked, on the cheapest cake that feeds everyone, no extras.
    classicSel = { baseCakeId: askedBase.id, componentIds: uniq([flavor, wantedCovering, ...wanted, ...withText]) };
    if (selectionKey(classicSel) === selectionKey(simpleSel) && extras[0] && !wantedDecorCount) {
      classicSel = { ...classicSel, componentIds: uniq([...classicSel.componentIds, extras[0]]) };
    }
  } else if (budgetTooLow) {
    classicSel = simpleSel;
  } else {
    const budget = wants.budget;
    const baseChoices = uniq([showBase.id, simpleBase.id]);
    const coverChoices = uniq([wantedCovering, cheapCovering]);
    let best: { sel: Selection; score: number; price: number } | null = null;
    for (const baseId of baseChoices) {
      for (const cov of coverChoices) {
        let sel: Selection = { baseCakeId: baseId, componentIds: uniq([flavor, cov]) };
        if (est(sel) > budget) continue;
        for (const id of priority) {
          const next = { ...sel, componentIds: uniq([...sel.componentIds, id]) };
          if (est(next) <= budget) sel = next;
        }
        const matched =
          sel.componentIds.filter((id) => wanted.includes(id) || withText.includes(id)).length * 10 +
          (cov === wantedCovering ? 6 : 0) +
          (baseId === showBase.id ? 5 : 0) +
          sel.componentIds.length;
        const price = est(sel);
        if (!best || matched > best.score || (matched === best.score && price > best.price)) best = { sel, score: matched, price };
      }
    }
    classicSel = best?.sel ?? simpleSel;
  }

  // Make the showstopper a real step up if it ended up identical to classic.
  let finalShow = showSel;
  if (selectionKey(finalShow) === selectionKey(classicSel)) {
    const more = extras.find((id) => !finalShow.componentIds.includes(id));
    if (more) finalShow = { ...finalShow, componentIds: [...finalShow.componentIds, more] };
    else {
      const bigger = fit.find((b) => b.p > (bases.find((x) => x.id === finalShow.baseCakeId)?.p ?? 0));
      if (bigger) finalShow = { ...finalShow, baseCakeId: bigger.id };
    }
  }

  const make = (tier: DesignOption['tier'], sel: Selection): DesignOption => {
    const estimate = est(sel);
    const base = bases.find((b) => b.id === sel.baseCakeId)!;
    return {
      tier,
      selection: sel,
      estimate,
      overBudget: wants.budget != null && estimate > wants.budget,
      servings: base.servings,
      servingsShort: base.servings < need,
    };
  };

  const options = [make('simple', simpleSel), make('classic', classicSel), make('showstopper', finalShow)];
  // Hide exact duplicates (keep the cheaper label).
  const seen = new Set<string>();
  const deduped = options.filter((o) => {
    const k = selectionKey(o.selection);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { options: deduped, budgetTooLow, lowestPrice: simplePrice };
}

/** Ensure exactly one flavor and one covering, known IDs only, tiers within limit. */
export function normalizeSelection(menu: PublicMenu, sel: Selection): { selection: Selection; errors: string[] } {
  const errors: string[] = [];
  const parts = allowedParts(menu);
  const byId = new Map(parts.map((p) => [p.id, p]));
  let base = menu.baseCakes.find((b) => b.id === sel.baseCakeId && b.tiers.length <= menu.maxTiers);
  if (!base) {
    errors.push(`Unknown or unavailable cake size: ${sel.baseCakeId}`);
    base = [...menu.baseCakes].sort((a, b) => a.p - b.p)[0];
  }
  const ids: string[] = [];
  let flavor: string | null = null;
  let covering: string | null = null;
  for (const id of sel.componentIds) {
    const p = byId.get(id);
    if (!p) {
      errors.push(`Unknown or unavailable part: ${id}`);
      continue;
    }
    if (p.category === 'flavor') {
      if (!flavor) flavor = id;
      continue;
    }
    if (p.category === 'covering') {
      if (!covering) covering = id;
      continue;
    }
    if (!ids.includes(id)) ids.push(id);
  }
  flavor ??= parts.find((p) => p.category === 'flavor')?.id ?? null;
  covering ??= [...parts].filter((p) => p.category === 'covering').sort((a, b) => a.p - b.p)[0]?.id ?? null;
  return { selection: { baseCakeId: base?.id ?? '', componentIds: uniq([flavor, covering, ...ids]) }, errors };
}

export interface LeftOut {
  /** Names of parts the customer asked for that this design doesn't have. */
  parts: string[];
  /** Asked for more tiers than the baker makes. */
  maxTiers: number | null;
}

/**
 * What the customer asked for that the picked design leaves out, so the page can say so
 * instead of silently dropping it (usually to fit the budget).
 */
export function leftOut(menu: PublicMenu, wants: Wants, sel: Selection): LeftOut {
  const parts = allowedParts(menu);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const asked = uniq([
    wants.coveringId,
    ...wants.componentIds.filter((id) => byId.get(id)?.category !== 'flavor'),
    wants.textOnCake ? parts.find((p) => p.visual === 'text')?.id : null,
  ]).filter((id) => byId.has(id));
  const missing = asked.filter((id) => !sel.componentIds.includes(id)).map((id) => byId.get(id)!.name);
  const base = menu.baseCakes.find((b) => b.id === sel.baseCakeId);
  if (wants.tiers && base && base.tiers.length < Math.min(wants.tiers, menu.maxTiers)) missing.unshift(`${wants.tiers} tiers`);
  return { parts: missing, maxTiers: wants.tiers && wants.tiers > menu.maxTiers ? menu.maxTiers : null };
}
