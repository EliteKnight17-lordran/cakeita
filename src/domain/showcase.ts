import { findPrint, type Fingerprint, type PixelGrid } from './photoPrint';
import type { PhotoHints } from './photoHints';
import { colorByName, type ColorHit } from './requestReader';
import type { PublicMenu } from './types';

/**
 * Featured designs: a few well-known inspo photos that Cakeita recognizes on the phone
 * (by fingerprint, no AI, no network) and rebuilds in full detail from priced menu parts.
 * The customer's own name, age, colors, number of people and budget still shape the cake,
 * and the baker still approves the price. Only the fingerprint is stored, never the photo.
 */
export interface Showcase {
  key: string;
  name: [string, string];
  /** The whole photo and two centered crops (so a cropped copy is still recognized). */
  prints: Fingerprint[];
  /** Color names from the color list, or a color of its own. */
  colors: Array<string | ColorHit>;
  coveringId: string;
  /** In order of importance: the Classic design keeps the first ones that fit the budget. */
  componentIds: string[];
  tiers: number;
  /** About how many people the cake in the photo feeds (an estimate from its size). */
  servings: number;
  theme: string;
  textOnCake: string;
  age: number | null;
  licensedNote: string;
  summary: string;
}

export const SHOWCASES: Showcase[] = [
  {
    key: 'block-hero',
    name: ['Block-game birthday cake', 'Block-game na birthday cake'],
    prints: [
      { hash: '909c9e8607070f00', colors: [225, 201, 227, 192, 177, 190, 216, 187, 209, 207, 178, 207, 230, 207, 231, 173, 168, 164, 163, 169, 175, 217, 191, 217, 233, 215, 232, 161, 129, 130, 115, 87, 92, 200, 173, 200, 233, 215, 233, 220, 190, 202, 210, 175, 190, 217, 194, 219] },
      { hash: '981e9e0207a3070e', colors: [228, 205, 228, 166, 155, 151, 208, 179, 192, 213, 185, 212, 230, 207, 230, 163, 169, 163, 149, 167, 176, 218, 192, 217, 231, 215, 228, 148, 114, 115, 113, 80, 85, 185, 161, 185, 231, 207, 224, 205, 168, 173, 191, 149, 158, 212, 188, 211] },
      { hash: '1e3e970307330713', colors: [229, 207, 229, 139, 125, 108, 192, 168, 169, 218, 191, 216, 226, 208, 230, 165, 173, 166, 149, 168, 174, 205, 191, 214, 215, 199, 211, 160, 134, 140, 132, 94, 105, 155, 144, 163, 221, 194, 206, 180, 130, 123, 158, 106, 103, 188, 161, 178] },
    ],
    colors: ['sky blue', 'red'],
    coveringId: 'cv-fondant',
    componentIds: ['dc-banner', 'tp-number', 'tp-text', 'dc-brickwall', 'tp-blockfigs', 'dc-props'],
    tiers: 1,
    servings: 12,
    theme: 'blocky game world',
    textOnCake: 'Happy 11th Birthday',
    age: 11,
    licensedNote: 'The inspo photo shows a game logo and game characters. The design uses generic blocky figures and a name banner; use a licensed topper if the customer wants the real logo or characters.',
    summary: 'Sky-blue fondant cake with a brick wall around the bottom, a name banner, blocky figures, a tree, a trophy, an age number on top and the message on the board.',
  },
];

/** The photo hints for a featured design, using only parts this baker's menu has. */
export function showcaseHints(s: Showcase, menu: PublicMenu): PhotoHints {
  const ids = new Set(menu.components.map((c) => c.id));
  const colors = s.colors.map((n) => (typeof n === 'string' ? colorByName(n) : n)).filter((c): c is ColorHit => !!c);
  return {
    colors,
    componentIds: s.componentIds.filter((id) => ids.has(id)),
    flavorId: null,
    coveringId: ids.has(s.coveringId) ? s.coveringId : null,
    tiers: s.tiers,
    theme: s.theme,
    textOnCake: s.textOnCake,
    licensedNote: s.licensedNote,
    unavailable: [],
    flowerStyle: null,
    topperSpot: null,
    summary: s.summary,
    usedAi: false,
    age: s.age,
    servings: s.servings,
    showcase: s.key,
  };
}

export function showcaseByKey(key: string | undefined): Showcase | null {
  return SHOWCASES.find((s) => s.key === key) ?? null;
}

/** Which featured design this picture is, if any (strict, so other cakes never match). */
export function findShowcase(p: PixelGrid): Showcase | null {
  let best: { s: Showcase; score: number } | null = null;
  for (const s of SHOWCASES) {
    for (const ref of s.prints) {
      const m = findPrint(p, ref);
      if (m && (!best || m.bits + m.colorDiff / 4 < best.score)) best = { s, score: m.bits + m.colorDiff / 4 };
    }
  }
  return best?.s ?? null;
}
