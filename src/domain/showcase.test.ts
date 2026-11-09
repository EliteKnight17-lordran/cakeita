import { describe, expect, it } from 'vitest';
import { buildDesigns } from './designs';
import { findPrint, fingerprintAt, hashDistance, type PixelGrid } from './photoPrint';
import { photoText, withPhoto } from './photoHints';
import { toPublicMenu } from './pricing';
import { readName, readRequest } from './requestReader';
import { cakeVisualSchema, lookSchema } from './schemas';
import { findShowcase, SHOWCASES, showcaseHints } from './showcase';
import { createSampleBakery } from './starterMenus';
import { bannerWord, toVisual } from './visual';

const TODAY = new Date(2026, 10, 9);
const menu = toPublicMenu(createSampleBakery(TODAY), TODAY);
const hero = SHOWCASES.find((s) => s.key === 'block-hero')!;

/** A test picture: colored blocks from a seed (looks nothing like a cake photo, on purpose). */
function blocks(seed: number, size = 72): PixelGrid {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const cells = Array.from({ length: 64 }, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = cells[Math.floor((y / size) * 8) * 8 + Math.floor((x / size) * 8)]!;
      data.set([c[0]!, c[1]!, c[2]!, 255], (y * size + x) * 4);
    }
  }
  return { w: size, h: size, data };
}

/** Put a picture inside a bigger one (like a phone screenshot with bars above and below). */
function embed(p: PixelGrid, w: number, h: number, x0: number, y0: number, fill = 240): PixelGrid {
  const data = new Uint8ClampedArray(w * h * 4).fill(fill);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) for (let k = 0; k < 4; k++) data[((y + y0) * w + x + x0) * 4 + k] = p.data[(y * p.w + x) * 4 + k]!;
  return { w, h, data };
}

describe('photo fingerprint', () => {
  const pic = blocks(11);
  const ref = fingerprintAt(pic, 0, 0, 72);

  it('is 64 bits and matches itself', () => {
    expect(ref.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(ref.colors).toHaveLength(48);
    expect(findPrint(pic, ref)).toEqual({ bits: 0, colorDiff: 0 });
  });

  it('finds the photo inside a taller screenshot', () => {
    expect(findPrint(embed(pic, 72, 156, 0, 40), ref)?.bits).toBeLessThanOrEqual(2);
  });

  it('survives small changes in brightness', () => {
    const noisy = { ...pic, data: Uint8ClampedArray.from(pic.data, (v, i) => (i % 4 === 3 ? v : Math.min(255, v + ((i * 7) % 9) - 4))) };
    expect(findPrint(noisy, ref)).not.toBeNull();
  });

  it('does not match a different picture, a blank one or a tiny one', () => {
    for (const seed of [2, 3, 4, 5, 6]) expect(findPrint(blocks(seed), ref)).toBeNull();
    expect(findPrint(embed(blocks(1, 1), 72, 72, 0, 0, 200), ref)).toBeNull();
    expect(findPrint({ w: 8, h: 8, data: new Uint8ClampedArray(256) }, ref)).toBeNull();
  });

  it('counts differing bits', () => {
    expect(hashDistance('0000000000000000', '000000000000000f')).toBe(4);
    expect(hashDistance('ffffffffffffffff', '0000000000000000')).toBe(64);
  });
});

describe('featured designs', () => {
  it('never mistakes other pictures for a featured design', () => {
    for (const seed of [1, 7, 21, 99, 123]) expect(findShowcase(blocks(seed))).toBeNull();
    expect(findShowcase(embed(blocks(5, 1), 72, 72, 0, 0, 230))).toBeNull();
  });

  it('keeps its fingerprints well formed', () => {
    for (const s of SHOWCASES) {
      expect(s.prints.length).toBeGreaterThan(0);
      for (const p of s.prints) {
        expect(p.hash).toMatch(/^[0-9a-f]{16}$/);
        expect(p.colors).toHaveLength(48);
      }
    }
  });

  it('turns into photo hints that use only the menu parts, with no price', () => {
    const h = showcaseHints(hero, menu);
    const ids = new Set(menu.components.map((c) => c.id));
    expect(h.componentIds.length).toBe(hero.componentIds.length);
    expect(h.componentIds.every((id) => ids.has(id))).toBe(true);
    expect(h.coveringId).toBe('cv-fondant');
    expect(h.colors.map((c) => c.name)).toEqual(['sky blue', 'red']);
    expect(h.showcase).toBe('block-hero');
    expect(h.licensedNote).toMatch(/licensed topper/);
    expect(JSON.stringify(h)).not.toMatch(/price|₱/i);
    // A baker without the parts gets only what they have.
    const lean = { ...menu, components: menu.components.filter((c) => !['tp-blockfigs', 'dc-props'].includes(c.id)) };
    expect(showcaseHints(hero, lean).componentIds).not.toContain('tp-blockfigs');
  });

  it("uses the customer's own name, age, colors and people", () => {
    const typed = readRequest("para kay Migo's 7th birthday, green and yellow, 30 pax", menu, TODAY);
    const r = withPhoto(typed, showcaseHints(hero, menu), menu);
    expect(r.age).toBe(7);
    expect(r.textOnCake).toBe('Happy 7th Birthday');
    expect(r.colors.map((c) => c.name)).toEqual(['green', 'yellow']);
    expect(r.servings).toBe(30);
    expect(readName("para kay Migo's 7th birthday", r.textOnCake)).toBe('Migo');
  });

  it("keeps the photo's age, words and size when nothing is typed", () => {
    const r = withPhoto(readRequest('', menu, TODAY), showcaseHints(hero, menu), menu);
    expect(r.age).toBe(11);
    expect(r.textOnCake).toBe('Happy 11th Birthday');
    expect(r.servings).toBe(12);
    expect(r.colors.map((c) => c.name)).toEqual(['sky blue', 'red']);
  });

  it('builds three price levels, and the biggest one is a bigger cake, not extra decorations', () => {
    const h = showcaseHints(hero, menu);
    const wants = { servings: 12, budget: null, tiers: 1, sizeIn: null, flavorId: null, coveringId: h.coveringId, componentIds: h.componentIds, textOnCake: 'Happy 11th Birthday' };
    const d = buildDesigns(menu, wants);
    const classic = d.options.find((o) => o.tier === 'classic')!;
    const show = d.options.find((o) => o.tier === 'showstopper')!;
    expect(h.componentIds.every((id) => classic.selection.componentIds.includes(id))).toBe(true);
    expect(show.selection.componentIds.filter((id) => !classic.selection.componentIds.includes(id))).toEqual([]);
    expect(show.estimate).toBeGreaterThan(classic.estimate);
    // With a budget, the Classic keeps the most important parts first (banner and number before figures).
    const tight = buildDesigns(menu, { ...wants, budget: classic.estimate - 400 }).options.find((o) => o.tier === 'classic')!;
    expect(tight.estimate).toBeLessThanOrEqual(classic.estimate - 400);
    expect(tight.selection.componentIds).toContain('dc-banner');
  });
});

describe('message from the photo', () => {
  it('swaps in the typed age', () => {
    const h = showcaseHints(hero, menu);
    expect(photoText(h, 7)).toBe('Happy 7th Birthday');
    expect(photoText(h, 21)).toBe('Happy 21st Birthday');
    expect(photoText(h, 12)).toBe('Happy 12th Birthday');
    expect(photoText(h, null)).toBe('Happy 11th Birthday');
  });
});

describe('readName', () => {
  it.each([
    ["Ube cake for Migo's 7th birthday", 'Migo'],
    ['para kay Ana po, 20 pax', 'Ana'],
    ['for my son Ethan, turning 9', 'Ethan'],
    ['anak kong Lia', 'Lia'],
    ['Name: Bea', 'Bea'],
    ['for 20 pax, budget 2k', ''],
    ['For Christmas party', ''],
    ['cake for my mom', ''],
  ])('%s -> %s', (text, name) => {
    expect(readName(text)).toBe(name);
  });

  it('reads the name after Happy Birthday in the message', () => {
    expect(readName('chocolate cake', 'Happy Birthday Kiko')).toBe('Kiko');
  });
});

describe('block-game parts on the cake', () => {
  const sel = (ids: string[], baseCakeId = 'r6-2') => ({ baseCakeId, componentIds: ['fl-vanilla', 'cv-fondant', ...ids] });
  const look = { colors: ['#86c5e8', '#d23a3a'], textOnCake: 'Happy 7th Birthday', candles: 7, name: 'Migo', age: 7 };

  it('draws only the picked parts, with the name and age', () => {
    const v = toVisual(menu, sel(['dc-banner', 'tp-number', 'tp-text', 'dc-brickwall', 'tp-blockfigs', 'dc-props']), look);
    expect(v).toMatchObject({ banner: 'MIGO', ageNumber: '7', brickwall: true, blockfigs: true, props: true, tableBoard: true, text: 'Happy 7th Birthday' });
    const plain = toVisual(menu, sel([]), look);
    expect(plain).toMatchObject({ banner: '', ageNumber: '', brickwall: false, blockfigs: false, props: false, tableBoard: false });
  });

  it('says LEVEL UP with no name, and never more than 12 letters', () => {
    expect(bannerWord({ ...look, name: undefined })).toBe('LEVEL UP');
    expect(bannerWord({ ...look, name: 'Maximilianoooo' })).toHaveLength(12);
  });

  it('keeps a paid stand instead of the plain board', () => {
    expect(toVisual(menu, sel(['dc-brickwall', 'ds-gold']), look).tableBoard).toBe(false);
  });

  it('round-trips through quote links, and older links still open', () => {
    const v = toVisual(menu, sel(['dc-banner', 'tp-number', 'dc-brickwall']), look);
    expect(cakeVisualSchema.parse(v)).toEqual(v);
    const old: Record<string, unknown> = { ...v };
    for (const k of ['brickwall', 'banner', 'blockfigs', 'ageNumber', 'props', 'tableBoard']) delete old[k];
    expect(cakeVisualSchema.parse(old)).toMatchObject({ brickwall: false, banner: '', tableBoard: false });
    expect(lookSchema.parse(look)).toMatchObject({ name: 'Migo', age: 7 });
    expect(lookSchema.parse({ ...look, age: 999 }).age).toBeUndefined();
  });

  it('reads the parts from words, without mixing up brick wall and building blocks', () => {
    const r = readRequest('fondant cake with brick wall, name banner, number topper and blocky figures', menu, TODAY);
    expect(r.componentIds).toEqual(expect.arrayContaining(['dc-brickwall', 'dc-banner', 'tp-number', 'tp-blockfigs']));
    expect(r.componentIds).not.toContain('dc-bricks');
  });

  it('a typed game name becomes generic blocky figures', () => {
    const r = readRequest('roblox cake for Migo', menu, TODAY);
    expect(r.theme).toBe('blocky game world');
    expect(r.componentIds).toContain('tp-blockfigs');
    expect(r.licensedNote).toMatch(/licensed/);
  });
});
