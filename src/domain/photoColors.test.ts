import { describe, expect, it } from 'vitest';
import { classify, colorsFromPhoto, type Rgb } from './photoColors';
import { withPhoto, type PhotoHints } from './photoHints';
import { readRequest } from './requestReader';
import { toPublicMenu } from './pricing';
import { createSampleBakery } from './starterMenus';

const fill = (c: Rgb, n: number) => Array.from({ length: n }, () => c);

describe('reading colors from an inspo photo (no AI)', () => {
  it('sorts real photo pixels into frosting color names', () => {
    expect(classify([57, 19, 20])).toBe('maroon'); // shaded maroon piping
    expect(classify([157, 143, 130])).toBe('gray'); // concrete table
    expect(classify([238, 236, 232])).toBe('white');
    expect(classify([212, 175, 55])).toBe('gold');
    expect(classify([246, 170, 195])).toBe('pink');
    expect(classify([201, 179, 230])).toBe('lavender');
    expect(classify([20, 15, 15])).toBe('shadow');
  });

  it('white cake with a maroon border on a concrete table (the real failing photo)', () => {
    const table = fill([157, 143, 130], 80);
    const center = [...fill([236, 233, 228], 50), ...fill([110, 25, 30], 18), ...fill([57, 19, 20], 10), ...fill([157, 143, 130], 30)];
    expect(colorsFromPhoto(center, table).map((c) => c.name)).toEqual(['white', 'maroon']);
  });

  it('a small strong accent beats a bigger washed-out beige', () => {
    const center = [...fill([246, 170, 195], 60), ...fill([212, 175, 55], 8), ...fill([226, 214, 196], 20)];
    expect(colorsFromPhoto(center, []).map((c) => c.name)).toEqual(['pink', 'gold']);
  });

  it('a white cake on a white table is still white', () => {
    expect(colorsFromPhoto(fill([240, 240, 238], 50), fill([240, 240, 238], 50)).map((c) => c.name)).toEqual(['white']);
  });

  it('no pixels, no colors', () => {
    expect(colorsFromPhoto([], [])).toEqual([]);
  });
});

describe('photo hints on the cake', () => {
  const menu = toPublicMenu(createSampleBakery(new Date(2026, 10, 9)));
  const hints: PhotoHints = {
    colors: [{ name: 'pink', hex: '#f4a7c0' }], componentIds: ['dc-drip', 'not-on-menu'], flavorId: null, coveringId: null, tiers: 2,
    theme: '', licensedNote: '', unavailable: ['macarons'], flowerStyle: 'cascade', topperSpot: null, summary: '', usedAi: true,
  };

  it('adds what the photo shows, only with ids on the menu', () => {
    const r = withPhoto(readRequest('cake for 20 pax', menu), hints, menu);
    expect(r.componentIds).toContain('dc-drip');
    expect(r.componentIds).not.toContain('not-on-menu');
    expect(r.tiers).toBe(2);
    expect(r.colors[0]?.name).toBe('pink');
    expect(r.unavailable).toContain('macarons');
  });

  it('words written on the cake in the photo carry over, unless the customer typed their own', () => {
    expect(withPhoto(readRequest('20 pax', menu), { ...hints, textOnCake: 'Happy Birthday' }, menu).textOnCake).toBe('Happy Birthday');
    expect(withPhoto(readRequest('"Happy 7th Mia" 20 pax', menu), { ...hints, textOnCake: 'Happy Birthday' }, menu).textOnCake).toBe('Happy 7th Mia');
  });

  it('what the customer typed wins over the photo', () => {
    const r = withPhoto(readRequest('1 tier blue cake', menu), hints, menu);
    expect(r.tiers).toBe(1);
    expect(r.colors[0]?.name).toBe('blue');
  });
});
