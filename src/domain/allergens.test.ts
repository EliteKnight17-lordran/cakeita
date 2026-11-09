import { describe, expect, it } from 'vitest';
import { allergiesInText, allergyHits, readAllergies, tagsFromText, withoutAllergens } from './allergens';
import { buildDesigns } from './designs';
import { toPublicMenu } from './pricing';
import { publicMenuSchema } from './schemas';
import { createSampleBakery } from './starterMenus';

const TODAY = new Date(2026, 10, 9);
const menu = toPublicMenu(createSampleBakery(TODAY), TODAY);
const part = (id: string) => menu.components.find((c) => c.id === id)!;

describe('allergen tags on the menu', () => {
  it('come from ingredient names and part words', () => {
    expect(part('dc-drip').a).toEqual(expect.arrayContaining(['chocolate', 'milk']));
    expect(part('cv-buttercream').a).toContain('milk');
    expect(part('fl-mocha').a).toEqual(expect.arrayContaining(['coffee', 'chocolate']));
    expect(part('dc-fruits').a).toContain('fruit');
    expect(part('tp-candles').a).toEqual([]);
    expect(menu.baseCakes[0]!.a).toEqual(expect.arrayContaining(['milk', 'egg', 'wheat']));
  });

  it('survive the menu schema, and older menus without tags still read', () => {
    expect(publicMenuSchema.parse(menu).components.find((c) => c.id === 'dc-drip')?.a).toContain('chocolate');
    const old = { ...menu, components: menu.components.map(({ a: _a, ...c }) => c) };
    expect(publicMenuSchema.safeParse(old).success).toBe(true);
  });

  it('do not mistake coconut for a nut or Manila for peanuts', () => {
    expect(tagsFromText('coconut flakes')).not.toContain('nuts');
    expect(tagsFromText('Manila delivery')).not.toContain('peanut');
    expect(tagsFromText('may mani')).toContain('peanut');
  });
});

describe('reading what the customer types', () => {
  it('splits a typed list in English or Taglish', () => {
    const a = readAllergies('mani, blueberries at itlog');
    expect(a.said).toEqual(['mani', 'blueberries', 'itlog']);
    expect(a.keys).toEqual(['peanut', 'fruit', 'egg']);
  });

  it('keeps unknown foods as typed', () => {
    const a = readAllergies('ube');
    expect(a.said).toEqual(['ube']);
    expect(a.keys).toEqual([null]);
  });

  it('is empty when nothing is typed', () => {
    expect(readAllergies('  ').said).toEqual([]);
  });

  it.each([
    ['Ube cake 20 pax, allergic to nuts po', 'nuts'],
    ['May allergy sa mani anak ko, chocolate cake', 'mani'],
    ['bawal ang itlog, 2k budget', 'itlog'],
    ['nut-free and dairy-free please', 'nut, dairy'],
    ['chocolate cake, walang gatas', 'gatas'],
    ['allergic to blueberries and strawberries', 'blueberries, strawberries'],
    ['chocolate cake for 20 pax', ''],
    ['no fondant please', ''],
  ])('finds allergies in "%s"', (text, found) => {
    expect(allergiesInText(text)).toBe(found);
  });
});

describe('warnings on a cake', () => {
  const sel = { baseCakeId: 'r6-2', componentIds: ['fl-choco', 'cv-buttercream', 'dc-drip', 'dc-fruits', 'tp-candles'] };

  it('names every picked part that matches, with the customer\'s own words', () => {
    const hits = allergyHits(menu, sel, readAllergies('chocolate, blueberries'));
    expect(hits.map((h) => h.id)).toEqual(['fl-choco', 'dc-drip', 'dc-fruits']);
    expect(hits.find((h) => h.id === 'dc-fruits')?.said).toEqual(['blueberries']);
  });

  it('warns about the sponge itself for egg, milk or flour', () => {
    const hits = allergyHits(menu, sel, readAllergies('itlog'));
    expect(hits[0]).toMatchObject({ kind: 'base', said: ['itlog'] });
  });

  it('matches an unknown food by the part name', () => {
    const hits = allergyHits(menu, { ...sel, componentIds: ['fl-ube', 'cv-whipped'] }, readAllergies('ube'));
    expect(hits.map((h) => h.id)).toEqual(['fl-ube']);
  });

  it('has nothing to say with no allergies', () => {
    expect(allergyHits(menu, sel, readAllergies(''))).toEqual([]);
  });
});

describe('designs that avoid allergens', () => {
  const wants = { servings: 12, budget: null, tiers: null, sizeIn: null, flavorId: 'fl-choco', coveringId: null, componentIds: ['dc-drip', 'dc-sprinkles'], textOnCake: '' };

  it('leave out matching parts and pick a safe flavor', () => {
    const d = buildDesigns(menu, { ...wants, avoid: readAllergies('chocolate') });
    for (const o of d.options) {
      expect(o.selection.componentIds).not.toContain('dc-drip');
      expect(o.selection.componentIds).not.toContain('fl-choco');
    }
    // The designs that keep decorations still keep the safe ones.
    expect(d.options.find((o) => o.tier === 'classic')?.selection.componentIds).toContain('dc-sprinkles');
  });

  it('still makes a cake when every frosting has milk (the warning says ask the baker)', () => {
    const d = buildDesigns(menu, { ...wants, avoid: readAllergies('milk') });
    expect(d.options.length).toBeGreaterThan(0);
    for (const o of d.options) expect(o.selection.componentIds.some((id) => part(id)?.category === 'covering')).toBe(true);
  });

  it('keeps must-have groups when all of them match', () => {
    const parts = withoutAllergens(menu.components, readAllergies('milk'));
    expect(parts.some((p) => p.category === 'covering')).toBe(true);
    expect(parts.find((p) => p.id === 'dc-drip')).toBeUndefined();
  });
});
