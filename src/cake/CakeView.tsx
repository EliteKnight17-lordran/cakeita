import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CakeVisual } from '../domain/visual';
import { usePrefs, useTx } from '../lib/prefs';
import { Cake2D } from './Cake2D';

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
    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Put a white background behind the transparent WebGL canvas and add a small caption. */
function canvasToPng(canvas: HTMLCanvasElement, caption: string): string {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height + 60;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff8f0';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  ctx.fillStyle = '#6b4a52';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(caption, c.width / 2, c.height - 22);
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
      const url = canvasRef.current && use3D ? canvasToPng(canvasRef.current, caption) : svgRef.current ? await svgToPng(svgRef.current) : null;
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cakeita-design.png';
      a.click();
    } catch {
      /* ignore: saving a picture is optional */
    }
  }, [use3D, caption]);

  return (
    <figure className={`relative m-0 ${className}`}>
      <div
        className="relative aspect-[16/14] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#fff3e6] to-[#fbe7ee]"
        role="img"
        aria-label={description}
        onPointerDown={() => setTouched(true)}
      >
        <Banderitas />
        {use3D ? (
          <GLBoundary fallback={flat}>
            <Suspense fallback={<div className="h-full w-full animate-pulse">{flat}</div>}>
              <Cake3D visual={visual} spin={spin} lite={lite} autoRotate={!lite && !touched && !idle && !reduceMotion} onReady={(c) => (canvasRef.current = c)} />
            </Suspense>
          </GLBoundary>
        ) : (
          flat
        )}
        {use3D && !touched && (
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-ink-soft">
            {tx('Drag to turn', 'I-drag para ikutin')}
          </span>
        )}
      </div>
      <figcaption className="sr-only">{description}</figcaption>
      {showTools && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {use3D && (
            <>
              <button type="button" className="btn-ghost" onClick={() => { setTouched(true); setSpin((s) => s - Math.PI / 4); }} aria-label={tx('Turn left', 'Ikot pakaliwa')}>
                ↺
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setTouched(true); setSpin((s) => s + Math.PI / 4); }} aria-label={tx('Turn right', 'Ikot pakanan')}>
                ↻
              </button>
            </>
          )}
          <button type="button" className="btn-ghost" onClick={save}>
            {tx('Save picture', 'I-save ang picture')}
          </button>
        </div>
      )}
      <p className="mt-1 text-center text-sm text-ink-soft">{tx('Concept only. The final cake may look different.', 'Concept lang ito. Puwedeng mag-iba nang kaunti ang totoong cake.')}</p>
    </figure>
  );
}

/** Fiesta flags strung across the top of the cake stage. Decorative only. */
function Banderitas() {
  const colors = ['#f08db0', '#f5c76a', '#8cc7ef', '#9ed8ab', '#c7a3e8'];
  const n = 13;
  return (
    <svg className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 w-full" viewBox="0 0 260 40" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 4 Q130 22 260 4" fill="none" stroke="#d9b8a6" strokeWidth="1.2" />
      {Array.from({ length: n }, (_, i) => {
        const x = (i + 0.5) * (260 / n);
        const t = x / 260;
        const y = 4 + 36 * t * (1 - t); // on the string curve
        const w = 7;
        return <path key={i} d={`M${x - w} ${y} L${x + w} ${y} L${x} ${y + 15} Z`} fill={colors[i % colors.length]} opacity="0.9" />;
      })}
    </svg>
  );
}
