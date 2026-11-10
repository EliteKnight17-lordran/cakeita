import { describe, expect, it } from 'vitest';
import { mergeReading } from '../ai/merge';
import { buildDesigns } from './designs';
import { isMotifKey, MOTIF_KEYS, MOTIFS, motifFor, themeMotif } from './motifs';
import { priceSelection, toPublicMenu } from './pricing';
import { readRequest, TRADEMARKS } from './requestReader';
import { cakeVisualSchema, lookSchema } from './schemas';
import { createBakeryFromStarter, createSampleBakery, upgradeBakery } from './starterMenus';
import { toVisual } from './visual';

const TODAY = new Date(2026, 10, 6);
const bakery = createSampleBakery(TODAY);
const menu = toPublicMenu(bakery, TODAY);

describe('motif shapes', () => {
  it('has a shape for every key, with clean path data', () => {
    for (const k of MOTIF_KEYS) {
      const m = MOTIFS[k];
      expect(m.key).toBe(k);
      expect(m.layers.length).toBeGreaterThan(0);
      for (const l of m.layers) {
        expect(l.d).toMatch(/^M/);
        expect(l.d).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });
});

describe('themeMotif', () => {
  it.each([
    ['red and blue web hero', 'web'],
    ['dark knight hero with a mask', 'mask'],
    ['green power ring hero', 'ring'],
    ['flying hero with a cape', 'cape'],
    ['thunder hero', 'bolt'],
    ['superhero', 'hero'],
    ['ice princess with snowflakes', 'snowflake'],
    ['fairytale princess', 'crown'],
    ['pink fashion doll', 'crown'],
    ['puppy rescue team', 'paw'],
    ['yellow electric creature', 'bolt'],
    ['pixel blocks', 'blocks'],
    ['red race car', 'car'],
    ['dinosaur', 'dino'],
    ['unicorn', 'unicorn'],
    ['mermaid', 'shell'],
    ['space', 'rocket'],
    ['sports', 'ball'],
    ['butterfly', 'butterfly'],
    ['rainbow', 'rainbow'],
    ['happy bee mascot', 'star'],
  ])('%s -> %s', (theme, key) => {
    expect(themeMotif(theme)).toBe(key);
  });

  it('gives every trademark theme a shape, so a character request is never left plain', () => {
    for (const [, theme] of TRADEMARKS) expect(isMotifKey(themeMotif(theme))).toBe(true);
  });

  it('skips style themes and empty themes', () => {
    for (const t of ['', 'minimalist', 'rustic', 'vintage piping', 'floral garden']) expect(themeMotif(t)).toBe('');
  });

  it('does not read "nice" as ice', () => {
    expect(themeMotif('nice and simple party')).toBe('star');
  });

  it('falls back to the occasion', () => {
    expect(motifFor('', 'Graduation')).toBe('grad');
    expect(motifFor('', 'Wedding')).toBe('heart');
    expect(motifFor('', 'Debut')).toBe('crown');
    expect(motifFor('', 'Birthday')).toBe('star');
    expect(motifFor('dinosaur', 'Graduation')).toBe('dino');
  });
});

describe('theme topper in the reader and price', () => {
  it('adds the theme topper for a character request, priced by code', () => {
    const r = readRequest('Spider-Man cake for my son, 7th birthday, 20 pax, budget 2k', menu, TODAY);
    expect(r.theme).toBe('red and blue web hero');
    expect(r.componentIds).toContain('tp-theme');
    expect(r.licensedNote).toMatch(/licensed topper/);
    const d = buildDesigns(menu, { servings: r.servings, budget: r.budget, tiers: r.tiers, sizeIn: r.sizeIn, flavorId: r.flavorId, coveringId: r.coveringId, componentIds: r.componentIds, textOnCake: r.textOnCake });
    const classic = d.options.find((o) => o.tier === 'classic')!;
    expect(classic.selection.componentIds).toContain('tp-theme');
    const withTopper = priceSelection(bakery, classic.selection)!;
    const without = priceSelection(bakery, { ...classic.selection, componentIds: classic.selection.componentIds.filter((x) => x !== 'tp-theme') })!;
    expect(withTopper.suggestedPrice).toBeGreaterThan(without.suggestedPrice);
  });

  it('leaves plain requests alone', () => {
    expect(readRequest('chocolate cake, 12 pax, minimalist', menu, TODAY).componentIds).not.toContain('tp-theme');
  });

  it('adds the topper when only the AI found the theme', () => {
    const rule = readRequest('cake po for 15', menu, TODAY);
    const merged = mergeReading(rule, {
      occasion: 'Birthday', servings: null, budget: null, tiers: null, theme: 'dinosaur', colors: [], flavorId: null, coveringId: null,
      componentIds: [], textOnCake: '', baseCakeId: null, detectedButUnavailable: [], summaryTaglish: '', confidence: 0.8,
    } as never, menu);
    expect(merged.componentIds).toContain('tp-theme');
  });

  it('skips the topper when the baker does not make it', () => {
    const b = createBakeryFromStarter('home', { name: 'X' }, TODAY);
    const m = toPublicMenu({ ...b, components: b.components.map((c) => (c.id === 'tp-theme' ? { ...c, canMake: false } : c)) }, TODAY);
    expect(readRequest('dinosaur cake', m, TODAY).componentIds).not.toContain('tp-theme');
  });
});

describe('theme topper on the cake picture', () => {
  const sel = { baseCakeId: menu.baseCakes[0]!.id, componentIds: ['fl-vanilla', 'cv-buttercream', 'tp-theme'] };

  it('draws only when the priced part is picked', () => {
    expect(toVisual(menu, sel, { colors: ['#d8343b', '#2f5fb3'], textOnCake: '', candles: 0, motif: 'hero' }).motif).toEqual({ key: 'hero', main: '#d8343b', accent: '#2f5fb3' });
    expect(toVisual(menu, { ...sel, componentIds: ['fl-vanilla'] }, { colors: [], textOnCake: '', candles: 0, motif: 'hero' }).motif).toBeNull();
  });

  it('uses a star when the saved shape is unknown, and avoids pale colors', () => {
    const v = toVisual(menu, sel, { colors: ['#fffaf3'], textOnCake: '', candles: 0, motif: 'nope' });
    expect(v.motif?.key).toBe('star');
    expect(v.motif?.main).not.toBe('#fffaf3');
  });
});

describe('saved data', () => {
  it('accepts a topper shape in links and drops unknown ones', () => {
    expect(lookSchema.parse({ colors: [], textOnCake: '', candles: 0, motif: 'dino' }).motif).toBe('dino');
    expect(lookSchema.parse({ colors: [], textOnCake: '', candles: 0, motif: 'mickey' }).motif).toBeUndefined();
    expect(lookSchema.parse({ colors: [], textOnCake: '', candles: 0 }).motif).toBeUndefined();
  });

  it('reads quote links made before toppers existed, and keeps the topper in new ones', () => {
    const v = toVisual(menu, { baseCakeId: menu.baseCakes[0]!.id, componentIds: ['fl-vanilla', 'tp-theme'] }, { colors: ['#d8343b'], textOnCake: '', candles: 0, motif: 'dino' });
    expect(cakeVisualSchema.parse(v).motif?.key).toBe('dino');
    const old: Partial<typeof v> = { ...v };
    delete old.motif;
    expect(cakeVisualSchema.parse(old).motif).toBeNull();
    expect(cakeVisualSchema.parse({ ...v, motif: { key: 'mickey', main: '#000000', accent: '#000000' } }).motif).toBeNull();
  });

  it('draws blocks and an edible print only when they are priced, and reads older links without them', () => {
    const sel = (ids: string[]) => ({ baseCakeId: menu.baseCakes[0]!.id, componentIds: ['fl-vanilla', ...ids] });
    const look = { colors: ['#f5d34a', '#d23a3a'], textOnCake: '', candles: 0 };
    expect(toVisual(menu, sel([]), look)).toMatchObject({ bricks: false, print: false });
    const v = toVisual(menu, sel(['dc-bricks', 'dc-print']), look);
    expect(v).toMatchObject({ bricks: true, print: true });
    const old: Partial<typeof v> = { ...v };
    delete old.bricks;
    delete old.print;
    expect(cakeVisualSchema.parse(old)).toMatchObject({ bricks: false, print: false });
  });

  it('adds the new part to bakeries saved before it existed (off for real bakers)', () => {
    const old = createBakeryFromStarter('home', { name: 'Old' }, TODAY);
    const stripped = { ...old, components: old.components.filter((c) => c.id !== 'tp-theme') };
    const up = upgradeBakery(stripped);
    expect(up.components.find((c) => c.id === 'tp-theme')?.canMake).toBe(false);
    expect(upgradeBakery({ ...stripped, isSample: true }).components.find((c) => c.id === 'tp-theme')?.canMake).toBe(true);
    expect(upgradeBakery(old)).toBe(old);
  });
});

describe('different heroes get different toppers', () => {
  it.each([
    ['Spiderman cake 20 pax', 'web'],
    ['Green Lantern theme cake for my son', 'ring'],
    ['batman cake', 'mask'],
    ['Superman 5th birthday', 'cape'],
    ['superhero theme cake, blue and red', 'hero'],
  ])('%s', (text, motif) => {
    const r = readRequest(text, menu, TODAY);
    expect(motifFor(r.theme, 'Birthday')).toBe(motif);
    expect(r.componentIds).toContain('tp-theme');
  });
  it('green lantern is a character, so it gets the licensed topper note', () => {
    expect(readRequest('green lantern cake', menu, TODAY).licensedNote).toMatch(/licensed topper/);
  });
});
