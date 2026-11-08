import { describe, expect, it } from 'vitest';
import { listedBakeries, directoryBakery, DIRECTORY_SLUGS } from '../data/directory';
import { buildDesigns } from './designs';
import { DEFAULT_SPOT, distanceKm, formatKm } from './geo';
import { matchBakeries, sortMatches, translateSelection } from './matching';
import { estimateFromMenu, priceSelection, toPublicMenu } from './pricing';
import { createSampleBakery, SAMPLE_COMPONENTS } from './starterMenus';

const sample = toPublicMenu(createSampleBakery(new Date('2026-11-01')));
const nameOf = (id: string) => SAMPLE_COMPONENTS.find((c) => c.id === id)?.name ?? id;
const today = new Date('2026-11-08T08:00:00');

describe('geo', () => {
  it('measures known distances', () => {
    // Ortigas Center to Makati Poblacion is about 5 km as the crow flies.
    const d = distanceKm(DEFAULT_SPOT, { lat: 14.5652, lng: 121.0306 });
    expect(d).toBeGreaterThan(3.5);
    expect(d).toBeLessThan(4.5);
    expect(distanceKm(DEFAULT_SPOT, DEFAULT_SPOT)).toBe(0);
  });
  it('formats short and long distances', () => {
    expect(formatKm(0.42)).toBe('400 m');
    expect(formatKm(3.26)).toBe('3.3 km');
    expect(formatKm(14.6)).toBe('15 km');
  });
});

describe('directory (sample bakeries)', () => {
  it('every listing is labeled as a sample and opens as a bakery', () => {
    for (const slug of DIRECTORY_SLUGS) {
      const b = directoryBakery(slug)!;
      expect(b.name).toMatch(/\(sample\)$/);
      expect(b.isSample).toBe(true);
    }
    expect(listedBakeries().length).toBe(DIRECTORY_SLUGS.length);
  });
  it('public listings carry no costs, margins or labor rates', () => {
    const json = JSON.stringify(listedBakeries());
    expect(json).not.toMatch(/costPerUnit|targetMarginPct|laborRatePerHour|recipe/);
  });
  it('map estimate equals the price the baker sees for the same cake', () => {
    for (const slug of DIRECTORY_SLUGS) {
      const b = directoryBakery(slug)!;
      const menu = toPublicMenu(b);
      const sel = buildDesigns(menu, { servings: 20, budget: 2000, tiers: null, sizeIn: null, flavorId: null, coveringId: null, componentIds: ['dc-sprinkles'], textOnCake: '' }).options[0]!.selection;
      expect(estimateFromMenu(menu, sel)).toBe(priceSelection(b, sel)!.suggestedPrice);
    }
  });
});

describe('matching', () => {
  const premiumOnly = { baseCakeId: 't2-6-8', componentIds: ['fl-ube', 'cv-fondant', 'tp-figure'] };

  it('keeps parts the baker makes and reports the ones they do not', () => {
    const home = toPublicMenu(directoryBakery('kapitolyo-home-bakes')!);
    const r = translateSelection(premiumOnly, home, nameOf, 36);
    // Home preset is 1 tier only, no fondant, no figures.
    expect(r.missing).toEqual(expect.arrayContaining(['Fondant', 'Fondant figure']));
    expect(r.selection.componentIds).toContain('fl-ube');
    // Still a real cake: has a covering from their menu.
    expect(r.selection.componentIds.some((id) => home.components.find((c) => c.id === id)?.category === 'covering')).toBe(true);
    expect(home.baseCakes.some((b) => b.id === r.selection.baseCakeId)).toBe(true);
  });

  it('marks suitability, budget fit, lead time and delivery', () => {
    const sel = { baseCakeId: 'r8-2', componentIds: ['fl-choco', 'cv-buttercream', 'dc-sprinkles'] };
    const list = matchBakeries({ selection: sel, servings: 20, budget: 1500, eventDate: '2026-11-10' }, listedBakeries(), DEFAULT_SPOT, nameOf, today);
    const greenhills = list.find((m) => m.slug === 'greenhills-gilded-tiers')!;
    expect(greenhills.leadOk).toBe(false); // needs 7 days, event is in 2
    expect(greenhills.suitable).toBe(false);
    const bento = list.find((m) => m.slug === 'mandaluyong-bento-box')!;
    expect(bento.leadOk).toBe(true);
    expect(bento.canMakeAll).toBe(true);
    const cainta = list.find((m) => m.slug === 'cainta-family-bakeshop')!;
    expect(cainta.delivers).toBe(false); // pickup only
    for (const m of list) {
      expect(m.fitsBudget).toBe(m.estimate! <= 1500);
      expect(m.estimate).toBe(estimateFromMenu(listedBakeries().find((l) => l.menu.slug === m.slug)!.menu, m.selection));
    }
  });

  it('sorts suitable bakers first, then within budget, then nearest', () => {
    const sel = sample.baseCakes.find((b) => b.id === 'r8-2')!;
    const list = matchBakeries({ selection: { baseCakeId: sel.id, componentIds: ['fl-ube', 'cv-buttercream'] }, servings: 20, budget: 1600, eventDate: '' }, listedBakeries(), DEFAULT_SPOT, nameOf, today);
    const best = sortMatches(list, 'best');
    const firstUnsuitable = best.findIndex((m) => !m.suitable);
    if (firstUnsuitable >= 0) expect(best.slice(firstUnsuitable).every((m) => !m.suitable)).toBe(true);
    const cheap = sortMatches(list, 'cheapest');
    for (let i = 1; i < cheap.length; i++) expect(cheap[i]!.estimate!).toBeGreaterThanOrEqual(cheap[i - 1]!.estimate!);
    const near = sortMatches(list, 'nearest');
    for (let i = 1; i < near.length; i++) expect(near[i]!.distanceKm).toBeGreaterThanOrEqual(near[i - 1]!.distanceKm);
  });

  it('the same cake gets different prices from different bakers', () => {
    const sel = { baseCakeId: 'r6-2', componentIds: ['fl-vanilla', 'cv-buttercream'] };
    const prices = new Set(matchBakeries({ selection: sel, servings: 12, budget: null, eventDate: '' }, listedBakeries(), DEFAULT_SPOT, nameOf, today).map((m) => m.estimate));
    expect(prices.size).toBeGreaterThan(3);
  });
});
