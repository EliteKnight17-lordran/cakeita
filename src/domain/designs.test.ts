import { describe, expect, it } from 'vitest';
import { allowedParts, buildDesigns, leftOut, normalizeSelection, selectionKey, wantsWithPicked, type Wants } from './designs';
import { readRequest, readServings } from './requestReader';
import { estimateFromMenu, toPublicMenu } from './pricing';
import { createBakeryFromStarter, createSampleBakery } from './starterMenus';
import { toVisual } from './visual';

const TODAY = new Date(2026, 10, 6);
const sample = toPublicMenu(createSampleBakery(TODAY), TODAY);
const W = (w: Partial<Wants> = {}): Wants => ({
  servings: null, budget: null, tiers: null, sizeIn: null, flavorId: null, coveringId: null, componentIds: [], textOnCake: '', ...w,
});

describe('buildDesigns', () => {
  it('returns Simple, Classic, Showstopper in rising price with no budget', () => {
    const r = buildDesigns(sample, W({ servings: 12 }));
    expect(r.options.map((o) => o.tier)).toEqual(['simple', 'classic', 'showstopper']);
    const [s, c, x] = r.options.map((o) => o.estimate);
    expect(s!).toBeLessThanOrEqual(c!);
    expect(c!).toBeLessThanOrEqual(x!);
    expect(r.budgetTooLow).toBe(false);
  });

  it('every design feeds the requested number of people', () => {
    const r = buildDesigns(sample, W({ servings: 30 }));
    for (const o of r.options) expect(o.servings).toBeGreaterThanOrEqual(30);
  });

  it('Simple and Classic fit the budget; Showstopper may go over and says so', () => {
    const r = buildDesigns(sample, W({ servings: 12, budget: 1400, componentIds: ['dc-drip', 'dc-flowers', 'fn-gold'], tiers: 2 }));
    const simple = r.options.find((o) => o.tier === 'simple')!;
    const classic = r.options.find((o) => o.tier === 'classic')!;
    const show = r.options.find((o) => o.tier === 'showstopper')!;
    expect(simple.estimate).toBeLessThanOrEqual(1400);
    expect(classic.estimate).toBeLessThanOrEqual(1400);
    expect(show.overBudget).toBe(show.estimate > 1400);
    expect(show.estimate).toBeGreaterThan(classic.estimate);
  });

  it('Classic includes as much of the request as the budget allows', () => {
    const r = buildDesigns(sample, W({ servings: 12, budget: 1300, componentIds: ['dc-drip'] }));
    const classic = r.options.find((o) => o.tier === 'classic')!;
    expect(classic.selection.componentIds).toContain('dc-drip');
  });

  it('says when the budget is too low even for Simple', () => {
    const r = buildDesigns(sample, W({ servings: 30, budget: 500 }));
    expect(r.budgetTooLow).toBe(true);
    expect(r.lowestPrice).toBeGreaterThan(500);
    expect(r.options[0]!.overBudget).toBe(true);
  });

  it('respects max tiers', () => {
    const home = toPublicMenu(createBakeryFromStarter('home', { name: 'H' }), TODAY);
    const r = buildDesigns(home, W({ tiers: 3, servings: 10 }));
    for (const o of r.options) {
      const base = home.baseCakes.find((b) => b.id === o.selection.baseCakeId)!;
      expect(base.tiers.length).toBeLessThanOrEqual(1);
    }
  });

  it('never uses parts the baker cannot make', () => {
    const home = toPublicMenu(createBakeryFromStarter('home', { name: 'H' }), TODAY);
    const r = buildDesigns(home, W({ componentIds: ['cv-fondant', 'tp-figure', 'fn-gold'], coveringId: 'cv-fondant' }));
    const offered = new Set(home.components.map((c) => c.id));
    for (const o of r.options) for (const id of o.selection.componentIds) expect(offered.has(id)).toBe(true);
  });

  it('respects the cannot-do list even if a part is marked can make', () => {
    const b = createSampleBakery(TODAY);
    b.skills.cannotDo = ['drip'];
    const m = toPublicMenu(b, TODAY);
    expect(allowedParts(m).some((p) => p.id === 'dc-drip')).toBe(false);
    const r = buildDesigns(m, W({ componentIds: ['dc-drip'] }));
    for (const o of r.options) expect(o.selection.componentIds).not.toContain('dc-drip');
  });

  it('flags when even the biggest cake is too small', () => {
    const r = buildDesigns(sample, W({ servings: 300 }));
    expect(r.options.every((o) => o.servingsShort)).toBe(true);
  });

  it('every design has exactly one flavor and one covering, and estimates match the menu', () => {
    const r = buildDesigns(sample, W({ servings: 20, budget: 2500, flavorId: 'fl-ube', componentIds: ['dc-sprinkles'], textOnCake: 'Happy 60th' }));
    for (const o of r.options) {
      const cats = o.selection.componentIds.map((id) => sample.components.find((c) => c.id === id)!.category);
      expect(cats.filter((c) => c === 'flavor')).toHaveLength(1);
      expect(cats.filter((c) => c === 'covering')).toHaveLength(1);
      expect(o.estimate).toBe(estimateFromMenu(sample, o.selection));
      expect(o.selection.componentIds).toContain('fl-ube');
    }
  });

  it("Simple uses the baker's house frosting when the budget allows, and the cheapest only when needed", () => {
    const roomy = buildDesigns(sample, W({ servings: 12, budget: 5000 }));
    expect(roomy.options[0]!.selection.componentIds).toContain('cv-buttercream');
    const tight = buildDesigns(sample, W({ servings: 12, budget: 1000 }));
    const simple = tight.options[0]!;
    expect(simple.estimate).toBeLessThanOrEqual(1000);
  });

  it('never returns two identical designs', () => {
    for (const budget of [null, 400, 800, 1200, 2000, 5000, 20000]) {
      const r = buildDesigns(sample, W({ budget, servings: 8 }));
      const keys = r.options.map((o) => selectionKey(o.selection));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('normalizeSelection (parts validator)', () => {
  it('rejects unknown IDs and reports them', () => {
    const r = normalizeSelection(sample, { baseCakeId: 'r6-2', componentIds: ['fl-ube', 'hacker', 'dc-drip'] });
    expect(r.errors).toEqual(['Unknown or unavailable part: hacker']);
    expect(r.selection.componentIds).not.toContain('hacker');
    expect(r.selection.componentIds).toContain('dc-drip');
  });
  it('keeps only one flavor and adds a covering if missing', () => {
    const r = normalizeSelection(sample, { baseCakeId: 'r6-2', componentIds: ['fl-ube', 'fl-choco'] });
    expect(r.selection.componentIds.filter((id) => id.startsWith('fl-'))).toEqual(['fl-ube']);
    expect(r.selection.componentIds.some((id) => id.startsWith('cv-'))).toBe(true);
  });
  it('replaces an unknown cake size', () => {
    const r = normalizeSelection(sample, { baseCakeId: '99-tier', componentIds: [] });
    expect(r.errors[0]).toMatch(/cake size/);
    expect(sample.baseCakes.some((b) => b.id === r.selection.baseCakeId)).toBe(true);
  });
});

describe('toVisual', () => {
  it('draws exactly the priced parts', () => {
    const v = toVisual(sample, { baseCakeId: 't2-6-8', componentIds: ['fl-ube', 'cv-buttercream', 'dc-drip', 'tp-candles', 'tp-text'] }, {
      colors: ['#f4a7c0'], textOnCake: 'Happy 7th Mia', candles: 7,
    });
    expect(v.tiers).toHaveLength(2);
    expect(v.drip).toBe(true);
    expect(v.flowers).toBe(false);
    expect(v.candles).toBe(7);
    expect(v.textStyle).toBe('piped');
    expect(v.text).toBe('Happy 7th Mia');
    expect(v.frosting).toBe('#f4a7c0');
    expect(v.sponge).toBe('#8e5cb8');
  });
  it('no text is drawn unless a text part is chosen', () => {
    const v = toVisual(sample, { baseCakeId: 'r6-2', componentIds: ['fl-vanilla', 'cv-whipped'] }, { colors: [], textOnCake: 'Hi', candles: 0 });
    expect(v.textStyle).toBeNull();
    expect(v.text).toBe('');
  });
});

describe('what the request asked for', () => {
  const T2 = new Date(2026, 10, 6);
  const m = toPublicMenu(createSampleBakery(T2), T2);
  const want = (text: string) => {
    const r = readRequest(text, m, T2);
    return { servings: r.servings, budget: r.budget, tiers: r.tiers, sizeIn: r.sizeIn, flavorId: r.flavorId, coveringId: r.coveringId, componentIds: r.componentIds, textOnCake: r.textOnCake };
  };

  it('reads "cake for 15" as 15 people, but not sizes, ages or money', () => {
    expect(readServings('simple vanilla cake po 8 inch for 15')).toBe(15);
    expect(readServings('cake for 7 years old')).toBeNull();
    expect(readServings('cake for 2k')).toBeNull();
    expect(readServings('for 8 inch po')).toBeNull();
  });

  it('keeps the size they typed when there is no budget', () => {
    const w = want('vanilla cake 8 inch for 15, "Congrats Ella"');
    const classic = buildDesigns(m, w).options.find((o) => o.tier === 'classic')!;
    expect(m.baseCakes.find((b) => b.id === classic.selection.baseCakeId)!.tiers).toEqual([8]);
  });

  it('does not add a surprise decoration when they named their own', () => {
    const w = want('wedding cake white buttercream, flowers, 100 pax, budget 10k');
    const classic = buildDesigns(m, w).options.find((o) => o.tier === 'classic')!;
    expect(classic.selection.componentIds).toContain('dc-flowers');
    expect(classic.selection.componentIds).not.toContain('dc-drip');
  });

  it('lists what a budget design leaves out, and the tier limit', () => {
    const w = want('2 tier pink ube cake, chocolate drip, flowers, 30 pax, budget 2.5k, "Happy 7th Mia"');
    const d = buildDesigns(m, w);
    const simple = d.options.find((o) => o.tier === 'simple')!;
    const lo = leftOut(m, w, simple.selection);
    expect(lo.parts).toEqual(expect.arrayContaining(['Chocolate drip', 'Fresh flowers']));
    const show = d.options.find((o) => o.tier === 'showstopper')!;
    expect(leftOut(m, w, show.selection).parts).toEqual([]);
    expect(leftOut(m, want('3 tier cake, 60 pax'), show.selection).maxTiers).toBe(2);
  });
});

describe('designs built from the cake the customer made by hand', () => {
  const picked = { baseCakeId: 'r8-2', componentIds: ['fl-ube', 'cv-whipped', 'dc-drip', 'dc-sprinkles', 'tp-candles'] };

  it('their size, flavor, frosting and decorations replace what the message said', () => {
    const w = wantsWithPicked(sample, W({ servings: 12, flavorId: 'fl-choco', componentIds: ['dc-flowers'], textOnCake: 'Happy 7th' }), picked);
    expect(w.baseCakeId).toBe('r8-2');
    expect(w.flavorId).toBe('fl-ube');
    expect(w.coveringId).toBe('cv-whipped');
    expect(w.componentIds).toEqual(['dc-drip', 'dc-sprinkles', 'tp-candles']);
    // They took the words off: no design adds them back.
    expect(w.textOnCake).toBe('');
    expect(wantsWithPicked(sample, W(), null)).toEqual(W());
  });

  it('with no budget, Classic and Showstopper keep every decoration they added', () => {
    const r = buildDesigns(sample, wantsWithPicked(sample, W({ servings: 12 }), picked));
    for (const tier of ['classic', 'showstopper'] as const) {
      const o = r.options.find((x) => x.tier === tier)!;
      expect(o.selection.componentIds).toEqual(expect.arrayContaining(['fl-ube', 'cv-whipped', 'dc-drip', 'dc-sprinkles', 'tp-candles']));
    }
    expect(r.options.find((x) => x.tier === 'classic')!.selection.baseCakeId).toBe('r8-2');
  });

  it('with a budget, Classic keeps as many of their decorations as fit', () => {
    const w = wantsWithPicked(sample, W({ servings: 12 }), picked);
    const full = buildDesigns(sample, w).options.find((x) => x.tier === 'classic')!;
    const r = buildDesigns(sample, { ...w, budget: full.estimate });
    const classic = r.options.find((x) => x.tier === 'classic')!;
    expect(classic.estimate).toBeLessThanOrEqual(full.estimate);
    expect(classic.selection.componentIds).toEqual(expect.arrayContaining(['dc-drip', 'dc-sprinkles', 'tp-candles']));
  });

  it('a hand-picked size too small for everyone is not used', () => {
    const w = wantsWithPicked(sample, W({ servings: 40 }), { ...picked, baseCakeId: 'bento-4' });
    expect(buildDesigns(sample, w).options.every((o) => o.selection.baseCakeId !== 'bento-4')).toBe(true);
  });
});

describe('colors they asked for', () => {
  const w = W({ servings: 30, tiers: 2, flavorId: 'fl-ube', componentIds: ['dc-flowers'], textOnCake: 'Happy 7th Mia' });
  it('Classic does not swap to semi-naked (no frosting to color) to fit the budget', () => {
    const plain = buildDesigns(sample, { ...w, budget: 3000 }).options.find((o) => o.tier === 'classic');
    expect(plain?.selection.componentIds).toContain('cv-naked');
    const colored = buildDesigns(sample, { ...w, budget: 3000, colored: true }).options;
    for (const o of colored) if (o.tier !== 'simple') expect(o.selection.componentIds).not.toContain('cv-naked');
  });
  it('with room in the budget, Classic keeps both the colors and the decorations', () => {
    const c = buildDesigns(sample, { ...w, budget: 3500, colored: true }).options.find((o) => o.tier === 'classic')!;
    expect(c.selection.componentIds).toEqual(expect.arrayContaining(['cv-buttercream', 'dc-flowers']));
  });
});
