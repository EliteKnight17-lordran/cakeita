/**
 * Recognize a known inspo photo on the phone, with no AI and no network.
 *
 * A fingerprint is a 64-bit difference hash of the brightness (the shape of the picture)
 * plus a 4x4 grid of average colors. Both survive resizing and JPEG recompression. We also
 * look for the photo inside a bigger picture (a phone screenshot with bars, or a post with
 * margins) by sliding square windows over it. Only the fingerprint is stored, never the photo.
 */

export interface PixelGrid {
  w: number;
  h: number;
  /** RGBA bytes, row by row (what canvas getImageData gives). */
  data: ArrayLike<number>;
}

export interface Fingerprint {
  /** 64 bits as 16 hex characters. */
  hash: string;
  /** 4x4 cells, each [r, g, b], row by row. */
  colors: number[];
}

export interface PrintMatch {
  bits: number;
  colorDiff: number;
}

/** Summed-area tables so any rectangle's average costs four lookups. */
function tables(p: PixelGrid) {
  const W = p.w + 1;
  const mk = () => new Float64Array(W * (p.h + 1));
  const L = mk();
  const R = mk();
  const G = mk();
  const B = mk();
  for (let y = 0; y < p.h; y++) {
    let sl = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let x = 0; x < p.w; x++) {
      const i = (y * p.w + x) * 4;
      const r = p.data[i] ?? 0;
      const g = p.data[i + 1] ?? 0;
      const b = p.data[i + 2] ?? 0;
      sl += 0.299 * r + 0.587 * g + 0.114 * b;
      sr += r;
      sg += g;
      sb += b;
      const o = (y + 1) * W + x + 1;
      const up = y * W + x + 1;
      L[o] = L[up]! + sl;
      R[o] = R[up]! + sr;
      G[o] = G[up]! + sg;
      B[o] = B[up]! + sb;
    }
  }
  const mean = (t: Float64Array, x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, (x1 - x0) * (y1 - y0));
    return (t[y1 * W + x1]! - t[y0 * W + x1]! - t[y1 * W + x0]! + t[y0 * W + x0]!) / n;
  };
  return { L, R, G, B, mean };
}

type Tables = ReturnType<typeof tables>;

function fingerprintWith(t: Tables, x0: number, y0: number, size: number): Fingerprint {
  const cut = (i: number, n: number) => Math.round((i * size) / n);
  // Brightness on a 9x8 grid; each bit says whether a cell is darker than its right neighbor.
  let hash = '';
  for (let r = 0; r < 8; r++) {
    let nibble = 0;
    let row = '';
    const ya = y0 + cut(r, 8);
    const yb = y0 + Math.max(cut(r + 1, 8), cut(r, 8) + 1);
    let prev = t.mean(t.L, x0, ya, x0 + Math.max(1, cut(1, 9)), yb);
    for (let c = 0; c < 8; c++) {
      const xa = x0 + cut(c + 1, 9);
      const xb = x0 + Math.max(cut(c + 2, 9), cut(c + 1, 9) + 1);
      const cur = t.mean(t.L, xa, ya, xb, yb);
      nibble = (nibble << 1) | (prev < cur ? 1 : 0);
      prev = cur;
      if (c % 4 === 3) {
        row += nibble.toString(16);
        nibble = 0;
      }
    }
    hash += row;
  }
  const colors: number[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const xa = x0 + cut(c, 4);
      const xb = x0 + cut(c + 1, 4);
      const ya = y0 + cut(r, 4);
      const yb = y0 + cut(r + 1, 4);
      colors.push(Math.round(t.mean(t.R, xa, ya, xb, yb)), Math.round(t.mean(t.G, xa, ya, xb, yb)), Math.round(t.mean(t.B, xa, ya, xb, yb)));
    }
  }
  return { hash, colors };
}

/** Fingerprint of one square window of the picture (the whole picture when it is square). */
export function fingerprintAt(p: PixelGrid, x0: number, y0: number, size: number): Fingerprint {
  return fingerprintWith(tables(p), x0, y0, size);
}

export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d + Math.abs(a.length - b.length) * 4;
}

export function colorDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 255;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
  return s / a.length;
}

/** How close a picture must be. Strict on purpose: a wrong match would show the wrong cake. */
export const MAX_BITS = 8;
export const MAX_COLOR_DIFF = 14;

/**
 * Find the known photo anywhere in the picture: the whole square, or a square window inside a
 * taller or wider picture (60% to 100% of its short side). Returns null when nothing is close.
 */
export function findPrint(p: PixelGrid, ref: Fingerprint): PrintMatch | null {
  if (p.w < 16 || p.h < 16) return null;
  const t = tables(p);
  const short = Math.min(p.w, p.h);
  let best: PrintMatch | null = null;
  const sizeStep = Math.max(2, Math.round(short * 0.04));
  for (let size = short; size >= Math.round(short * 0.6); size -= sizeStep) {
    const step = Math.max(1, Math.round(size * 0.03));
    for (let y = 0; y + size <= p.h; y += step) {
      for (let x = 0; x + size <= p.w; x += step) {
        const f = fingerprintWith(t, x, y, size);
        const bits = hashDistance(f.hash, ref.hash);
        if (bits > MAX_BITS) continue;
        const colorDiff = colorDistance(f.colors, ref.colors);
        if (colorDiff > MAX_COLOR_DIFF) continue;
        if (!best || bits + colorDiff / 4 < best.bits + best.colorDiff / 4) best = { bits, colorDiff };
      }
    }
  }
  return best;
}
