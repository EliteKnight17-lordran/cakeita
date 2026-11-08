import type { ListedBakery } from '../domain/matching';
import { toPublicMenu } from '../domain/pricing';
import { createBakeryFromStarter, type StarterKey } from '../domain/starterMenus';
import type { Bakery } from '../domain/types';

/**
 * Bakeries on the "near me" map.
 *
 * DEMO DATA: every shop below is FICTIONAL and labeled "(sample)". The places are
 * real neighborhoods so the map makes sense, but no real business is listed.
 * Each shop gets its own prices (ingredient costs, labor, margin) so the map shows
 * how the same cake costs differently from baker to baker.
 *
 * Real bakers join by sending their Cakeita link from "My link → Get on the map";
 * the Cakeita team adds them here (no database needed for the pilot).
 */

interface Entry {
  slug: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  starter: StarterKey;
  /** Multiplies every ingredient price (their supplier, their city). */
  costFactor: number;
  labor: number;
  margin: number;
  minOrder: number;
  leadTimeDays: number;
  deliveryKm: number;
  tags: string[];
}

const ENTRIES: Entry[] = [
  { slug: 'ortigas-cake-corner', name: 'Ortigas Cake Corner (sample)', area: 'Ortigas Center, Pasig', lat: 14.5872, lng: 121.0611, starter: 'pinoy', costFactor: 1.05, labor: 130, margin: 32, minOrder: 500, leadTimeDays: 3, deliveryKm: 6, tags: ['Ube', 'Drip cakes', '2 tiers'] },
  { slug: 'kapitolyo-home-bakes', name: "Ate Lorna's Home Bakes (sample)", area: 'Kapitolyo, Pasig', lat: 14.5714, lng: 121.0597, starter: 'home', costFactor: 0.92, labor: 90, margin: 28, minOrder: 350, leadTimeDays: 2, deliveryKm: 4, tags: ['Bento', 'Budget-friendly'] },
  { slug: 'greenhills-gilded-tiers', name: 'Gilded Tier Studio (sample)', area: 'Greenhills, San Juan', lat: 14.6017, lng: 121.0489, starter: 'premium', costFactor: 1.15, labor: 170, margin: 38, minOrder: 1200, leadTimeDays: 7, deliveryKm: 15, tags: ['Fondant', 'Weddings', '3 tiers'] },
  { slug: 'mandaluyong-bento-box', name: 'Bento Box Bakes (sample)', area: 'Shaw, Mandaluyong', lat: 14.5814, lng: 121.0394, starter: 'home', costFactor: 0.95, labor: 95, margin: 30, minOrder: 300, leadTimeDays: 1, deliveryKm: 5, tags: ['Bento', 'Same-week'] },
  { slug: 'maginhawa-ube-lab', name: 'Ube Lab Kitchen (sample)', area: 'Maginhawa, Quezon City', lat: 14.6440, lng: 121.0620, starter: 'pinoy', costFactor: 0.98, labor: 115, margin: 30, minOrder: 450, leadTimeDays: 3, deliveryKm: 8, tags: ['Ube', 'Pinoy flavors'] },
  { slug: 'morato-party-cakes', name: 'Morato Party Cakes (sample)', area: 'Tomas Morato, Quezon City', lat: 14.6336, lng: 121.0348, starter: 'premium', costFactor: 1.08, labor: 150, margin: 35, minOrder: 900, leadTimeDays: 5, deliveryKm: 10, tags: ['Character themes', 'Fondant'] },
  { slug: 'poblacion-sweet-studio', name: 'Poblacion Sweet Studio (sample)', area: 'Poblacion, Makati', lat: 14.5652, lng: 121.0306, starter: 'pinoy', costFactor: 1.12, labor: 140, margin: 35, minOrder: 600, leadTimeDays: 4, deliveryKm: 7, tags: ['Fresh flowers', 'Drip cakes'] },
  { slug: 'bgc-celebration-cakes', name: 'BGC Celebration Cakes (sample)', area: 'Bonifacio Global City, Taguig', lat: 14.5509, lng: 121.0503, starter: 'premium', costFactor: 1.2, labor: 180, margin: 40, minOrder: 1500, leadTimeDays: 7, deliveryKm: 12, tags: ['Fondant', 'Gold leaf', 'Events'] },
  { slug: 'marikina-sweet-spot', name: 'Marikina Sweet Spot (sample)', area: 'Concepcion, Marikina', lat: 14.6510, lng: 121.1030, starter: 'pinoy', costFactor: 0.9, labor: 100, margin: 28, minOrder: 400, leadTimeDays: 3, deliveryKm: 6, tags: ['Budget-friendly', 'Ube'] },
  { slug: 'cainta-family-bakeshop', name: 'Cainta Family Bakeshop (sample)', area: 'Cainta, Rizal', lat: 14.5786, lng: 121.1222, starter: 'home', costFactor: 0.88, labor: 85, margin: 27, minOrder: 300, leadTimeDays: 2, deliveryKm: 0, tags: ['Pickup only', 'Budget-friendly'] },
  { slug: 'sampaloc-sugar-house', name: 'Sampaloc Sugar House (sample)', area: 'Sampaloc, Manila', lat: 14.6096, lng: 120.9925, starter: 'home', costFactor: 0.93, labor: 90, margin: 30, minOrder: 350, leadTimeDays: 2, deliveryKm: 5, tags: ['Student budget', 'Bento'] },
  { slug: 'alabang-fondant-atelier', name: 'Alabang Fondant Atelier (sample)', area: 'Alabang, Muntinlupa', lat: 14.4230, lng: 121.0420, starter: 'premium', costFactor: 1.18, labor: 175, margin: 38, minOrder: 1300, leadTimeDays: 6, deliveryKm: 15, tags: ['Weddings', '3 tiers'] },
];

const cache = new Map<string, Bakery>();

function build(e: Entry): Bakery {
  const b = createBakeryFromStarter(e.starter, { name: e.name, ownerName: 'Sample baker', contact: 'Sample listing for the demo, not a real shop', city: e.area, slug: e.slug }, new Date('2026-11-01T00:00:00Z'));
  return {
    ...b,
    id: `bk-dir-${e.slug}`,
    laborRatePerHour: e.labor,
    targetMarginPct: e.margin,
    minOrderPrice: e.minOrder,
    leadTimeDays: e.leadTimeDays,
    ingredients: b.ingredients.map((i) => ({ ...i, costPerUnit: Math.round(i.costPerUnit * e.costFactor * 1000) / 1000 })),
    isSample: true,
    settings: { showEstimates: true, demoMode: true },
  };
}

/** The full (private) bakery for a directory slug, so /b/<slug> works like any bakery link. */
export function directoryBakery(slug: string): Bakery | null {
  const e = ENTRIES.find((x) => x.slug === slug);
  if (!e) return null;
  if (!cache.has(slug)) cache.set(slug, build(e));
  return cache.get(slug)!;
}

/** Public listing for the map: customer-safe menus only (no costs, no margins). */
export function listedBakeries(): ListedBakery[] {
  return ENTRIES.map((e) => ({
    menu: toPublicMenu(directoryBakery(e.slug)!, new Date('2026-11-01T00:00:00Z')),
    lat: e.lat,
    lng: e.lng,
    area: e.area,
    deliveryKm: e.deliveryKm,
    tags: e.tags,
  }));
}

export const DIRECTORY_SLUGS = ENTRIES.map((e) => e.slug);
