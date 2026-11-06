import type { PublicMenu } from './types';

/**
 * Rule-based reader for cake requests written in English, Tagalog or Taglish,
 * e.g. "pink 2 tier for my daughter's 7th bday, 30 pax, budget 2.5k, Dec 12".
 *
 * Works fully offline. It never invents a price: it only finds IDs from the
 * menu, numbers the customer wrote, and words it recognizes. Anything it can't
 * map is reported, not guessed.
 */

export interface ColorHit {
  name: string;
  hex: string;
}

export interface ParsedRequest {
  occasion: string;
  age: number | null;
  servings: number | null;
  budget: number | null;
  tiers: number | null;
  sizeIn: number | null;
  eventDate: string | null;
  colors: ColorHit[];
  flavorId: string | null;
  coveringId: string | null;
  componentIds: string[];
  unavailable: string[];
  textOnCake: string;
  theme: string;
  /** Set when a trademarked character was swapped for a generic theme. */
  licensedNote: string;
  /** Which fields were found, for the confidence score and the review screen. */
  found: string[];
  confidence: number;
}

// ---------- vocab ----------

const OCCASIONS: Array<[RegExp, string]> = [
  [/\b(debut|18th\s+birthday)\b/, 'Debut'],
  [/\b(wedding|kasal|bridal shower)\b/, 'Wedding'],
  [/\b(christening|binyag|baptism|dedication cake)\b/, 'Christening'],
  [/\b(gender reveal|baby shower)\b/, 'Baby shower'],
  [/\b(anniversary|anniv)\b/, 'Anniversary'],
  [/\b(monthsary)\b/, 'Monthsary'],
  [/\b(graduation|grad|moving up|recognition)\b/, 'Graduation'],
  [/\b(mother'?s day|araw ng mga ina)\b/, "Mother's Day"],
  [/\b(father'?s day)\b/, "Father's Day"],
  [/\b(christmas|pasko|noche buena)\b/, 'Christmas'],
  [/\b(valentine'?s?)\b/, "Valentine's"],
  [/\b(retirement|despedida|farewell)\b/, 'Farewell'],
  [/\b(birthday|bday|b-day|kaarawan|kaarawan|bertday)\b/, 'Birthday'],
];

export const COLOR_WORDS: Array<[string[], string, string]> = [
  [['baby pink', 'light pink', 'blush'], 'baby pink', '#f8c8d8'],
  [['hot pink', 'fuchsia', 'magenta'], 'hot pink', '#e0457b'],
  [['pink', 'rosas', 'pinkish'], 'pink', '#f4a7c0'],
  [['maroon', 'wine'], 'maroon', '#7a1f2b'],
  [['red', 'pula'], 'red', '#d23a3a'],
  [['baby blue', 'light blue', 'sky blue'], 'baby blue', '#a9cdf0'],
  [['navy', 'navy blue', 'dark blue'], 'navy', '#22335c'],
  [['blue', 'asul', 'bughaw'], 'blue', '#4a7bd0'],
  [['teal', 'turquoise'], 'teal', '#2f9c95'],
  [['white', 'puti'], 'white', '#fbf7f0'],
  [['black', 'itim'], 'black', '#2a2a2a'],
  [['yellow', 'dilaw'], 'yellow', '#f5d34a'],
  [['orange', 'kahel'], 'orange', '#f29a3b'],
  [['sage', 'sage green'], 'sage', '#a5b99a'],
  [['mint', 'mint green'], 'mint', '#b6e3cf'],
  [['green', 'berde'], 'green', '#5fae6b'],
  [['lavender', 'lilac'], 'lavender', '#c9b3e6'],
  [['purple', 'violet', 'lila', 'ube color'], 'purple', '#9466c4'],
  [['gold', 'golden', 'ginto'], 'gold', '#d4af37'],
  [['silver', 'pilak'], 'silver', '#c0c0c8'],
  [['peach'], 'peach', '#f7c1a0'],
  [['beige', 'nude', 'cream', 'ivory', 'off white', 'off-white'], 'cream', '#efe0c8'],
  [['brown', 'kayumanggi'], 'brown', '#7a4b2a'],
];

/** Trademarked names are never drawn or named on the cake. They become a generic theme. */
export const TRADEMARKS: Array<[RegExp, string, string[]]> = [
  [/\bspider[- ]?man\b/, 'red and blue superhero', ['red', 'blue']],
  [/\b(avengers|marvel|iron[- ]?man|captain america|hulk|thor)\b/, 'superhero', ['red', 'gold']],
  [/\b(batman|dc comics)\b/, 'dark knight hero', ['black', 'yellow']],
  [/\bsuperman\b/, 'flying hero', ['blue', 'red']],
  [/\b(frozen|elsa|anna and elsa)\b/, 'ice princess with snowflakes', ['baby blue', 'white']],
  [/\b(disney princess|cinderella|ariel|little mermaid|rapunzel|moana)\b/, 'fairytale princess', ['pink', 'gold']],
  [/\b(mickey|minnie)( mouse)?\b/, 'cartoon mouse with polka dots', ['red', 'black']],
  [/\b(hello kitty|sanrio|kuromi|my melody|cinnamoroll)\b/, 'cute kitten with a bow', ['pink', 'white']],
  [/\b(paw patrol)\b/, 'puppy rescue team', ['blue', 'red']],
  [/\bcocomelon\b/, 'nursery rhyme watermelon', ['green', 'red']],
  [/\b(pokemon|pikachu)\b/, 'yellow electric creature', ['yellow', 'red']],
  [/\bbarbie\b/, 'pink fashion doll', ['hot pink', 'white']],
  [/\b(minecraft)\b/, 'pixel blocks', ['green', 'brown']],
  [/\broblox\b/, 'blocky game world', ['red', 'black']],
  [/\b(super mario|mario bros|mario)\b/, 'mushroom kingdom game', ['red', 'blue']],
  [/\b(stitch|lilo)\b/, 'blue space creature', ['blue', 'purple']],
  [/\bbluey\b/, 'blue puppy family', ['baby blue', 'orange']],
  [/\b(peppa pig|peppa)\b/, 'pink piglet', ['pink', 'red']],
  [/\bdoraemon\b/, 'blue robot cat', ['blue', 'white']],
  [/\b(bts|blackpink|k-?pop)\b/, 'K-pop concert', ['purple', 'black']],
  [/\b(toy story|buzz lightyear|woody)\b/, 'toy cowboy and space ranger', ['blue', 'yellow']],
  [/\b(cars movie|lightning mcqueen)\b/, 'red race car', ['red', 'black']],
  [/\b(jollibee)\b/, 'happy bee mascot', ['red', 'yellow']],
];

const THEMES: Array<[RegExp, string, string[]]> = [
  [/\bunicorns?\b/, 'unicorn', ['lavender', 'pink']],
  [/\b(dinosaurs?|dino)\b/, 'dinosaur', ['green', 'orange']],
  [/\bmermaids?\b/, 'mermaid', ['teal', 'lavender']],
  [/\bprincess\b/, 'princess', ['pink', 'gold']],
  [/\b(safari|jungle|animals?)\b/, 'safari', ['sage', 'brown']],
  [/\b(space|galaxy|astronaut|planets?)\b/, 'space', ['navy', 'silver']],
  [/\b(under the sea|ocean|beach|sea)\b/, 'under the sea', ['baby blue', 'teal']],
  [/\b(butterfly|butterflies|paru-?paro)\b/, 'butterfly', ['lavender', 'baby pink']],
  [/\brainbow\b/, 'rainbow', ['pink', 'yellow', 'baby blue']],
  [/\b(korean|minimalist|minimal|simple lang|clean)\b/, 'minimalist', ['cream', 'white']],
  [/\b(vintage|lambeth)\b/, 'vintage piping', ['baby pink', 'white']],
  [/\b(rustic|boho)\b/, 'rustic', ['cream', 'brown']],
  [/\b(basketball|football|soccer|volleyball|sports?)\b/, 'sports', ['orange', 'navy']],
  [/\b(floral|garden)\b/, 'floral garden', ['baby pink', 'sage']],
];

/** Things most home bakers can't do; reported, never silently dropped. */
const HARD_TECHNIQUES = [
  'sugar flowers', 'gumpaste flowers', 'gum paste', 'isomalt', 'sculpted cake', 'sculpted', '3d cake',
  'gravity defying', 'gravity-defying', 'edible print', 'photo cake', 'edible image', 'wafer paper',
  'airbrush', 'hand painted', 'hand-painted',
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, enero: 0,
  feb: 1, february: 1, pebrero: 1,
  mar: 2, march: 2, marso: 2,
  apr: 3, april: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, june: 5, hunyo: 5,
  jul: 6, july: 6, hulyo: 6,
  aug: 7, august: 7, agosto: 7,
  sep: 8, sept: 8, september: 8, setyembre: 8,
  oct: 9, october: 9, oktubre: 9,
  nov: 10, november: 10, nobyembre: 10,
  dec: 11, december: 11, disyembre: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, lunes: 1, tuesday: 2, martes: 2, wednesday: 3, miyerkules: 3,
  thursday: 4, huwebes: 4, friday: 5, biyernes: 5, saturday: 6, sabado: 6,
};

const NUMBER_WORDS: Record<string, number> = {
  single: 1, one: 1, isa: 1, isang: 1,
  two: 2, double: 2, dalawa: 2, dalawang: 2,
  three: 3, triple: 3, tatlo: 3, tatlong: 3,
};

// ---------- helpers ----------

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phraseRe(phrase: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])(${escapeRe(phrase.toLowerCase())})(?=$|[^a-z0-9])`, 'i');
}

/** Find a phrase, blank it out so it can't match twice, and return the new text. */
function take(text: string, phrase: string): { hit: boolean; text: string; index: number } {
  const m = phraseRe(phrase).exec(text);
  if (!m) return { hit: false, text, index: -1 };
  const start = m.index + m[1]!.length;
  const end = start + m[2]!.length;
  return { hit: true, text: text.slice(0, start) + ' '.repeat(end - start) + text.slice(end), index: start };
}

function toNumber(raw: string, k?: string): number {
  const n = Number(raw.replace(/,/g, ''));
  return k ? n * 1000 : n;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---------- field readers (exported for tests) ----------

export function readBudget(text: string): number | null {
  const t = text.toLowerCase();
  const NOT_MONEY = /^\s*(pax|people|persons?|guests?|servings?|tao|katao|bisita|slices?|inch|inches|in\b|"|”|pulgada|tiers?|layers?|st\b|nd\b|rd\b|th\b|years?|yrs?|taon|days?|araw|pcs?|pieces?|cupcakes?)/;
  const candidates: Array<{ value: number; strong: number; index: number }> = [];
  const patterns: Array<[RegExp, number]> = [
    [/(?:budget|badyet|hanggang|max(?:imum)?|up to|within|below|under|less than|not more than|around|mga|nasa)(?:\s*(?:ko|namin|natin|lang|po|ngayon|is|ay|ng|na|:|-)(?![a-z]))*\s*(?:₱|php|p)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/g, 3],
    [/(?:₱|php\s?|\bp\s?)(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/g, 2],
    [/\b(\d[\d,]*(?:\.\d+)?)\s*(?:pesos?|php)\b/g, 2],
    [/\b(\d[\d,]*(?:\.\d+)?)\s*(k)\b/g, 1],
  ];
  for (const [re, strong] of patterns) {
    for (const m of t.matchAll(re)) {
      const after = t.slice((m.index ?? 0) + m[0].length);
      if (!m[2] && NOT_MONEY.test(after)) continue;
      const value = toNumber(m[1]!, m[2]);
      if (value >= 200 && value <= 500000) candidates.push({ value, strong, index: m.index ?? 0 });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.strong - a.strong || a.index - b.index);
  return Math.round(candidates[0]!.value);
}

export function readServings(text: string): number | null {
  const t = text.toLowerCase();
  const patterns = [
    /(?:good for|for|pang|pang-|para sa|mga)\s*(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(?:pax|people|persons?|guests?|tao|katao|bisita|servings?|slices?)?/,
    /(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(?:pax|people|persons?|guests?|tao|katao|bisita|servings?|slices?)\b/,
    /(\d{1,3})\s*(?:na\s+)?(?:pax|people|persons?|guests?|tao|katao|bisita|servings?|slices?)\b/,
    /(?:good for|pang|pang-|serves)\s*(\d{1,3})\b/,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) {
      const n = Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0);
      if (n >= 1 && n <= 500) return n;
    }
  }
  return null;
}

export function readTiers(text: string): number | null {
  const t = text.toLowerCase();
  const m = /\b(\d|single|one|two|three|double|triple|isang|isa|dalawang|dalawa|tatlong|tatlo)\s*-?\s*(?:tiers?|tiered|patong|layers? na tier)\b/.exec(t);
  if (m) {
    const n = /^\d$/.test(m[1]!) ? Number(m[1]) : NUMBER_WORDS[m[1]!];
    if (n && n >= 1 && n <= 5) return n;
  }
  if (/\btiered\b/.test(t)) return 2;
  return null;
}

export function readSize(text: string): number | null {
  const t = text.toLowerCase();
  if (/\bbento\b/.test(t)) return 4;
  const m = /\b(\d{1,2})\s*(?:"|”|''|inch(?:es)?\b|in\b|pulgada)/.exec(t);
  if (m) {
    const n = Number(m[1]);
    if (n >= 3 && n <= 14) return n;
  }
  return null;
}

export function readAge(text: string): number | null {
  const t = text.toLowerCase();
  const m =
    /\b(\d{1,3})\s*(?:st|nd|rd|th)\s*(?:birthday|bday|b-day|kaarawan|anniv|anniversary)?/.exec(t) ??
    /(?:turning|magiging|edad|age)\s*(\d{1,3})\b/.exec(t) ??
    /\b(\d{1,3})\s*(?:years? old|yrs? old|taong gulang|y\/o|yo)\b/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 120 ? n : null;
}

export function readDate(text: string, today: Date): string | null {
  const t = text.toLowerCase();
  const base = startOfDay(today);
  const future = (d: Date) => (d < base ? new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()) : d);

  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const monthAlt = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  m = new RegExp(`\\b(${monthAlt})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`).exec(t);
  if (m) {
    const mo = MONTHS[m[1]!]!;
    const d = new Date(m[3] ? Number(m[3]) : base.getFullYear(), mo, Number(m[2]));
    if (d.getMonth() === mo) return isoDate(m[3] ? d : future(d));
  }
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:ng\\s+|of\\s+)?(${monthAlt})\\b`).exec(t);
  if (m) {
    const mo = MONTHS[m[2]!]!;
    const d = new Date(base.getFullYear(), mo, Number(m[1]));
    if (d.getMonth() === mo) return isoDate(future(d));
  }
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (m) {
    const mo = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (mo >= 0 && mo < 12 && day >= 1 && day <= 31) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear();
      const d = new Date(y, mo, day);
      if (d.getMonth() === mo) return isoDate(m[3] ? d : future(d));
    }
  }
  if (/\b(bukas|tomorrow)\b/.test(t)) return isoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1));
  const wd = new RegExp(`\\b(?:this|next|sa|ngayong|sa darating na)?\\s*(${Object.keys(WEEKDAYS).join('|')})\\b`).exec(t);
  if (wd) {
    const target = WEEKDAYS[wd[1]!]!;
    let add = (target - base.getDay() + 7) % 7;
    if (add === 0) add = 7;
    return isoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + add));
  }
  return null;
}

export function readTextOnCake(original: string): string {
  const quoted = /["“”]([^"“”]{2,40})["“”]/.exec(original);
  if (quoted) return quoted[1]!.trim();
  const labeled = /(?:nakasulat|isulat|sulat|written|write|text|message|dedication|greeting)\s*(?:ay|is|na|ng)?\s*[:-]\s*([^\n,.;!]{2,40})/i.exec(original);
  if (labeled) return labeled[1]!.trim();
  const happy = /\b(happy\s+(?:\d{1,3}(?:st|nd|rd|th)\s+)?(?:birthday|bday|anniversary|anniv|monthsary|graduation|mother'?s day|father'?s day|valentine'?s day|retirement)(?:\s+(?!po\b|ko\b|na\b|sa\b|with\b|and\b|at\b|for\b)[A-Z][a-zA-Z]{1,15})?)/i.exec(original);
  if (happy) return happy[1]!.replace(/\s+/g, ' ').trim();
  return '';
}

export function findTrademark(text: string): { theme: string; colors: string[]; matched: string } | null {
  const t = text.toLowerCase();
  for (const [re, theme, colors] of TRADEMARKS) {
    const m = re.exec(t);
    if (m) return { theme, colors, matched: m[0] };
  }
  return null;
}

/** Swap trademarked names in a free-text string for their generic theme. */
export function genericizeText(text: string): string {
  let out = text;
  for (const [re, theme] of TRADEMARKS) out = out.replace(new RegExp(re.source, 'gi'), theme);
  return out;
}

export function colorByName(name: string): ColorHit | null {
  const row = COLOR_WORDS.find(([, n]) => n === name);
  return row ? { name: row[1], hex: row[2] } : null;
}

// ---------- main ----------

export function readRequest(text: string, menu: PublicMenu, today = new Date()): ParsedRequest {
  const original = text.slice(0, 2000);
  const found: string[] = [];

  const textOnCake = readTextOnCake(original);
  let work = original.toLowerCase();
  if (textOnCake) work = work.replace(textOnCake.toLowerCase(), ' '.repeat(textOnCake.length));

  // Trademarks -> generic theme (and blank them out so "spider" doesn't become a decoration).
  const tm = findTrademark(work);
  let theme = '';
  let themeColors: string[] = [];
  let licensedNote = '';
  if (tm) {
    theme = tm.theme;
    themeColors = tm.colors;
    licensedNote = `Customer mentioned "${tm.matched}". Use a licensed topper or toy for the character; the cake design stays generic.`;
    for (const [re] of TRADEMARKS) work = work.replace(new RegExp(re.source, 'gi'), (s) => ' '.repeat(s.length));
    found.push('theme');
  } else {
    for (const [re, name, colors] of THEMES) {
      if (re.test(work)) {
        theme = name;
        themeColors = colors;
        found.push('theme');
        break;
      }
    }
  }

  // Parts and unavailable things, longest phrase first so "chocolate drip" beats "chocolate".
  type Entry = { phrase: string; kind: 'part' | 'unavailable'; id: string; label: string };
  const entries: Entry[] = [];
  for (const c of menu.components) for (const k of c.keywords) entries.push({ phrase: k, kind: 'part', id: c.id, label: c.name });
  for (const n of menu.notOffered) for (const k of n.keywords) entries.push({ phrase: k, kind: 'unavailable', id: n.name, label: n.name });
  for (const h of [...HARD_TECHNIQUES, ...menu.cannotDo]) entries.push({ phrase: h, kind: 'unavailable', id: h, label: h });
  entries.sort((a, b) => b.phrase.length - a.phrase.length);

  const partHits: Array<{ id: string; index: number }> = [];
  const unavailable = new Set<string>();
  for (const e of entries) {
    if (!e.phrase.trim()) continue;
    for (;;) {
      const r = take(work, e.phrase);
      if (!r.hit) break;
      work = r.text;
      if (e.kind === 'part') partHits.push({ id: e.id, index: r.index });
      else unavailable.add(e.label);
    }
  }
  partHits.sort((a, b) => a.index - b.index);
  const byId = new Map(menu.components.map((c) => [c.id, c]));
  let flavorId: string | null = null;
  let coveringId: string | null = null;
  const componentIds: string[] = [];
  for (const h of partHits) {
    const c = byId.get(h.id);
    if (!c) continue;
    if (c.category === 'flavor') flavorId ??= c.id;
    else if (c.category === 'covering') coveringId ??= c.id;
    else if (!componentIds.includes(c.id)) componentIds.push(c.id);
  }
  if (flavorId) found.push('flavor');
  if (coveringId) found.push('covering');
  if (componentIds.length) found.push('decorations');

  // Colors on what's left (so "red velvet" and "gold leaf" don't become colors).
  const colorHits: Array<ColorHit & { index: number }> = [];
  for (const [words, name, hex] of COLOR_WORDS) {
    for (const w of words.slice().sort((a, b) => b.length - a.length)) {
      const r = take(work, w);
      if (r.hit) {
        work = r.text;
        if (!colorHits.some((c) => c.name === name)) colorHits.push({ name, hex, index: r.index });
      }
    }
  }
  colorHits.sort((a, b) => a.index - b.index);
  let colors: ColorHit[] = colorHits.map(({ name, hex }) => ({ name, hex }));
  if (colors.length) found.push('colors');
  if (!colors.length && themeColors.length) {
    colors = themeColors.map((n) => colorByName(n)).filter((c): c is ColorHit => !!c);
  }
  if (/\bpastel\b/.test(original.toLowerCase())) colors = colors.map((c) => ({ name: `pastel ${c.name}`, hex: pastel(c.hex) }));

  let occasion = '';
  for (const [re, name] of OCCASIONS) {
    if (re.test(original.toLowerCase())) {
      occasion = name;
      found.push('occasion');
      break;
    }
  }

  const budget = readBudget(original);
  const servings = readServings(original);
  const tiers = readTiers(original);
  const sizeIn = readSize(original);
  const age = readAge(original);
  const eventDate = readDate(original, today);
  if (budget) found.push('budget');
  if (servings) found.push('servings');
  if (tiers) found.push('tiers');
  if (sizeIn) found.push('size');
  if (eventDate) found.push('date');
  if (textOnCake) found.push('text');

  const confidence = Math.min(0.9, 0.2 + found.length * 0.08);
  return {
    occasion,
    age,
    servings,
    budget,
    tiers,
    sizeIn,
    eventDate,
    colors,
    flavorId,
    coveringId,
    componentIds,
    unavailable: [...unavailable],
    textOnCake,
    theme,
    licensedNote,
    found,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/** Mix a color 45% toward white. */
export function pastel(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
