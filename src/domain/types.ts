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

/** display = what the cake stands on (a stand for weddings and debuts). Never added to auto designs. */
export type ComponentCategory = 'flavor' | 'covering' | 'decoration' | 'topper' | 'finish' | 'display';

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
  | 'bricks'
  | 'print'
  | 'brickwall'
  | 'banner'
  | 'blockfigs'
  | 'number'
  | 'props'
  | 'candles'
  | 'text'
  | 'acrylic'
  | 'figure'
  | 'motif'
  | 'gold'
  | 'stand-gold'
  | 'stand-wood';

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
  /** Firebase account that owns this bakery, once the baker signs in. */
  cloudUid?: string;
  /** Where the bakery is, for the "bakers near me" map. Only shown when listed is true. */
  location?: { lat: number; lng: number; area: string; deliveryKm: number; listed: boolean };
  /** Days the baker is fully booked (YYYY-MM-DD). Customers can't pick these. */
  fullDates?: string[];
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
  /** Where the flowers go (only matters when flowers are picked). */
  flowerStyle?: FlowerStyle;
  /** Topper in the middle or to one side (only matters when there is a topper). */
  topperSpot?: TopperSpot;
  /** Things the customer brings themselves (free; the baker places them). */
  own?: OwnItem[];
  /** Who the cake is for (shown on a name banner, when one is picked). */
  name?: string;
  /** Their age (shown on a number topper, when one is picked). */
  age?: number;
}

export const FLOWER_STYLES = ['side', 'cascade', 'crown', 'scatter'] as const;
export type FlowerStyle = (typeof FLOWER_STYLES)[number];
export const TOPPER_SPOTS = ['center', 'side'] as const;
export type TopperSpot = (typeof TOPPER_SPOTS)[number];
export const OWN_ITEMS = ['topper', 'figurine', 'stand'] as const;
export type OwnItem = (typeof OWN_ITEMS)[number];

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
    /** Allergen tags from the sponge recipe (see allergens.ts). */
    a?: string[];
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
    /** Allergen tags from the recipe's ingredient names and the part's words (see allergens.ts). */
    a?: string[];
  }>;
  /** Parts this baker does not offer, so the reader can say "hindi namin ginagawa". */
  notOffered: Array<{ name: string; keywords: string[] }>;
  isSample: boolean;
  publishedAt: string;
  /** Account that receives requests in the cloud inbox (absent = link-only bakery). */
  owner?: string;
  /** Fully booked days (YYYY-MM-DD), today or later. */
  fullDates?: string[];
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
  /** What the customer can't eat, as they typed it ('' = none said). */
  allergies?: string;
  /** Pickup at the bakery or delivery (delivery fee paid by the customer). Older requests have none. */
  handoff?: Handoff;
  /** Pickup or delivery time, HH:MM ('' = not said). */
  handoffTime?: string;
  /** Where to deliver ('' for pickup). */
  address?: string;
}

export type Handoff = 'pickup' | 'delivery';

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
  source: 'link' | 'same-device' | 'pasted-dm' | 'cloud';
  quote: ApprovedQuote | null;
  confirmedAt: string | null;
  customerNote: string;
  paid: boolean;
  history: OrderEvent[];
  /** Why the baker said no (shown to the customer). */
  declineReason?: string;
  /** The customer's one counter-offer and the baker's answer. */
  offer?: CustomerOffer | null;
  /** "Your cake is ready": when the baker said so, their note, and a photo of the finished cake (small JPEG data URL). */
  ready?: ReadyNotice | null;
}

export interface ReadyNotice {
  at: string;
  note: string;
  photo: string | null;
}

/** A customer may answer a quote with one lower price. The baker accepts it or keeps their price. */
export interface CustomerOffer {
  price: number;
  note: string;
  at: string;
  answer: 'pending' | 'accepted' | 'kept';
}
