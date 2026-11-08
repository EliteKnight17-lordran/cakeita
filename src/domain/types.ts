/**
 * Core domain types for Cakeita.
 *
 * Design rule: the AI (or the rule-based reader) only ever picks IDs from a menu.
 * Every peso amount is computed by plain code in `pricing.ts`.
 */

export type Unit = 'g' | 'ml' | 'pc';

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
  /** Cost in pesos for ONE unit (per gram, per ml, or per piece). 0 means "not set yet". */
  costPerUnit: number;
  /** Extra words the price-update reader should match, e.g. "itlog" for eggs. */
  aliases?: string[];
  updatedAt?: string;
}

export interface RecipeLine {
  ingredientId: string;
  qty: number;
}

export type ComponentCategory = 'flavor' | 'covering' | 'decoration' | 'topper' | 'finish';

/** How a part is drawn on the 3D cake. */
export type Visual =
  | 'sponge'
  | 'buttercream'
  | 'whipped'
  | 'fondant'
  | 'ganache'
  | 'naked'
  | 'drip'
  | 'sprinkles'
  | 'flowers'
  | 'rosettes'
  | 'pearls'
  | 'fruits'
  | 'candles'
  | 'text'
  | 'acrylic'
  | 'figure'
  | 'motif'
  | 'gold';

export interface CakeComponent {
  id: string;
  name: string;
  /** Tagalog / Taglish display name (optional). */
  nameTl?: string;
  category: ComponentCategory;
  visual: Visual;
  recipe: RecipeLine[];
  laborMinutes: number;
  /** Bought-in cost in pesos (e.g. acrylic topper, fresh flowers). */
  extraCost: number;
  /** True if this baker makes it. False items are never offered to customers. */
  canMake: boolean;
  /** When true, recipe, labor and extra cost scale with the cake's surface (bigger cake, more frosting). */
  scales: boolean;
  /** Words that point to this part in a customer message (Taglish OK). */
  keywords: string[];
  /** Sponge color for flavors (hex). */
  color?: string;
}

export interface BaseCake {
  id: string;
  name: string;
  sizeLabel: string;
  /** Diameters in inches, bottom tier first. Length = number of tiers. */
  tiers: number[];
  /** Height of each tier in inches (same order as tiers). */
  heights: number[];
  servings: number;
  recipe: RecipeLine[];
  laborMinutes: number;
  /** Surface factor relative to a 6" 2-layer cake (1.0). Used to scale coverings and decorations. */
  scale: number;
  /** The baker's current menu price for a plain version, if any. Used for "lugi" alerts. */
  menuPrice?: number;
}

export interface Skills {
  maxTiers: number;
  /** Free-text things the baker does not do, e.g. "sugar flowers", "isomalt". */
  cannotDo: string[];
}

export interface BakerySettings {
  /** Show estimated prices to customers before baker approval. */
  showEstimates: boolean;
  /** Use saved results and skip network AI calls during a live demo. */
  demoMode: boolean;
}

export interface Bakery {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  /** Where customers reach the baker, e.g. m.me/yourpage or a mobile number. */
  contact: string;
  city: string;
  laborRatePerHour: number;
  targetMarginPct: number;
  minOrderPrice: number;
  leadTimeDays: number;
  ingredients: Ingredient[];
  baseCakes: BaseCake[];
  components: CakeComponent[];
  skills: Skills;
  settings: BakerySettings;
  isSample: boolean;
  updatedAt: string;
}

/** What the customer (or baker) picked. IDs only, never prices. */
export interface Selection {
  baseCakeId: string;
  componentIds: string[];
}

export type DesignTier = 'simple' | 'classic' | 'showstopper' | 'custom';

export interface CakeLook {
  colors: string[];
  textOnCake: string;
  candles: number;
  /** Shape of the theme topper (see motifs.ts). Only drawn when a 'motif' part is picked. */
  motif?: string;
}

/**
 * A menu that is safe to give to customers: names, IDs and per-item price
 * contributions only. No ingredient costs, no margin, no labor rate.
 */
export interface PublicMenu {
  v: 1;
  slug: string;
  name: string;
  contact: string;
  city: string;
  minOrderPrice: number;
  leadTimeDays: number;
  showEstimates: boolean;
  maxTiers: number;
  cannotDo: string[];
  baseCakes: Array<{
    id: string;
    name: string;
    sizeLabel: string;
    tiers: number[];
    heights: number[];
    servings: number;
    scale: number;
    /** Price contribution in pesos. */
    p: number;
  }>;
  components: Array<{
    id: string;
    name: string;
    nameTl?: string;
    category: ComponentCategory;
    visual: Visual;
    scales: boolean;
    keywords: string[];
    color?: string;
    /** Price contribution in pesos before size scaling. */
    p: number;
  }>;
  /** Parts this baker does not offer, so the reader can say "hindi namin ginagawa". */
  notOffered: Array<{ name: string; keywords: string[] }>;
  isSample: boolean;
  publishedAt: string;
}

export type OrderStatus =
  | 'new'
  | 'quoted'
  | 'confirmed'
  | 'baking'
  | 'ready'
  | 'done'
  | 'declined'
  | 'cancelled';

export interface CustomerInfo {
  name: string;
  contact: string;
}

/** What the customer sends to the baker. */
export interface CakeRequest {
  id: string;
  bakerySlug: string;
  createdAt: string;
  customer: CustomerInfo;
  occasion: string;
  eventDate: string;
  servings: number;
  budget: number | null;
  description: string;
  tier: DesignTier;
  selection: Selection;
  look: CakeLook;
  theme: string;
  licensedNote: string;
  unavailable: string[];
  /** Estimate the customer saw, if the baker allows estimates. */
  estimate: number | null;
  hasInspoPhoto: boolean;
  lang: 'tl' | 'en';
}

export interface ApprovedQuote {
  price: number;
  cost: number;
  marginPct: number;
  note: string;
  approvedAt: string;
  validUntil: string;
  selection: Selection;
  look: CakeLook;
}

export interface OrderEvent {
  at: string;
  type: string;
  detail?: string;
}

export interface Order extends CakeRequest {
  status: OrderStatus;
  source: 'link' | 'same-device' | 'pasted-dm';
  quote: ApprovedQuote | null;
  confirmedAt: string | null;
  customerNote: string;
  paid: boolean;
  history: OrderEvent[];
}
