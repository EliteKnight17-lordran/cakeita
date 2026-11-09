import { isMotifKey, type MotifKey } from './motifs';
import type { CakeLook, FlowerStyle, PublicMenu, Selection, TopperSpot, Visual } from './types';

/** Everything the 3D (or 2D fallback) cake needs. Built from the SAME parts that are priced. */
export interface CakeVisual {
  tiers: Array<{ d: number; h: number }>;
  covering: Visual;
  frosting: string;
  accent: string;
  sponge: string;
  drip: boolean;
  dripColor: string;
  sprinkles: boolean;
  flowers: boolean;
  rosettes: boolean;
  pearls: boolean;
  fruits: boolean;
  /** Toy building bricks made of fondant, on top and around the base. */
  bricks: boolean;
  /** Edible printed picture on the front of the bottom tier (a plain picture frame, never a logo). */
  print: boolean;
  /** Words on the edible print, when there is no piped message part to carry them. */
  printText: string;
  /** Fondant brick wall around the lower half of the bottom tier. */
  brickwall: boolean;
  /** Word on the fondant banner (the celebrant's name), or '' when there is no banner. */
  banner: string;
  /** Blocky game-style fondant figures: three on top, two standing at the base. */
  blockfigs: boolean;
  /** The age on a fondant number topper, or '' when there is none. */
  ageNumber: string;
  /** Fondant tree, small trophy and bars on top. */
  props: boolean;
  /** The cake sits on a scalloped cake board on the table (no stand), with the message on the board. */
  tableBoard: boolean;
  candles: number;
  text: string;
  textStyle: 'piped' | 'acrylic' | null;
  figure: boolean;
  /** Theme topper shape and its two colors, or null when no theme topper is picked. */
  motif: { key: MotifKey; main: string; accent: string } | null;
  gold: boolean;
  /** What the cake stands on: the baker's priced stand, or a plain porcelain one (also used for the customer's own stand). */
  stand: 'porcelain' | 'gold' | 'wood';
  flowerStyle: FlowerStyle;
  topperSpot: TopperSpot;
}

const COVERING_DEFAULT: Partial<Record<Visual, string>> = {
  buttercream: '#fbf1e4',
  whipped: '#fffaf3',
  fondant: '#fdfbf7',
  ganache: '#4a2a1a',
  naked: '#f3e4c8',
};

/** Darken (amount < 0) or lighten (amount > 0) a hex color. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Very light colors (cream, white) vanish on a cream cake, so the topper uses the accent instead. */
function isPale(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 225;
}

/** The banner carries the celebrant's name; with no name yet it says LEVEL UP (never a brand or logo). */
export function bannerWord(look: CakeLook): string {
  const name = (look.name ?? '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().toUpperCase().slice(0, 12);
  return name || 'LEVEL UP';
}

export function toVisual(menu: PublicMenu, sel: Selection, look: CakeLook): CakeVisual {
  const base = menu.baseCakes.find((b) => b.id === sel.baseCakeId) ?? menu.baseCakes[0];
  const parts = sel.componentIds.map((id) => menu.components.find((c) => c.id === id)).filter((c) => !!c);
  const has = (v: Visual) => parts.some((p) => p.visual === v);
  const coveringPart = parts.find((p) => p.category === 'covering');
  const covering: Visual = coveringPart?.visual ?? 'buttercream';
  const flavor = parts.find((p) => p.category === 'flavor');
  const sponge = flavor?.color ?? '#f6e3b4';
  const colors = look.colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  let frosting = colors[0] ?? COVERING_DEFAULT[covering] ?? '#fbf1e4';
  if (covering === 'ganache') frosting = COVERING_DEFAULT.ganache!;
  if (covering === 'naked') frosting = shade(sponge, 0.15);
  const accent = colors[1] ?? (colors[0] ? shade(colors[0], -0.25) : '#b3164f');
  const goldWanted = colors.some((c) => c.toLowerCase() === '#d4af37');
  const dripColor = goldWanted ? '#d4af37' : covering === 'ganache' ? '#f3e7d3' : '#4a2a1a';
  const textStyle = has('acrylic') ? 'acrylic' : has('text') ? 'piped' : null;
  return {
    tiers: (base?.tiers ?? [6]).map((d, i) => ({ d, h: base?.heights[i] ?? 4 })),
    covering,
    frosting,
    accent,
    sponge,
    drip: has('drip'),
    dripColor,
    sprinkles: has('sprinkles'),
    flowers: has('flowers'),
    rosettes: has('rosettes'),
    pearls: has('pearls'),
    fruits: has('fruits'),
    bricks: has('bricks'),
    print: has('print'),
    printText: has('print') && !textStyle ? look.textOnCake.trim().slice(0, 22) : '',
    brickwall: has('brickwall'),
    banner: has('banner') ? bannerWord(look) : '',
    blockfigs: has('blockfigs'),
    ageNumber: has('number') ? String(look.age ?? Math.max(1, look.candles || 1)).slice(0, 3) : '',
    props: has('props'),
    tableBoard: !has('stand-gold') && !has('stand-wood') && (has('brickwall') || has('blockfigs') || has('banner')),
    candles: has('candles') ? Math.max(1, Math.min(10, look.candles || 1)) : 0,
    text: textStyle ? look.textOnCake.slice(0, 32) : '',
    textStyle: textStyle && look.textOnCake.trim() ? textStyle : null,
    figure: has('figure'),
    motif: has('motif')
      ? {
          key: isMotifKey(look.motif) ? look.motif : 'star',
          main: colors[0] && !isPale(colors[0]) ? colors[0] : accent,
          accent: colors[1] ?? (colors[0] && !isPale(colors[0]) ? '#d4af37' : shade(accent, 0.35)),
        }
      : null,
    gold: has('gold'),
    stand: has('stand-gold') ? 'gold' : has('stand-wood') ? 'wood' : 'porcelain',
    flowerStyle: look.flowerStyle ?? 'side',
    topperSpot: look.topperSpot ?? 'center',
  };
}
