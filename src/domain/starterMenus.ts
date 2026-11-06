import type { BaseCake, Bakery, CakeComponent, Ingredient } from './types';

/**
 * Starter menus so a baker edits about 5 numbers instead of building a menu from zero.
 *
 * PRICES ARE SAMPLE ESTIMATES (Metro Manila retail, late 2026, not verified).
 * Every screen that shows them labels them "estimate, edit me".
 */

export const SAMPLE_INGREDIENTS: Ingredient[] = [
  { id: 'flour', name: 'Cake flour', unit: 'g', costPerUnit: 0.09, aliases: ['harina', 'flour', 'cake flour'] },
  { id: 'sugar', name: 'White sugar', unit: 'g', costPerUnit: 0.08, aliases: ['asukal', 'sugar', 'white sugar'] },
  { id: 'icing-sugar', name: 'Powdered sugar', unit: 'g', costPerUnit: 0.12, aliases: ['powdered sugar', 'icing sugar', 'confectioners sugar'] },
  { id: 'butter', name: 'Butter (unsalted)', unit: 'g', costPerUnit: 0.55, aliases: ['butter', 'mantikilya'] },
  { id: 'eggs', name: 'Eggs', unit: 'pc', costPerUnit: 9, aliases: ['itlog', 'egg', 'eggs'] },
  { id: 'milk', name: 'Fresh milk', unit: 'ml', costPerUnit: 0.11, aliases: ['gatas', 'milk', 'fresh milk'] },
  { id: 'oil', name: 'Vegetable oil', unit: 'ml', costPerUnit: 0.1, aliases: ['mantika', 'oil', 'cooking oil'] },
  { id: 'baking-powder', name: 'Baking powder', unit: 'g', costPerUnit: 0.25, aliases: ['baking powder'] },
  { id: 'cocoa', name: 'Cocoa powder', unit: 'g', costPerUnit: 0.6, aliases: ['cocoa', 'kakaw'] },
  { id: 'chocolate', name: 'Dark chocolate', unit: 'g', costPerUnit: 0.7, aliases: ['chocolate', 'tsokolate', 'dark chocolate'] },
  { id: 'whip-cream', name: 'Whipping cream', unit: 'ml', costPerUnit: 0.3, aliases: ['whipping cream', 'heavy cream', 'whip cream'] },
  { id: 'cream-cheese', name: 'Cream cheese', unit: 'g', costPerUnit: 0.75, aliases: ['cream cheese'] },
  { id: 'ube', name: 'Ube halaya', unit: 'g', costPerUnit: 0.4, aliases: ['ube', 'ube halaya'] },
  { id: 'coffee', name: 'Instant coffee', unit: 'g', costPerUnit: 1.2, aliases: ['coffee', 'kape'] },
  { id: 'fondant', name: 'Fondant', unit: 'g', costPerUnit: 0.45, aliases: ['fondant'] },
  { id: 'gel-color', name: 'Gel food color', unit: 'g', costPerUnit: 3, aliases: ['food color', 'gel color', 'coloring'] },
  { id: 'sprinkles', name: 'Sprinkles and sugar pearls', unit: 'g', costPerUnit: 0.8, aliases: ['sprinkles', 'pearls', 'dragees'] },
  { id: 'gold-leaf', name: 'Edible gold leaf (sheet)', unit: 'pc', costPerUnit: 25, aliases: ['gold leaf', 'gold'] },
  { id: 'box', name: 'Cake box and board', unit: 'pc', costPerUnit: 85, aliases: ['box', 'cake box', 'board', 'kahon'] },
];

const r = (ingredientId: string, qty: number) => ({ ingredientId, qty });

/** Plain butter/chiffon-style sponge for a 6" 2-layer cake (scale 1.0). */
const SPONGE_6x2 = [r('flour', 250), r('sugar', 230), r('butter', 180), r('eggs', 4), r('milk', 240), r('baking-powder', 8)];
const scaleRecipe = (rec: { ingredientId: string; qty: number }[], f: number) =>
  rec.map((l) => ({ ...l, qty: Math.round(l.qty * f * 10) / 10 }));

export const SAMPLE_BASE_CAKES: BaseCake[] = [
  {
    id: 'bento-4', name: 'Bento cake', sizeLabel: '4" bento', tiers: [4], heights: [2.5], servings: 3,
    recipe: [...scaleRecipe(SPONGE_6x2, 0.3), r('box', 0.5)], laborMinutes: 50, scale: 0.4, menuPrice: 350,
  },
  {
    id: 'r6-1', name: 'Round 6" (1 layer)', sizeLabel: '6" 1-layer', tiers: [6], heights: [3], servings: 8,
    recipe: [...scaleRecipe(SPONGE_6x2, 0.55), r('box', 1)], laborMinutes: 80, scale: 0.7, menuPrice: 650,
  },
  {
    id: 'r6-2', name: 'Round 6" (2 layers)', sizeLabel: '6" 2-layer', tiers: [6], heights: [4.5], servings: 12,
    recipe: [...SPONGE_6x2, r('box', 1)], laborMinutes: 110, scale: 1, menuPrice: 950,
  },
  {
    id: 'r8-2', name: 'Round 8" (2 layers)', sizeLabel: '8" 2-layer', tiers: [8], heights: [4.5], servings: 24,
    recipe: [...scaleRecipe(SPONGE_6x2, 1.8), r('box', 1)], laborMinutes: 150, scale: 1.6, menuPrice: 1500,
  },
  {
    id: 't2-6-8', name: '2-tier (6" on 8")', sizeLabel: '2-tier 6+8"', tiers: [8, 6], heights: [4.5, 4.5], servings: 36,
    recipe: [...scaleRecipe(SPONGE_6x2, 2.8), r('box', 1.5)], laborMinutes: 260, scale: 2.6, menuPrice: 2800,
  },
  {
    id: 't3-4-6-8', name: '3-tier (4" + 6" + 8")', sizeLabel: '3-tier 4+6+8"', tiers: [8, 6, 4], heights: [4.5, 4.5, 4], servings: 45,
    recipe: [...scaleRecipe(SPONGE_6x2, 3.3), r('box', 2)], laborMinutes: 360, scale: 3.2,
  },
];

const comp = (c: Omit<CakeComponent, 'canMake'> & { canMake?: boolean }): CakeComponent => ({ canMake: true, ...c });

export const SAMPLE_COMPONENTS: CakeComponent[] = [
  // Flavors (sponge). Exactly one per cake.
  comp({ id: 'fl-vanilla', name: 'Vanilla', category: 'flavor', visual: 'sponge', recipe: [], laborMinutes: 0, extraCost: 0, scales: true, keywords: ['vanilla', 'banilya', 'white cake'], color: '#f6e3b4' }),
  comp({ id: 'fl-choco', name: 'Chocolate', nameTl: 'Tsokolate', category: 'flavor', visual: 'sponge', recipe: [r('cocoa', 50), r('chocolate', 60)], laborMinutes: 0, extraCost: 0, scales: true, keywords: ['chocolate', 'choco', 'tsokolate', 'chocolate moist', 'choco moist'], color: '#5a3522' }),
  comp({ id: 'fl-ube', name: 'Ube', category: 'flavor', visual: 'sponge', recipe: [r('ube', 220), r('gel-color', 1)], laborMinutes: 10, extraCost: 0, scales: true, keywords: ['ube', 'ube macapuno', 'purple yam'], color: '#8e5cb8' }),
  comp({ id: 'fl-mocha', name: 'Mocha', category: 'flavor', visual: 'sponge', recipe: [r('coffee', 15), r('cocoa', 20)], laborMinutes: 0, extraCost: 0, scales: true, keywords: ['mocha', 'coffee', 'kape'], color: '#8a5a3c' }),
  comp({ id: 'fl-redvelvet', name: 'Red velvet', category: 'flavor', visual: 'sponge', recipe: [r('cocoa', 15), r('cream-cheese', 200), r('gel-color', 3)], laborMinutes: 10, extraCost: 0, scales: true, keywords: ['red velvet'], color: '#a4223a' }),

  // Coverings. Exactly one per cake.
  comp({ id: 'cv-buttercream', name: 'Buttercream', category: 'covering', visual: 'buttercream', recipe: [r('butter', 200), r('icing-sugar', 300), r('gel-color', 1)], laborMinutes: 30, extraCost: 0, scales: true, keywords: ['buttercream', 'butter cream', 'icing', 'frosting'] }),
  comp({ id: 'cv-whipped', name: 'Whipped cream', category: 'covering', visual: 'whipped', recipe: [r('whip-cream', 300), r('icing-sugar', 40)], laborMinutes: 20, extraCost: 0, scales: true, keywords: ['whipped', 'whip cream', 'whipped cream', 'chantilly'] }),
  comp({ id: 'cv-ganache', name: 'Chocolate ganache', category: 'covering', visual: 'ganache', recipe: [r('chocolate', 250), r('whip-cream', 150)], laborMinutes: 30, extraCost: 0, scales: true, keywords: ['ganache', 'chocolate frosting', 'choco frosting'] }),
  comp({ id: 'cv-fondant', name: 'Fondant', category: 'covering', visual: 'fondant', recipe: [r('fondant', 600), r('butter', 100), r('icing-sugar', 150)], laborMinutes: 70, extraCost: 0, scales: true, keywords: ['fondant', 'smooth fondant'] }),
  comp({ id: 'cv-naked', name: 'Semi-naked', category: 'covering', visual: 'naked', recipe: [r('butter', 80), r('icing-sugar', 120)], laborMinutes: 15, extraCost: 0, scales: true, keywords: ['naked', 'semi-naked', 'semi naked', 'rustic'] }),

  // Decorations
  comp({ id: 'dc-drip', name: 'Chocolate drip', category: 'decoration', visual: 'drip', recipe: [r('chocolate', 100), r('whip-cream', 60)], laborMinutes: 20, extraCost: 0, scales: true, keywords: ['drip', 'chocolate drip', 'gold drip', 'tulo'] }),
  comp({ id: 'dc-sprinkles', name: 'Sprinkles', category: 'decoration', visual: 'sprinkles', recipe: [r('sprinkles', 35)], laborMinutes: 5, extraCost: 0, scales: true, keywords: ['sprinkles', 'sprinkle', 'confetti', 'funfetti'] }),
  comp({ id: 'dc-rosettes', name: 'Buttercream rosettes', category: 'decoration', visual: 'rosettes', recipe: [r('butter', 90), r('icing-sugar', 140), r('gel-color', 1)], laborMinutes: 35, extraCost: 0, scales: true, keywords: ['rosettes', 'rosette', 'piped flowers', 'buttercream flowers', 'swirls', 'piping'] }),
  comp({ id: 'dc-flowers', name: 'Fresh flowers', nameTl: 'Totoong bulaklak', category: 'decoration', visual: 'flowers', recipe: [], laborMinutes: 20, extraCost: 220, scales: false, keywords: ['fresh flowers', 'flowers', 'flower', 'bulaklak', 'floral', 'roses', 'baby breath'] }),
  comp({ id: 'dc-pearls', name: 'Sugar pearls border', category: 'decoration', visual: 'pearls', recipe: [r('sprinkles', 25)], laborMinutes: 15, extraCost: 0, scales: true, keywords: ['pearls', 'pearl', 'perlas', 'dragees', 'beads'] }),
  comp({ id: 'dc-fruits', name: 'Fresh fruits', nameTl: 'Prutas', category: 'decoration', visual: 'fruits', recipe: [], laborMinutes: 15, extraCost: 180, scales: false, keywords: ['fruits', 'fruit', 'prutas', 'strawberries', 'strawberry', 'berries', 'mango', 'mangga'] }),

  // Toppers
  comp({ id: 'tp-candles', name: 'Candles', nameTl: 'Kandila', category: 'topper', visual: 'candles', recipe: [], laborMinutes: 0, extraCost: 40, scales: false, keywords: ['candle', 'candles', 'kandila'] }),
  comp({ id: 'tp-text', name: 'Piped message', nameTl: 'Nakasulat na bati', category: 'topper', visual: 'text', recipe: [r('icing-sugar', 30), r('butter', 20), r('gel-color', 1)], laborMinutes: 10, extraCost: 0, scales: false, keywords: ['message', 'dedication', 'nakasulat', 'sulat', 'greeting', 'text'] }),
  comp({ id: 'tp-acrylic', name: 'Acrylic topper', category: 'topper', visual: 'acrylic', recipe: [], laborMinutes: 5, extraCost: 180, scales: false, keywords: ['acrylic', 'topper', 'cake topper', 'name topper'] }),
  comp({ id: 'tp-figure', name: 'Fondant figure', nameTl: 'Fondant na figure', category: 'topper', visual: 'figure', recipe: [r('fondant', 150), r('gel-color', 3)], laborMinutes: 90, extraCost: 0, scales: false, keywords: ['figure', 'figurine', 'character', 'fondant figure', 'toy', 'doll'] }),

  // Finishes
  comp({ id: 'fn-gold', name: 'Gold leaf accents', category: 'finish', visual: 'gold', recipe: [r('gold-leaf', 2)], laborMinutes: 15, extraCost: 0, scales: false, keywords: ['gold leaf', 'gold accents', 'gold flakes', 'gold details', 'edible gold'] }),
];

export type StarterKey = 'home' | 'pinoy' | 'premium';

export interface StarterPreset {
  key: StarterKey;
  title: string;
  titleTl: string;
  blurb: string;
  blurbTl: string;
  laborRatePerHour: number;
  targetMarginPct: number;
  minOrderPrice: number;
  maxTiers: number;
  cannotDo: string[];
  /** Component IDs the baker does NOT make in this preset. */
  notMade: string[];
}

export const STARTER_PRESETS: StarterPreset[] = [
  {
    key: 'home', title: 'Home baker basics', titleTl: 'Pang-home baker',
    blurb: 'Buttercream and whipped cream, 1 tier, bento cakes. Good if you bake from your kitchen.',
    blurbTl: 'Buttercream at whipped cream, 1 tier, may bento. Para sa nagbe-bake sa bahay.',
    laborRatePerHour: 100, targetMarginPct: 30, minOrderPrice: 350, maxTiers: 1,
    cannotDo: ['sugar flowers', 'isomalt', 'sculpted cake', 'gravity defying'],
    notMade: ['cv-fondant', 'tp-figure', 'fn-gold', 'cv-ganache'],
  },
  {
    key: 'pinoy', title: 'Pinoy flavors', titleTl: 'Pinoy flavors',
    blurb: 'Ube, mocha, chocolate moist, up to 2 tiers, drips and fresh flowers.',
    blurbTl: 'Ube, mocha, chocolate moist, hanggang 2 tier, may drip at bulaklak.',
    laborRatePerHour: 120, targetMarginPct: 30, minOrderPrice: 450, maxTiers: 2,
    cannotDo: ['sugar flowers', 'isomalt', 'sculpted cake'],
    notMade: ['tp-figure'],
  },
  {
    key: 'premium', title: 'Fondant and tiers', titleTl: 'Fondant at tiers',
    blurb: 'Fondant, figures, gold leaf, up to 3 tiers. For event and wedding cakes.',
    blurbTl: 'Fondant, figure, gold leaf, hanggang 3 tier. Pang-event at kasal.',
    laborRatePerHour: 150, targetMarginPct: 35, minOrderPrice: 800, maxTiers: 3,
    cannotDo: ['isomalt', 'gravity defying'],
    notMade: ['tp-acrylic'],
  },
];

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'my-bakery'
  );
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function createBakeryFromStarter(
  key: StarterKey,
  info: { name: string; ownerName?: string; contact?: string; city?: string; slug?: string },
  now = new Date(),
): Bakery {
  const preset = STARTER_PRESETS.find((p) => p.key === key) ?? STARTER_PRESETS[0]!;
  const components = clone(SAMPLE_COMPONENTS).map((c) => ({ ...c, canMake: !preset.notMade.includes(c.id) }));
  return {
    id: `bk-${now.getTime().toString(36)}`,
    name: info.name.trim() || 'My Bakery',
    slug: slugify(info.slug || info.name),
    ownerName: info.ownerName?.trim() ?? '',
    contact: info.contact?.trim() ?? '',
    city: info.city?.trim() ?? '',
    laborRatePerHour: preset.laborRatePerHour,
    targetMarginPct: preset.targetMarginPct,
    minOrderPrice: preset.minOrderPrice,
    leadTimeDays: 3,
    ingredients: clone(SAMPLE_INGREDIENTS),
    baseCakes: clone(SAMPLE_BASE_CAKES),
    components,
    skills: { maxTiers: preset.maxTiers, cannotDo: [...preset.cannotDo] },
    settings: { showEstimates: true, demoMode: false },
    isSample: false,
    updatedAt: now.toISOString(),
  };
}

/** The built-in demo bakery at /b/sample. Clearly labeled as sample data. */
export function createSampleBakery(now = new Date()): Bakery {
  const b = createBakeryFromStarter('pinoy', {
    name: 'Sample Bakery (demo data)',
    ownerName: 'Demo Baker',
    contact: 'Demo only, no real orders',
    city: 'Quezon City',
    slug: 'sample',
  }, now);
  return { ...b, id: 'bk-sample', isSample: true, settings: { showEstimates: true, demoMode: true } };
}

/** Default flavor and covering IDs a design falls back to. */
export function defaultPartIds(components: Array<{ id: string; category: string }>): { flavor?: string; covering?: string } {
  return {
    flavor: components.find((c) => c.category === 'flavor')?.id,
    covering: components.find((c) => c.category === 'covering')?.id,
  };
}
