import { describe, expect, it } from 'vitest';
import { ownText } from './placement';
import { cakeRequestSchema, lookSchema } from './schemas';
import { createSampleBakery, upgradeBakery } from './starterMenus';
import { toPublicMenu } from './pricing';
import { toVisual } from './visual';
import { buildDesigns } from './designs';

const menu = toPublicMenu(createSampleBakery(new Date('2026-11-09T00:00:00Z')));
const base = menu.baseCakes[0]!.id;

describe('cake stands, placement and own items', () => {
  it('draws the stand that is priced, or a plain one', () => {
    const look = { colors: [], textOnCake: '', candles: 0 };
    expect(toVisual(menu, { baseCakeId: base, componentIds: ['ds-gold'] }, look).stand).toBe('gold');
    expect(toVisual(menu, { baseCakeId: base, componentIds: ['ds-wood'] }, look).stand).toBe('wood');
    expect(toVisual(menu, { baseCakeId: base, componentIds: [] }, { ...look, own: ['stand'] }).stand).toBe('porcelain');
  });

  it('keeps placement choices in the cake picture', () => {
    const v = toVisual(menu, { baseCakeId: base, componentIds: ['dc-flowers'] }, { colors: [], textOnCake: '', candles: 0, flowerStyle: 'cascade', topperSpot: 'side' });
    expect(v.flowerStyle).toBe('cascade');
    expect(v.topperSpot).toBe('side');
    expect(toVisual(menu, { baseCakeId: base, componentIds: [] }, { colors: [], textOnCake: '', candles: 0 }).flowerStyle).toBe('side');
  });

  it('accepts old links and drops unknown placement values', () => {
    expect(lookSchema.parse({ colors: [], textOnCake: '', candles: 0 })).toEqual({ colors: [], textOnCake: '', candles: 0 });
    const odd = lookSchema.parse({ colors: [], textOnCake: '', candles: 0, flowerStyle: 'everywhere', own: ['car'] });
    expect(odd.flowerStyle).toBeUndefined();
    expect(odd.own).toBeUndefined();
    expect(lookSchema.parse({ colors: [], textOnCake: '', candles: 0, own: ['topper', 'stand'] }).own).toEqual(['topper', 'stand']);
    expect(cakeRequestSchema.shape.look).toBe(lookSchema);
  });

  it('never adds a stand to the automatic designs', () => {
    const r = buildDesigns(menu, { servings: 30, budget: 6000, tiers: 2, sizeIn: null, flavorId: null, coveringId: null, componentIds: ['dc-flowers'], textOnCake: '' });
    expect(r.options.length).toBeGreaterThan(0);
    for (const d of r.options) expect(d.selection.componentIds.some((id) => id.startsWith('ds-'))).toBe(false);
  });

  it('adds stands to older saved bakeries, off for real bakers', () => {
    const b = createSampleBakery();
    const old = { ...b, isSample: false, components: b.components.filter((c) => c.category !== 'display') };
    const up = upgradeBakery(old);
    const stands = up.components.filter((c) => c.category === 'display');
    expect(stands.map((c) => c.id).sort()).toEqual(['ds-gold', 'ds-wood']);
    expect(stands.every((c) => !c.canMake)).toBe(true);
  });

  it('says what the customer brings in their language', () => {
    expect(ownText(['topper', 'stand'], 'en')).toBe('I will bring my own topper and cake stand.');
    expect(ownText(['figurine'], 'tl')).toBe('Magdadala ako ng sariling figurine o laruan.');
    expect(ownText([], 'en')).toBe('');
  });
});
