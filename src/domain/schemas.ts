import { z } from 'zod';
import { MOTIF_KEYS } from './motifs.js';
import { FLOWER_STYLES, OWN_ITEMS, TOPPER_SPOTS } from './types.js';

/**
 * Validation for everything that crosses a trust boundary:
 * share links (anyone can edit a URL), saved data, and AI output.
 */

const id = z.string().min(1).max(64);
const shortText = (max: number) => z.string().max(max);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().min(0).max(1_000_000);

export const visualEnum = z.enum([
  'sponge', 'buttercream', 'whipped', 'fondant', 'ganache', 'naked', 'drip', 'sprinkles', 'flowers', 'rosettes',
  'pearls', 'fruits', 'candles', 'text', 'acrylic', 'figure', 'motif', 'gold', 'stand-gold', 'stand-wood',
]);
export const categoryEnum = z.enum(['flavor', 'covering', 'decoration', 'topper', 'finish', 'display']);

export const selectionSchema = z.object({
  baseCakeId: id,
  componentIds: z.array(id).max(20),
});

export const lookSchema = z.object({
  colors: z.array(hex).max(4),
  textOnCake: shortText(40),
  candles: z.number().int().min(0).max(99),
  motif: z.enum(MOTIF_KEYS).optional().catch(undefined),
  // Newer fields: older links have none; unknown values are dropped rather than breaking the link.
  flowerStyle: z.enum(FLOWER_STYLES).optional().catch(undefined),
  topperSpot: z.enum(TOPPER_SPOTS).optional().catch(undefined),
  own: z.array(z.enum(OWN_ITEMS)).max(3).optional().catch(undefined),
});

export const publicMenuSchema = z.object({
  v: z.literal(1),
  slug: shortText(40),
  name: shortText(80),
  contact: shortText(120),
  city: shortText(60),
  minOrderPrice: money,
  leadTimeDays: z.number().int().min(0).max(60),
  showEstimates: z.boolean(),
  maxTiers: z.number().int().min(1).max(5),
  cannotDo: z.array(shortText(60)).max(30),
  baseCakes: z
    .array(
      z.object({
        id,
        name: shortText(60),
        sizeLabel: shortText(40),
        tiers: z.array(z.number().min(2).max(16)).min(1).max(5),
        heights: z.array(z.number().min(1).max(10)).min(1).max(5),
        servings: z.number().int().min(1).max(500),
        scale: z.number().min(0).max(10),
        p: money,
      }),
    )
    .min(1)
    .max(20),
  components: z
    .array(
      z.object({
        id,
        name: shortText(60),
        nameTl: shortText(60).optional(),
        category: categoryEnum,
        visual: visualEnum,
        scales: z.boolean(),
        keywords: z.array(shortText(40)).max(20),
        color: hex.optional(),
        p: money,
      }),
    )
    .max(60),
  notOffered: z.array(z.object({ name: shortText(60), keywords: z.array(shortText(40)).max(20) })).max(60),
  isSample: z.boolean(),
  publishedAt: z.string().max(40),
  owner: z.string().regex(/^[A-Za-z0-9]{10,128}$/).optional().catch(undefined),
  fullDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(120).optional().catch(undefined),
});

export const cakeRequestSchema = z.object({
  id,
  bakerySlug: shortText(40),
  createdAt: z.string().max(40),
  customer: z.object({ name: shortText(80).min(1), contact: shortText(120).min(3) }),
  occasion: shortText(40),
  eventDate: isoDay,
  servings: z.number().int().min(1).max(500),
  budget: money.nullable(),
  description: shortText(1000),
  tier: z.enum(['simple', 'classic', 'showstopper', 'custom']),
  selection: selectionSchema,
  look: lookSchema,
  theme: shortText(60),
  licensedNote: shortText(240),
  unavailable: z.array(shortText(60)).max(20),
  estimate: money.nullable(),
  hasInspoPhoto: z.boolean(),
  lang: z.enum(['tl', 'en']),
});

export const cakeVisualSchema = z.object({
  tiers: z.array(z.object({ d: z.number().min(2).max(16), h: z.number().min(1).max(10) })).min(1).max(5),
  covering: visualEnum,
  frosting: hex,
  accent: hex,
  sponge: hex,
  drip: z.boolean(),
  dripColor: hex,
  sprinkles: z.boolean(),
  flowers: z.boolean(),
  rosettes: z.boolean(),
  pearls: z.boolean(),
  fruits: z.boolean(),
  candles: z.number().int().min(0).max(10),
  text: shortText(40),
  textStyle: z.enum(['piped', 'acrylic']).nullable(),
  figure: z.boolean(),
  // Older quote links have no topper; an unknown shape is dropped rather than breaking the link.
  motif: z.object({ key: z.enum(MOTIF_KEYS), main: hex, accent: hex }).nullable().optional().default(null).catch(null),
  gold: z.boolean(),
  stand: z.enum(['porcelain', 'gold', 'wood']).optional().default('porcelain').catch('porcelain'),
  flowerStyle: z.enum(FLOWER_STYLES).optional().default('side').catch('side'),
  topperSpot: z.enum(TOPPER_SPOTS).optional().default('center').catch('center'),
});

/** Baker -> customer: the approved quote. */
export const quoteLinkSchema = z.object({
  v: z.literal(1),
  orderId: id,
  bakery: z.object({ name: shortText(80), slug: shortText(40), contact: shortText(120), isSample: z.boolean() }),
  customerName: shortText(80),
  occasion: shortText(40),
  eventDate: isoDay,
  servings: z.number().int().min(1).max(500),
  price: money,
  note: shortText(500),
  approvedAt: z.string().max(40),
  validUntil: isoDay,
  parts: z.array(shortText(60)).max(20),
  sizeLabel: shortText(40),
  visual: cakeVisualSchema,
  textOnCake: shortText(40),
  // Added in 1.7. Optional so older quote links still open.
  /** 'declined' means the baker said no; price is 0 then. */
  kind: z.enum(['quote', 'declined']).default('quote'),
  reason: shortText(300).default(''),
  /** The estimate the customer saw in the app, so they can tell an accept from a counter-offer. */
  estimate: money.nullable().default(null),
  /** The customer's one counter-offer and the baker's answer. */
  offer: z.object({ price: money, note: shortText(300), answer: z.enum(['pending', 'accepted', 'kept']) }).nullable().default(null),
});

/** Customer -> baker: one counter-offer on a quote ("Puwede ba ₱X?"). */
export const offerLinkSchema = z.object({
  v: z.literal(1),
  orderId: id,
  price: money,
  note: shortText(300),
  customerName: shortText(80),
  at: z.string().max(40),
});

/** Customer -> baker: "Ito ang gusto ko". */
export const confirmLinkSchema = z.object({
  v: z.literal(1),
  orderId: id,
  price: money,
  confirmedAt: z.string().max(40),
  note: shortText(300),
  customerName: shortText(80),
});

/**
 * AI output. Only IDs from the menu, words, and numbers the customer wrote.
 * There is deliberately NO price field: AI never sets a price.
 */
export const aiReadingSchema = z.object({
  baseCakeId: z.string().max(64).nullable().optional(),
  flavorId: z.string().max(64).nullable().optional(),
  coveringId: z.string().max(64).nullable().optional(),
  componentIds: z.array(z.string().max(64)).max(20).default([]),
  detectedButUnavailable: z.array(z.string().max(60)).max(20).default([]),
  colors: z.array(z.string().max(30)).max(6).default([]),
  textOnCake: z.string().max(60).default(''),
  occasion: z.string().max(40).default(''),
  servings: z.number().int().min(1).max(500).nullable().optional(),
  budget: z.number().min(0).max(1_000_000).nullable().optional(),
  tiers: z.number().int().min(1).max(5).nullable().optional(),
  theme: z.string().max(60).default(''),
  summaryTaglish: z.string().max(400).default(''),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type QuoteLink = z.infer<typeof quoteLinkSchema>;
export type ConfirmLink = z.infer<typeof confirmLinkSchema>;
export type OfferLink = z.infer<typeof offerLinkSchema>;
export type AiReading = z.infer<typeof aiReadingSchema>;
