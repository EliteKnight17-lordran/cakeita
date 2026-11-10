/**
 * Theme toppers: generic cut-out shapes (like the printed cardstock toppers Filipino home
 * bakers stick on cakes). Characters are never drawn; "Spider-Man" becomes a hero emblem in
 * red and blue, plus a note to buy a licensed topper. Pure data, shared by the 2D and 3D cake.
 *
 * Each motif is a stack of filled SVG paths in a 100 x 100 box (y down). `fill` is a role the
 * cake picks colors for, or a fixed hex.
 */

export type MotifRole = 'main' | 'accent' | 'white' | 'gold' | 'dark';
export interface MotifLayer {
  d: string;
  fill: MotifRole | `#${string}`;
}
export interface Motif {
  key: MotifKey;
  name: string;
  nameTl: string;
  layers: MotifLayer[];
}

export const MOTIF_KEYS = [
  'star', 'heart', 'hero', 'web', 'mask', 'ring', 'cape', 'crown', 'rocket', 'dino', 'unicorn', 'butterfly', 'ball', 'paw', 'car', 'grad', 'snowflake', 'shell', 'rainbow', 'bolt', 'blocks',
] as const;
export type MotifKey = (typeof MOTIF_KEYS)[number];

const r1 = (n: number) => Math.round(n * 10) / 10;

function starPath(cx: number, cy: number, R: number, r: number, n = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    pts.push(`${r1(cx + Math.cos(a) * rad)} ${r1(cy + Math.sin(a) * rad)}`);
  }
  return `M${pts.join(' L')} Z`;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${r1(cx - r)} ${r1(cy)} A${r} ${r} 0 1 0 ${r1(cx + r)} ${r1(cy)} A${r} ${r} 0 1 0 ${r1(cx - r)} ${r1(cy)} Z`;
}

function shield(s: number): string {
  // Scaled around the centre (50, 50).
  const p = (x: number, y: number) => `${r1(50 + (x - 50) * s)} ${r1(50 + (y - 50) * s)}`;
  return `M${p(50, 4)} L${p(90, 16)} L${p(90, 46)} C${p(90, 72)} ${p(72, 88)} ${p(50, 96)} C${p(28, 88)} ${p(10, 72)} ${p(10, 46)} L${p(10, 16)} Z`;
}

/** A thin bar from (x1,y1) to (x2,y2), as a polygon. */
function bar(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  return `M${r1(x1 + nx)} ${r1(y1 + ny)} L${r1(x2 + nx)} ${r1(y2 + ny)} L${r1(x2 - nx)} ${r1(y2 - ny)} L${r1(x1 - nx)} ${r1(y1 - ny)} Z`;
}

function snowflake(): string {
  const parts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    const at = (d: number, off = 0) => [50 + Math.cos(a + off) * d, 50 + Math.sin(a + off) * d] as const;
    const [ex, ey] = at(44);
    parts.push(bar(50, 50, ex, ey, 6));
    for (const d of [20, 32]) {
      const [bx, by] = at(d);
      for (const s of [-1, 1]) {
        const b = a + s * 0.75;
        parts.push(bar(bx, by, bx + Math.cos(b) * 11, by + Math.sin(b) * 11, 5));
      }
    }
  }
  return parts.join(' ');
}

/** A spider-web pattern (generic: no character, just the web). */
function web(): string {
  const parts: string[] = [];
  const n = 8;
  const pt = (k: number, r: number) => [50 + Math.cos((k * 2 * Math.PI) / n - Math.PI / 2) * r, 50 + Math.sin((k * 2 * Math.PI) / n - Math.PI / 2) * r] as const;
  for (let k = 0; k < n; k++) {
    const [x, y] = pt(k, 44);
    parts.push(bar(50, 50, x, y, 3.6));
    for (const r of [13, 25, 37]) {
      const [x1, y1] = pt(k, r);
      const [x2, y2] = pt(k + 1, r);
      parts.push(bar(x1, y1, x2, y2, 3.2));
    }
  }
  return parts.join(' ');
}

function arcBand(R: number, t: number, cy = 80): string {
  return `M${50 - R} ${cy} A${R} ${R} 0 0 1 ${50 + R} ${cy} L${50 + R - t} ${cy} A${R - t} ${R - t} 0 0 0 ${50 - R + t} ${cy} Z`;
}

export const MOTIFS: Record<MotifKey, Motif> = {
  star: { key: 'star', name: 'Star', nameTl: 'Bituin', layers: [{ d: starPath(50, 53, 47, 20), fill: 'main' }, { d: starPath(50, 53, 30, 13), fill: 'gold' }] },
  heart: {
    key: 'heart',
    name: 'Heart',
    nameTl: 'Puso',
    layers: [
      { d: 'M50 90 C20 68 5 50 5 32 C5 17 16 7 30 7 C39 7 46 12 50 20 C54 12 61 7 70 7 C84 7 95 17 95 32 C95 50 80 68 50 90 Z', fill: 'main' },
      { d: circle(30, 28, 7), fill: 'white' },
    ],
  },
  hero: {
    key: 'hero',
    name: 'Hero',
    nameTl: 'Hero',
    layers: [
      { d: shield(1), fill: 'accent' },
      { d: shield(0.8), fill: 'main' },
      { d: starPath(50, 50, 24, 10), fill: 'white' },
    ],
  },
  web: {
    key: 'web',
    name: 'Web hero',
    nameTl: 'Web hero',
    layers: [
      { d: circle(50, 50, 48), fill: 'accent' },
      { d: circle(50, 50, 44), fill: 'main' },
      { d: web(), fill: 'dark' },
    ],
  },
  mask: {
    key: 'mask',
    name: 'Hero mask',
    nameTl: 'Hero mask',
    layers: [
      { d: 'M4 42 C4 26 20 20 35 25 C43 28 46 32 50 32 C54 32 57 28 65 25 C80 20 96 26 96 42 C96 62 81 74 66 70 C57 67 54 60 50 60 C46 60 43 67 34 70 C19 74 4 62 4 42 Z', fill: 'accent' },
      { d: 'M10 43 C10 31 22 27 34 30 C42 33 45 37 50 37 C55 37 58 33 66 30 C78 27 90 31 90 43 C90 58 79 67 67 64 C59 62 55 55 50 55 C45 55 41 62 33 64 C21 67 10 58 10 43 Z', fill: 'main' },
      { d: 'M20 44 C22 36 34 35 40 42 C36 50 24 51 20 44 Z M80 44 C78 36 66 35 60 42 C64 50 76 51 80 44 Z', fill: 'white' },
    ],
  },
  ring: {
    key: 'ring',
    name: 'Power ring',
    nameTl: 'Power ring',
    layers: [
      { d: `${bar(50, 22, 50, 2, 4)} ${bar(50, 22, 22, 6, 4)} ${bar(50, 22, 78, 6, 4)} ${bar(50, 22, 10, 24, 4)} ${bar(50, 22, 90, 24, 4)}`, fill: 'gold' },
      { d: circle(50, 66, 30), fill: 'main' },
      { d: circle(50, 66, 20), fill: 'white' },
      { d: 'M38 20 L62 20 L70 34 L50 50 L30 34 Z', fill: 'accent' },
      { d: 'M42 24 L50 24 L44 34 Z', fill: 'white' },
    ],
  },
  cape: {
    key: 'cape',
    name: 'Hero cape',
    nameTl: 'Hero cape',
    layers: [
      { d: 'M30 12 L70 12 C72 42 84 70 96 94 C80 86 66 92 50 84 C34 92 20 86 4 94 C16 70 28 42 30 12 Z', fill: 'main' },
      { d: `${bar(40, 22, 26, 84, 2.4)} ${bar(50, 22, 50, 82, 2.4)} ${bar(60, 22, 74, 84, 2.4)}`, fill: 'accent' },
      { d: 'M24 6 H76 C76 14 70 18 62 18 H38 C30 18 24 14 24 6 Z', fill: 'accent' },
      { d: `${circle(36, 14, 5)} ${circle(64, 14, 5)}`, fill: 'gold' },
    ],
  },
  crown: {
    key: 'crown',
    name: 'Crown',
    nameTl: 'Korona',
    layers: [
      { d: 'M10 78 L14 30 L33 52 L50 18 L67 52 L86 30 L90 78 Z', fill: 'gold' },
      { d: `${circle(14, 27, 5)} ${circle(50, 15, 6)} ${circle(86, 27, 5)}`, fill: 'gold' },
      { d: 'M8 76 H92 V90 H8 Z', fill: '#b8901c' },
      { d: `${circle(50, 62, 7)} ${circle(29, 66, 4.5)} ${circle(71, 66, 4.5)}`, fill: 'main' },
    ],
  },
  rocket: {
    key: 'rocket',
    name: 'Rocket',
    nameTl: 'Rocket',
    layers: [
      { d: 'M38 66 Q50 104 62 66 Z', fill: 'gold' },
      { d: 'M31 50 L12 76 L32 70 Z M69 50 L88 76 L68 70 Z', fill: 'main' },
      { d: 'M50 4 C67 18 73 40 70 68 H30 C27 40 33 18 50 4 Z', fill: 'white' },
      { d: 'M50 4 C60 12 66 22 68 32 H32 C34 22 40 12 50 4 Z', fill: 'main' },
      { d: circle(50, 46, 8), fill: 'accent' },
    ],
  },
  dino: {
    key: 'dino',
    name: 'Dino',
    nameTl: 'Dino',
    layers: [
      {
        d: 'M14 22 C14 12 30 10 34 18 C36 24 34 30 32 38 C40 44 52 44 64 46 C76 48 88 52 96 58 C88 64 80 66 76 68 L76 88 H66 L64 74 H44 L42 88 H32 L32 72 C26 68 22 58 22 46 L22 32 C18 30 14 28 14 22 Z',
        fill: 'main',
      },
      { d: `${circle(50, 56, 4.5)} ${circle(62, 58, 3.5)} ${circle(40, 58, 3)}`, fill: 'accent' },
      { d: circle(24, 20, 2.4), fill: 'dark' },
    ],
  },
  unicorn: {
    key: 'unicorn',
    name: 'Unicorn',
    nameTl: 'Unicorn',
    layers: [
      { d: 'M22 60 L30 30 L45 54 Z M78 60 L70 30 L55 54 Z', fill: 'white' },
      { d: 'M27 55 L31 39 L39 52 Z M73 55 L69 39 L61 52 Z', fill: 'accent' },
      { d: 'M50 2 L61 56 H39 Z', fill: 'gold' },
      { d: `${bar(43, 44, 58, 38, 2.6)} ${bar(45, 32, 56, 27, 2.4)} ${bar(47, 20, 54, 17, 2.2)}`, fill: '#b8901c' },
      { d: `${circle(30, 72, 7)} ${circle(44, 74, 6)} ${circle(58, 74, 6)} ${circle(70, 72, 7)}`, fill: 'main' },
    ],
  },
  butterfly: {
    key: 'butterfly',
    name: 'Butterfly',
    nameTl: 'Paruparo',
    layers: [
      {
        d: 'M50 46 C40 20 14 6 8 22 C2 38 24 50 50 50 Z M50 46 C60 20 86 6 92 22 C98 38 76 50 50 50 Z M50 52 C30 54 12 64 18 80 C24 94 44 80 50 56 Z M50 52 C70 54 88 64 82 80 C76 94 56 80 50 56 Z',
        fill: 'main',
      },
      { d: `${circle(22, 26, 5)} ${circle(78, 26, 5)} ${circle(28, 74, 4)} ${circle(72, 74, 4)}`, fill: 'white' },
      { d: `M47 30 Q50 25 53 30 L53 78 Q50 84 47 78 Z ${bar(49, 30, 37, 12, 2)} ${bar(51, 30, 63, 12, 2)}`, fill: 'dark' },
    ],
  },
  ball: {
    key: 'ball',
    name: 'Ball',
    nameTl: 'Bola',
    layers: [
      { d: circle(50, 50, 44), fill: 'main' },
      {
        d: `M48.4 7 H51.6 V93 H48.4 Z M7 48.4 H93 V51.6 H7 Z M27 15 C42 32 42 68 27 85 L29.6 87 C46 70 46 30 29.6 13 Z M73 15 C58 32 58 68 73 85 L70.4 87 C54 70 54 30 70.4 13 Z`,
        fill: 'dark',
      },
    ],
  },
  paw: {
    key: 'paw',
    name: 'Paw',
    nameTl: 'Paw',
    layers: [
      { d: `M50 50 C67 50 80 65 78 78 C76 91 63 89 50 86 C37 89 24 91 22 78 C20 65 33 50 50 50 Z ${circle(20, 40, 9)} ${circle(37, 22, 9.5)} ${circle(63, 22, 9.5)} ${circle(80, 40, 9)}`, fill: 'main' },
    ],
  },
  car: {
    key: 'car',
    name: 'Race car',
    nameTl: 'Race car',
    layers: [
      { d: 'M6 64 C6 56 11 52 19 50 L29 34 C31 31 35 30 39 30 H62 C66 30 70 32 72 36 L80 50 C89 51 95 55 95 64 V72 H6 Z', fill: 'main' },
      { d: 'M6 60 H95 V64 H6 Z', fill: 'white' },
      { d: 'M33 48 L40 36 H51 V48 Z M55 36 H63 C65 36 67 37 68 39 L72 48 H55 Z', fill: '#cfe3f2' },
      { d: `${circle(27, 72, 10)} ${circle(74, 72, 10)}`, fill: 'dark' },
      { d: `${circle(27, 72, 4)} ${circle(74, 72, 4)}`, fill: 'white' },
    ],
  },
  grad: {
    key: 'grad',
    name: 'Grad cap',
    nameTl: 'Grad cap',
    layers: [
      { d: 'M24 42 V62 C24 74 76 74 76 62 V42 L50 54 Z', fill: 'dark' },
      { d: 'M50 12 L97 33 L50 54 L3 33 Z', fill: '#3a302c' },
      { d: `${bar(50, 33, 84, 40, 2)} ${bar(84, 40, 84, 64, 2.4)} M80 62 H88 L87 78 H81 Z ${circle(50, 33, 3.4)}`, fill: 'gold' },
    ],
  },
  snowflake: { key: 'snowflake', name: 'Snowflake', nameTl: 'Snowflake', layers: [{ d: snowflake(), fill: 'main' }, { d: circle(50, 50, 7), fill: 'white' }] },
  shell: {
    key: 'shell',
    name: 'Seashell',
    nameTl: 'Kabibe',
    layers: [
      { d: 'M50 88 L14 40 C20 10 80 10 86 40 Z', fill: 'main' },
      { d: `${bar(50, 86, 26, 26, 2.4)} ${bar(50, 86, 40, 18, 2.4)} ${bar(50, 86, 60, 18, 2.4)} ${bar(50, 86, 74, 26, 2.4)}`, fill: 'white' },
      { d: 'M40 86 H60 L56 96 H44 Z', fill: 'accent' },
    ],
  },
  rainbow: {
    key: 'rainbow',
    name: 'Rainbow',
    nameTl: 'Bahaghari',
    layers: [
      { d: arcBand(46, 8), fill: '#e8545a' },
      { d: arcBand(38, 8), fill: '#f2a03d' },
      { d: arcBand(30, 8), fill: '#f4d35e' },
      { d: arcBand(22, 8), fill: '#6cc28a' },
      { d: arcBand(14, 7), fill: '#6aa8e8' },
      { d: `${circle(10, 80, 9)} ${circle(22, 84, 8)} ${circle(78, 84, 8)} ${circle(90, 80, 9)}`, fill: 'white' },
    ],
  },
  bolt: { key: 'bolt', name: 'Bolt', nameTl: 'Kidlat', layers: [{ d: 'M58 3 L16 57 H45 L37 97 L84 39 H55 Z', fill: 'main' }, { d: 'M56 14 L28 52 H40 Z', fill: 'white' }] },
  blocks: {
    key: 'blocks',
    name: 'Blocks',
    nameTl: 'Blocks',
    layers: [
      { d: 'M8 56 H36 V84 H8 Z M64 56 H92 V84 H64 Z M36 28 H64 V56 H36 Z', fill: 'main' },
      { d: 'M36 56 H64 V84 H36 Z M8 28 H36 V56 H8 Z', fill: 'accent' },
      { d: 'M14 62 H22 V70 H14 Z M42 34 H50 V42 H42 Z M70 62 H78 V70 H70 Z', fill: 'white' },
    ],
  },
};

const STYLE_THEMES = /minimalist|vintage|rustic|floral|garden/;

const THEME_MOTIFS: Array<[RegExp, MotifKey]> = [
  [/\bweb\b/, 'web'],
  [/mask|knight/, 'mask'],
  [/\bring\b/, 'ring'],
  [/cape|flying/, 'cape'],
  [/thunder|lightning hero/, 'bolt'],
  [/warrior princess/, 'crown'],
  [/ocean hero/, 'shell'],
  [/hero/, 'hero'],
  [/\bice\b|snow/, 'snowflake'],
  [/princess|doll|fashion/, 'crown'],
  [/kitten|cat with|\bbow\b/, 'heart'],
  [/pupp|paw|dog|safari|jungle|animal/, 'paw'],
  [/electric|lightning|bolt/, 'bolt'],
  [/pixel|block/, 'blocks'],
  [/space|rocket|astronaut|galaxy|planet|ranger/, 'rocket'],
  [/\bcar\b|race/, 'car'],
  [/unicorn/, 'unicorn'],
  [/dino/, 'dino'],
  [/mermaid|sea|ocean|shell|beach/, 'shell'],
  [/butterfl|paru/, 'butterfly'],
  [/rainbow/, 'rainbow'],
  [/sport|ball/, 'ball'],
  [/grad/, 'grad'],
  [/heart|love/, 'heart'],
  [/bee|mascot|kingdom|robot|watermelon|nursery|k-?pop|concert|toy|mouse|polka/, 'star'],
];

/** The topper that fits a theme, or '' for style themes (minimalist, rustic...) and no theme. */
export function themeMotif(theme: string): MotifKey | '' {
  const t = theme.toLowerCase();
  if (!t || STYLE_THEMES.test(t)) return '';
  return THEME_MOTIFS.find(([re]) => re.test(t))?.[1] ?? 'star';
}

/** Theme first, then the occasion, then a star. Used to pre-pick the shape. */
export function motifFor(theme: string, occasion: string): MotifKey {
  const fromTheme = themeMotif(theme);
  if (fromTheme) return fromTheme;
  const o = occasion.toLowerCase();
  if (o.includes('grad')) return 'grad';
  if (o.includes('wedding') || o.includes('anniversary')) return 'heart';
  if (o.includes('debut')) return 'crown';
  return 'star';
}

export function isMotifKey(k: unknown): k is MotifKey {
  return typeof k === 'string' && (MOTIF_KEYS as readonly string[]).includes(k);
}

export interface MotifColors {
  main: string;
  accent: string;
}

export function motifFill(fill: MotifLayer['fill'], c: MotifColors): string {
  switch (fill) {
    case 'main':
      return c.main;
    case 'accent':
      return c.accent;
    case 'white':
      return '#fffdf8';
    case 'gold':
      return '#d4af37';
    case 'dark':
      return '#2b2321';
    default:
      return fill;
  }
}
