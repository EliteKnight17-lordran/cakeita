import { describe, expect, it } from 'vitest';
import { colorsFromPixels, nearestColor, type Rgb } from './photoColors';
import { withPhoto, type PhotoHints } from './photoHints';
import { readRequest } from './requestReader';
import { toPublicMenu } from './pricing';
import { createSampleBakery } from './starterMenus';

const fill = (c: Rgb, n: number) => Array.from({ length: n }, () => c);

describe('reading colors from an inspo photo (no AI)', () => {
  it('maps pixels to the named frosting colors', () => {
    expect(nearestColor([246, 170, 195]).name).toBe('pink');
    expect(nearestColor([212, 175, 55]).name).toBe('gold');
    expect(nearestColor([250, 247, 240]).name).toBe('white');
  });

  it('frosting first, accent second, and ignores small specks', () => {
    const px = [...fill([246, 170, 195], 60), ...fill([212, 175, 55], 25), ...fill([60, 120, 200], 3)];
    expect(colorsFromPixels(px).map((c) => c.name)).toEqual(['pink', 'gold']);
  });

  it('leaves out a gray table or dark shadow when the cake has a real color', () => {
    const px = [...fill([192, 192, 200], 50), ...fill([150, 102, 196], 40), ...fill([30, 30, 30], 10)];
    expect(colorsFromPixels(px).map((c) => c.name)).toEqual(['purple']);
  });

  it('no pixels, no colors', () => {
    expect(colorsFromPixels([])).toEqual([]);
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

  it('what the customer typed wins over the photo', () => {
    const r = withPhoto(readRequest('1 tier blue cake', menu), hints, menu);
    expect(r.tiers).toBe(1);
    expect(r.colors[0]?.name).toBe('blue');
  });
});
