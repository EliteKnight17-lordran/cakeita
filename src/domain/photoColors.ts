import { COLOR_WORDS, type ColorHit } from './requestReader';

/**
 * Read the main colors of an inspo photo, with no AI and no network.
 * Each pixel is sorted by hue, lightness and saturation into the color names we already
 * use for frosting (white, maroon, gold, sage…). Grays are treated as background
 * (table, board, wall) and very dark pixels as shadow. Pure code so it can be tested.
 */
export type Rgb = [number, number, number];

const HEX = new Map(COLOR_WORDS.map(([, name, hex]) => [name, hex]));
const hit = (name: string): ColorHit => ({ name, hex: HEX.get(name) ?? '#fbf7f0' });

function hsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** A color name for one pixel; 'gray' and 'shadow' are not cake colors. */
export function classify(px: Rgb): string {
  const { h, s, l } = hsl(px);
  if (l < 0.13) return 'shadow';
  // Neutrals: little color in them.
  if (s < 0.16 || (l > 0.88 && s < 0.5)) {
    if (l > 0.8) return px[0] - px[2] > 36 ? 'cream' : 'white';
    if (l < 0.22) return 'black';
    return 'gray';
  }
  // Pale and warm but not very colorful: ivory, beige, nude.
  if (l > 0.72 && s < 0.4 && h >= 20 && h < 60) return px[0] - px[2] > 36 ? 'cream' : l > 0.78 ? 'white' : 'gray';
  if (h < 18 || h >= 340) {
    if (l < 0.33) return 'maroon';
    if (l < 0.55) return 'red';
    if (l < 0.66 && s > 0.6) return 'hot pink';
    return l > 0.85 ? 'baby pink' : 'pink';
  }
  if (h < 40) {
    // Washed-out beige in the middle is usually white or cream frosting in shade.
    if (s < 0.3 && l >= 0.42) return 'gray';
    if (l < 0.5) return 'brown';
    if (l > 0.72) return s > 0.4 ? 'peach' : 'cream';
    return s < 0.45 ? 'brown' : 'orange';
  }
  if (h < 65) return l < 0.62 && s < 0.8 ? 'gold' : l > 0.72 && s < 0.6 ? 'cream' : 'yellow';
  if (h < 170) {
    if (l > 0.75) return 'mint';
    return s < 0.35 ? 'sage' : 'green';
  }
  if (h < 200) return 'teal';
  if (h < 250) {
    if (l < 0.32) return 'navy';
    return l > 0.7 ? 'baby blue' : 'blue';
  }
  if (h < 300) return l > 0.68 ? 'lavender' : 'purple';
  if (l > 0.85) return 'baby pink';
  return s > 0.55 && l < 0.66 ? 'hot pink' : 'pink';
}

const NOT_CAKE = new Set(['gray', 'shadow', 'black']);

function saturation(p: Rgb): number {
  return hsl(p).s;
}

/**
 * Frosting = the biggest cake color left after removing the background (the colors on the
 * photo's edge) and grays/shadows. Accent = the strongest other color, even when it covers
 * less (a maroon piped border, gold drip, pink flowers).
 */
export function colorsFromPhoto(center: Rgb[], border: Rgb[] = []): ColorHit[] {
  if (!center.length) return [];
  const bgCount = new Map<string, number>();
  for (const p of border) bgCount.set(classify(p), (bgCount.get(classify(p)) ?? 0) + 1);
  const bg = new Set([...bgCount].filter(([, n]) => n / border.length >= 0.25).map(([k]) => k));
  const rows = new Map<string, { name: string; n: number; sat: number; bg: boolean }>();
  for (const p of center) {
    const name = classify(p);
    const row = rows.get(name) ?? { name, n: 0, sat: 0, bg: bg.has(name) };
    row.n++;
    row.sat += saturation(p);
    rows.set(name, row);
  }
  const total = center.length;
  const ranked = [...rows.values()].sort((a, b) => b.n - a.n);
  const usable = (r: { name: string; bg: boolean }) => !NOT_CAKE.has(r.name) && !r.bg;
  // A white cake on a white table: if the background color is most of the middle, it is the cake.
  const frosting =
    ranked.find((r) => usable(r) && r.n / total >= 0.06) ??
    ranked.find((r) => !NOT_CAKE.has(r.name) && r.n / total >= 0.06) ??
    (ranked[0] && ranked[0].name === 'black' && ranked[0].n / total > 0.4 ? ranked[0] : undefined);
  if (!frosting) return [];
  const accent = ranked
    .filter((r) => r !== frosting && usable(r) && r.n / total >= 0.02)
    .map((r) => ({ r, score: r.n * (0.05 + (r.sat / r.n) ** 2) }))
    .sort((a, b) => b.score - a.score)[0]?.r;
  return accent ? [hit(frosting.name), hit(accent.name)] : [hit(frosting.name)];
}
