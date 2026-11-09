import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CakeVisual } from '../domain/visual';
import { usePrefs, useTx } from '../lib/prefs';
import { StageSparkles } from '../components/Decor';
import { Cake2D } from './Cake2D';
import { IconDownload, IconSlice, IconTurnLeft, IconTurnRight } from '../components/icons';

const Cake3D = lazy(() => import('./Cake3D'));

let webglCache: boolean | null = null;
let softwareGL = false;
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webglCache = !!gl;
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      softwareGL = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/**
 * True on computers that draw 3D without a graphics chip (old PCs, virtual machines, test robots).
 * They get "lite 3D": no auto-turn, no studio lighting or shadows, so the page stays responsive.
 */
export function isSoftwareGL(): boolean {
  hasWebGL();
  try {
    // Testing aid: force the full 3D look even without a graphics chip.
    if (localStorage.getItem('cakeita.full3d') === '1') return false;
  } catch {
    /* storage blocked */
  }
  return softwareGL;
}

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

async function svgToPng(svg: SVGSVGElement): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 900;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f6f1ea';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Wrap lines for the picture card. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/**
 * A shareable picture card from the 3D view: soft studio background, the cake, what it is,
 * and an honest "concept only" line. Sized for Messenger (portrait, 1080 wide).
 */
async function canvasToPng(canvas: HTMLCanvasElement, caption: string, title: string): Promise<string> {
  // The bundled fonts load on demand; make sure they are ready before drawing text.
  await Promise.all(['600 40px "Fraunces Variable"', '700 26px "Inter Variable"', '500 24px "Inter Variable"'].map((f) => document.fonts?.load(f).catch(() => null))).catch(() => null);
  const W = 1080;
  const cakeH = Math.round((canvas.height / canvas.width) * W);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = cakeH + 330;
  const ctx = c.getContext('2d')!;
  const bg = ctx.createRadialGradient(W / 2, cakeH * 0.25, 40, W / 2, cakeH * 0.5, W);
  bg.addColorStop(0, '#fffdfa');
  bg.addColorStop(0.55, '#f3ece4');
  bg.addColorStop(1, '#e6dcd0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, c.height);
  ctx.drawImage(canvas, 0, 0, W, cakeH);
  // Text panel
  ctx.fillStyle = '#fffdfa';
  ctx.fillRect(0, cakeH, W, c.height - cakeH);
  ctx.fillStyle = '#e7ddd3';
  ctx.fillRect(0, cakeH, W, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8c2246';
  ctx.font = '700 26px "Inter Variable", system-ui, sans-serif';
  ctx.fillText('CAKEITA · CAKE DESIGN', 64, cakeH + 70);
  ctx.fillStyle = '#241a17';
  ctx.font = '600 40px "Fraunces Variable", Georgia, serif';
  let y = cakeH + 130;
  for (const l of wrap(ctx, title, W - 128)) {
    ctx.fillText(l, 64, y);
    y += 52;
  }
  ctx.fillStyle = '#6b5e58';
  ctx.font = '500 24px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(caption, 64, c.height - 48);
  return c.toDataURL('image/png');
}

interface Props {
  visual: CakeVisual;
  description: string;
  /** false = always the light 2D drawing (for lists and thumbnails). */
  interactive?: boolean;
  className?: string;
  showTools?: boolean;
  caption?: string;
}

export function CakeView({ visual, description, interactive = true, className = '', showTools = true, caption = 'Concept only, final cake may look different. Made with Cakeita' }: Props) {
  const prefs = usePrefs();
  const tx = useTx();
  const [spin, setSpin] = useState(0);
  const [touched, setTouched] = useState(false);
  const [idle, setIdle] = useState(false);
  const [cut, setCut] = useState(false);
  // Stop the slow auto-turn after a while so phones don't burn battery on a still screen.
  useEffect(() => {
    const t = window.setTimeout(() => setIdle(true), 10_000);
    return () => window.clearTimeout(t);
  }, []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const use3D = interactive && !prefs.force2D && typeof document !== 'undefined' && hasWebGL();
  const lite = use3D && isSoftwareGL();

  const flat = <Cake2D ref={svgRef} visual={visual} title={description} className="h-full w-full" />;

  const save = useCallback(async () => {
    try {
      const url = canvasRef.current && use3D ? await canvasToPng(canvasRef.current, caption, description) : svgRef.current ? await svgToPng(svgRef.current) : null;
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cakeita-design.png';
      a.click();
    } catch {
      /* ignore: saving a picture is optional */
    }
  }, [use3D, caption, description]);

  return (
    <figure className={`relative ${className}`}>
      <div
        className="relative aspect-[16/14] w-full overflow-hidden rounded-2xl border border-line bg-[radial-gradient(120%_90%_at_50%_10%,#fffdfa_0%,#f3ece4_55%,#e6dcd0_100%)]"
        role="img"
        aria-label={cut ? `${description} ${tx('Cut open to show the sponge and filling layers.', 'Hiniwa para makita ang sponge at palaman.')}` : description}
        onPointerDown={() => setTouched(true)}
      >
        {use3D ? (
          <GLBoundary fallback={flat}>
            <Suspense fallback={<div className="h-full w-full animate-pulse">{flat}</div>}>
              <Cake3D visual={visual} spin={spin} lite={lite} cut={cut} autoRotate={!cut && !lite && !touched && !idle && !reduceMotion} onReady={(c) => (canvasRef.current = c)} />
            </Suspense>
          </GLBoundary>
        ) : (
          flat
        )}
        <StageSparkles />
        {use3D && !touched && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-white/90 px-3 py-1 text-xs font-medium tracking-wide text-ink-soft">
            {tx('Drag to turn', 'I-drag para ikutin')}
          </span>
        )}
      </div>
      <figcaption className="sr-only">{description}</figcaption>
      {showTools ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-[8.5rem] flex-1 text-xs leading-snug text-ink-soft">{tx('Concept only. The real cake may differ a little.', 'Concept lang. Puwedeng mag-iba nang kaunti.')}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {use3D && (
              <>
                <button type="button" className="tool-btn" title={tx('Turn left', 'Ikot pakaliwa')} onClick={() => { setTouched(true); setSpin((s) => s - Math.PI / 4); }} aria-label={tx('Turn left', 'Ikot pakaliwa')}>
                  <IconTurnLeft />
                </button>
                <button type="button" className="tool-btn" title={tx('Turn right', 'Ikot pakanan')} onClick={() => { setTouched(true); setSpin((s) => s + Math.PI / 4); }} aria-label={tx('Turn right', 'Ikot pakanan')}>
                  <IconTurnRight />
                </button>
                <button type="button" className="tool-btn" title={cut ? tx('Close the slice', 'Isara ang hiwa') : tx('See inside', 'Tingnan ang loob')} aria-label={tx('See inside', 'Tingnan ang loob')} aria-pressed={cut} data-see-inside onClick={() => { setTouched(true); setCut((c) => !c); }}>
                  <IconSlice />
                </button>
              </>
            )}
            <button type="button" className="tool-btn" title={tx('Save picture', 'I-save ang picture')} aria-label={tx('Save picture', 'I-save ang picture')} onClick={save}>
              <IconDownload />
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-center text-xs text-ink-soft">{tx('Concept only. The real cake may differ a little.', 'Concept lang. Puwedeng mag-iba nang kaunti.')}</p>
      )}
    </figure>
  );
}
