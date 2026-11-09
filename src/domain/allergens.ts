import type { Bakery, PublicMenu, RecipeLine, Selection } from './types';

/**
 * Allergy warnings. Pure code, no AI.
 *
 * Each part of a cake gets allergen tags from its words: the ingredient names in its recipe,
 * the part's own name and its keywords. A customer types what they can't eat ("mani,
 * blueberries"); any picked part whose tags or words match gets a red warning, and the
 * auto designs leave those parts out.
 *
 * This is a reminder, not a guarantee: tags come from names the baker typed, and a home
 * kitchen shares tools. Every screen that shows a warning says to confirm with the baker.
 */

export const ALLERGENS = [
  { key: 'milk', en: 'milk or dairy', tl: 'gatas o dairy', words: ['milk', 'gatas', 'dairy', 'butter', 'mantikilya', 'cream', 'cheese', 'keso', 'lactose', 'buttercream', 'whipped', 'ganache', 'condensed', 'evaporated', 'yogurt'] },
  { key: 'egg', en: 'egg', tl: 'itlog', words: ['egg', 'eggs', 'itlog', 'meringue'] },
  { key: 'wheat', en: 'wheat or gluten', tl: 'harina o gluten', words: ['flour', 'harina', 'wheat', 'gluten', 'trigo'] },
  { key: 'peanut', en: 'peanuts', tl: 'mani', words: ['peanut', 'peanuts', 'mani', 'peanut butter'] },
  { key: 'nuts', en: 'nuts', tl: 'nuts', words: ['nut', 'nuts', 'tree nut', 'tree nuts', 'almond', 'almonds', 'cashew', 'cashews', 'kasoy', 'pili', 'walnut', 'walnuts', 'hazelnut', 'hazelnuts', 'pistachio', 'macadamia', 'pecan', 'pecans'] },
  { key: 'soy', en: 'soy', tl: 'soy', words: ['soy', 'soya', 'soybean', 'lecithin'] },
  { key: 'chocolate', en: 'chocolate', tl: 'tsokolate', words: ['chocolate', 'choco', 'cocoa', 'cacao', 'kakaw', 'tsokolate', 'ganache', 'mocha'] },
  { key: 'coffee', en: 'coffee', tl: 'kape', words: ['coffee', 'kape', 'mocha', 'espresso', 'caffeine'] },
  { key: 'fruit', en: 'fruit', tl: 'prutas', words: ['fruit', 'fruits', 'prutas', 'strawberry', 'strawberries', 'blueberry', 'blueberries', 'berry', 'berries', 'raspberry', 'raspberries', 'mango', 'mangga', 'banana', 'saging', 'pineapple', 'pinya', 'kiwi', 'grape', 'grapes', 'ubas', 'cherry', 'cherries', 'orange', 'dalandan', 'lemon', 'calamansi', 'peach', 'peaches'] },
  { key: 'coloring', en: 'food coloring', tl: 'food coloring', words: ['food color', 'food colors', 'food coloring', 'food colouring', 'food dye', 'gel color', 'coloring', 'colouring', 'dye', 'pangkulay', 'red 40'] },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]['key'];
const KEYS = new Set<string>(ALLERGENS.map((a) => a.key));

export function allergenLabel(key: string, lang: 'tl' | 'en'): string {
  const a = ALLERGENS.find((x) => x.key === key);
  return a ? (lang === 'tl' ? a.tl : a.en) : key;
}

/** Lowercase words and phrases, keeping spaces between words. */
function norm(s: string): string {
  return ` ${s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

const has = (text: string, phrase: string) => text.includes(` ${phrase} `);

/** "Blueberries" and "blueberry" are the same word here. */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ches|shes|xes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** The longest allergen word or phrase in some text, as written in the list ("peanut butter" over "peanut"). */
function allergenWordIn(text: string): string | null {
  const t = norm(text);
  let best: string | null = null;
  for (const a of ALLERGENS) for (const w of a.words) if (has(t, w) && (!best || w.length > best.length)) best = w;
  return best;
}

/** Allergen tags found in some text (part names, ingredient names, keywords). */
export function tagsFromText(text: string): AllergenKey[] {
  const t = norm(text);
  return ALLERGENS.filter((a) => a.words.some((w) => has(t, w))).map((a) => a.key);
}

/** Tags for a priced item, from its recipe's ingredient names and its own words. Used when the menu is published. */
export function itemAllergens(bakery: Pick<Bakery, 'ingredients'>, item: { recipe: RecipeLine[]; name: string; keywords?: string[] }): AllergenKey[] {
  const words = [item.name, ...(item.keywords ?? [])];
  for (const line of item.recipe) {
    const ing = bakery.ingredients.find((i) => i.id === line.ingredientId);
    if (ing) words.push(ing.name, ...(ing.aliases ?? []));
  }
  return tagsFromText(words.join(' | '));
}

/** What the customer said they can't eat. */
export interface Allergies {
  /** Each thing they typed, as they typed it ("blueberries", "mani"). */
  said: string[];
  /** The allergen group of each entry in `said` (null when it's not one of the groups, like "ube"). */
  keys: Array<AllergenKey | null>;
}

export const NO_ALLERGIES: Allergies = { said: [], keys: [] };

const FILLER = /\b(allergic|allergy|allergies|allergen|may|ako|po|siya|sya|sa|to|ang|ng|the|is|are|of|kay|niya|nya|bawal|walang|no|free|wala|lang)\b/g;

/** Read a typed allergy list: "mani, blueberries at itlog" -> 3 entries. */
export function readAllergies(text: string): Allergies {
  const said: string[] = [];
  const keys: Array<AllergenKey | null> = [];
  for (const raw of text.split(/,|;|\/|\n|\band\b|\bat\b|&|\+/i)) {
    const piece = raw.replace(/-free\b/gi, '').trim();
    const t = norm(piece);
    const tags = tagsFromText(piece);
    const cleaned = t.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length < 2 || said.length >= 8) continue;
    const label = piece.replace(FILLER, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!label) continue;
    said.push(label);
    keys.push(tags[0] ?? null);
  }
  return { said, keys };
}

/**
 * Allergies mentioned inside a cake description: "allergic to nuts", "may allergy sa mani",
 * "bawal ang itlog", "nut-free", "walang gatas". Returns the typed words, comma separated.
 */
export function allergiesInText(text: string): string {
  const found: string[] = [];
  const add = (s: string) => {
    for (const w of s.split(/,|\band\b|\bat\b|\bor\b|\bo\b/)) {
      const v = w.trim().replace(/[.!?]+$/, '');
      // The list is over once the words are about the cake again ("..., chocolate cake for 20").
      if (/\b(cake|cakes|pax|budget|para|for|tier|tiers|people|tao|birthday|wedding|with|theme|design)\b/.test(v)) break;
      // Keep the allergen word itself ("mani" from "mani anak ko"), or a short unknown food ("ube").
      const word = allergenWordIn(v) ?? (/^[a-z]{3,20}( [a-z]{3,20})?$/.test(v) ? v : null);
      if (word && !found.includes(word)) found.push(word);
    }
  };
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/\ballerg(?:ic|y|ies)\s*(?:po\s*)?(?:to|sa|:|-)?\s*(?:ang\s+|ng\s+)?([a-z ,]+?)(?=[^a-z ,]|\s(?:po|kaya|so|please|pls|pero|but)\b|$)/g)) add(m[1] ?? '');
  for (const m of lower.matchAll(/\b(?:bawal|iwas)\s+(?:po\s+)?(?:ang\s+|sa\s+|ng\s+)?([a-z ,]+?)(?=[^a-z ,]|\s(?:po|kaya|so|please|pls|pero|but)\b|$)/g)) add(m[1] ?? '');
  for (const m of lower.matchAll(/\b([a-z]+)[- ]free\b/g)) {
    const w = m[1] ?? '';
    if (tagsFromText(w).length) add(w);
  }
  for (const m of lower.matchAll(/\b(?:walang|no)\s+(nuts?|peanuts?|mani|gatas|milk|dairy|itlog|eggs?|gluten|harina)\b/g)) add(m[1] ?? '');
  return found.slice(0, 8).join(', ');
}

type MenuPart = PublicMenu['components'][number];
type MenuBase = PublicMenu['baseCakes'][number];

function partTags(p: { name: string; keywords?: string[]; a?: string[] }): string[] {
  return p.a ?? tagsFromText([p.name, ...(p.keywords ?? [])].join(' | '));
}

/** Which of the customer's entries this part matches. Empty = safe as far as names tell. */
export function partMatches(p: { name: string; nameTl?: string; keywords?: string[]; a?: string[] }, allergies: Allergies): string[] {
  if (!allergies.said.length) return [];
  const tags = partTags(p);
  const words = norm([p.name, p.nameTl ?? '', ...(p.keywords ?? [])].join(' | '));
  const stems = new Set(words.trim().split(' ').map(stem));
  const out: string[] = [];
  allergies.said.forEach((said, i) => {
    const key = allergies.keys[i];
    const own = norm(said).trim();
    const ownHit = own.length >= 3 && (has(words, own) || own.split(' ').every((w) => stems.has(stem(w))));
    if ((key && tags.includes(key)) || ownHit) out.push(said);
  });
  return out;
}

export interface AllergyHit {
  id: string;
  name: string;
  nameTl?: string;
  kind: 'base' | 'part';
  /** Flavor and covering can be swapped but not removed; decorations can be removed. */
  category: MenuPart['category'] | 'base';
  /** The customer's own words this part matched. */
  said: string[];
}

/** Every picked part (and the sponge itself) that matches something the customer can't eat. */
export function allergyHits(menu: PublicMenu, sel: Selection, allergies: Allergies): AllergyHit[] {
  if (!allergies.said.length) return [];
  const hits: AllergyHit[] = [];
  const base: MenuBase | undefined = menu.baseCakes.find((b) => b.id === sel.baseCakeId);
  if (base) {
    // The sponge's own recipe (flour, eggs, milk) lives on the base cake.
    const said = partMatches({ name: 'cake sponge', a: base.a ?? ['wheat', 'egg', 'milk'] }, allergies);
    if (said.length) hits.push({ id: base.id, name: 'Cake sponge', nameTl: 'Mismong cake (sponge)', kind: 'base', category: 'base', said });
  }
  for (const id of sel.componentIds) {
    const p = menu.components.find((c) => c.id === id);
    if (!p) continue;
    const said = partMatches(p, allergies);
    if (said.length) hits.push({ id, name: p.name, nameTl: p.nameTl, kind: 'part', category: p.category, said });
  }
  return hits;
}

/**
 * Leave out parts the customer can't eat. A must-have group (flavor, covering) keeps its
 * parts when every choice matches, because the cake still needs one; the warning then tells
 * the customer to ask the baker.
 */
export function withoutAllergens<T extends { name: string; nameTl?: string; keywords?: string[]; a?: string[]; category: string }>(parts: T[], allergies: Allergies | undefined): T[] {
  if (!allergies?.said.length) return parts;
  const safe = parts.filter((p) => !partMatches(p, allergies).length);
  for (const must of ['flavor', 'covering']) {
    if (!safe.some((p) => p.category === must)) safe.push(...parts.filter((p) => p.category === must));
  }
  return parts.filter((p) => safe.includes(p));
}

export function isAllergenKey(k: string): k is AllergenKey {
  return KEYS.has(k);
}
