import { COLOR_WORDS, type ColorHit } from './requestReader';

/**
 * Read the main colors of an inspo photo, with no AI and no network.
 * Each sampled pixel goes to the nearest named color we already use for frosting
 * (pink, gold, sage…); the two most common become frosting and accent.
 * Pure code so it can be tested without a browser.
 */
export type Rgb = [number, number, number];

const PALETTE = COLOR_WORDS.map(([, name, hex]) => {
  const n = parseInt(hex.slice(1), 16);
  return { name, hex, rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255] as Rgb };
});

/** Perceptual-ish distance ("redmean"), good enough to tell blush from peach. */
function dist(a: Rgb, b: Rgb): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

export function nearestColor(c: Rgb): ColorHit {
  let best = PALETTE[0]!;
  let d = Infinity;
  for (const p of PALETTE) {
    const x = dist(c, p.rgb);
    if (x < d) {
      d = x;
      best = p;
    }
  }
  return { name: best.name, hex: best.hex };
}

/**
 * Up to two colors that cover a fair share of the cake. Gray and near-black are left out
 * when there is a real color too, because they are usually the table, plate or shadows.
 */
export function colorsFromPixels(pixels: Rgb[], minShare = 0.08): ColorHit[] {
  if (!pixels.length) return [];
  const counts = new Map<string, { hit: ColorHit; n: number }>();
  for (const p of pixels) {
    const hit = nearestColor(p);
    const row = counts.get(hit.name) ?? { hit, n: 0 };
    row.n++;
    counts.set(hit.name, row);
  }
  const ranked = [...counts.values()].filter((r) => r.n / pixels.length >= minShare).sort((a, b) => b.n - a.n);
  const background = new Set(['silver', 'black']);
  const colorful = ranked.filter((r) => !background.has(r.hit.name));
  return (colorful.length ? colorful : ranked).slice(0, 2).map((r) => r.hit);
}
