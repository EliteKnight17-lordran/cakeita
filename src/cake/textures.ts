import * as THREE from 'three';

/**
 * Procedural textures for the 3D cake, drawn on a canvas at runtime.
 * No image files, so the cake still works offline and stays tiny.
 */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const cache = new Map<string, THREE.Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, rnd: () => number) => void, repeat: [number, number], color = false): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, seeded(key.length * 97 + 13));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, rnd: () => number, w: number, h: number, n: number, size: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    const s = size * (0.4 + rnd());
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Bump map for a frosted side: horizontal spatula strokes (buttercream) or soft lumps (whipped). */
export function frostingBump(kind: 'buttercream' | 'whipped' | 'fondant' | 'ganache' | 'naked'): THREE.Texture | null {
  return canvasTexture(`bump-${kind}`, 512, 256, (ctx, rnd) => {
    const W = 512;
    const H = 256;
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, W, H);
    if (kind === 'buttercream' || kind === 'naked') {
      // Long, gentle spatula sweeps around the cake.
      for (let i = 0; i < 70; i++) {
        const y = rnd() * H;
        const v = rnd() > 0.5 ? 255 : 0;
        ctx.strokeStyle = `rgba(${v},${v},${v},${0.08 + rnd() * 0.12})`;
        ctx.lineWidth = 1 + rnd() * 5;
        ctx.beginPath();
        ctx.moveTo(-10, y);
        for (let x = 0; x <= W + 10; x += 32) ctx.lineTo(x, y + (rnd() - 0.5) * 3);
        ctx.stroke();
      }
      noise(ctx, rnd, W, H, 900, 1.2, 0.18);
    } else if (kind === 'whipped') {
      noise(ctx, rnd, W, H, 260, 9, 0.12);
      noise(ctx, rnd, W, H, 1200, 2, 0.15);
    } else if (kind === 'fondant') {
      noise(ctx, rnd, W, H, 500, 6, 0.04);
    } else {
      noise(ctx, rnd, W, H, 200, 8, 0.03);
    }
  }, [6, 1]);
}

/** Crumb texture for the sponge on a semi-naked cake. */
export function crumbBump(): THREE.Texture | null {
  return canvasTexture('crumb', 256, 256, (ctx, rnd) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = rnd() > 0.55 ? 0 : 255;
      ctx.fillStyle = `rgba(${v},${v},${v},${0.15 + rnd() * 0.35})`;
      ctx.beginPath();
      ctx.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [8, 2]);
}

/** Twisted stripes for birthday candles. */
export function candleStripes(color: string): THREE.Texture | null {
  return canvasTexture(`candle-${color}`, 64, 256, (ctx) => {
    ctx.fillStyle = '#fffaf3';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = color;
    for (let y = -64; y < 320; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y + 32);
      ctx.lineTo(64, y + 48);
      ctx.lineTo(0, y + 16);
      ctx.closePath();
      ctx.fill();
    }
  }, [1, 1], true);
}

/** Tiny seeds on strawberries. */
export function strawberrySkin(): THREE.Texture | null {
  return canvasTexture('strawberry', 128, 128, (ctx, rnd) => {
    ctx.fillStyle = '#c8202f';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#f3d36b' : '#e8c255';
      ctx.beginPath();
      ctx.ellipse(rnd() * 128, rnd() * 128, 1.6, 2.4, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [2, 2], true);
}
