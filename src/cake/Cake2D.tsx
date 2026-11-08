import { forwardRef, useMemo } from 'react';
import { MOTIFS, motifFill } from '../domain/motifs';
import { shade, type CakeVisual } from '../domain/visual';

/**
 * Side-view SVG cake. Used for thumbnails, printing, and as the fallback when
 * WebGL is not available (old phones, battery saver, some school laptops).
 * Draws the same parts as the 3D cake.
 */

interface Props {
  visual: CakeVisual;
  title: string;
  className?: string;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const Cake2D = forwardRef<SVGSVGElement, Props>(function Cake2D({ visual: v, title, className }, ref) {
  const W = 320;
  const H = 300;
  const scale = 13; // px per inch
  const standH = 18;
  const groundY = H - 24;

  const layout = useMemo(() => {
    let y = groundY - standH;
    return v.tiers.map((t) => {
      const w = t.d * scale * 1.6;
      const h = t.h * scale * 1.15;
      y -= h;
      return { x: (W - w) / 2, y, w, h };
    });
  }, [v.tiers, groundY]);

  const top = layout[layout.length - 1];
  const rand = seeded(7);
  const sprinkleColors = ['#e0457b', '#4a7bd0', '#f5d34a', '#5fae6b', '#ffffff'];
  const frostEdge = shade(v.frosting, -0.12);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className={className} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      <ellipse cx={W / 2} cy={groundY + 6} rx={(layout[0]?.w ?? 120) * 0.7} ry={8} fill="#000" opacity={0.08} />
      {/* stand */}
      <rect x={W / 2 - 12} y={groundY - standH + 6} width={24} height={standH - 4} fill="#e9dccb" />
      <rect x={(W - (layout[0]?.w ?? 100) * 1.2) / 2} y={groundY - standH} width={(layout[0]?.w ?? 100) * 1.2} height={7} rx={3} fill="#f1e6d6" stroke="#d9c7ae" />
      <rect x={W / 2 - 40} y={groundY - 2} width={80} height={6} rx={3} fill="#e9dccb" />

      {layout.map((l, i) => (
        <g key={i}>
          {v.covering === 'naked' ? (
            <>
              <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={6} fill={v.sponge} />
              {[0.33, 0.66].map((f) => (
                <rect key={f} x={l.x} y={l.y + l.h * f - 3} width={l.w} height={6} fill="#fffaf0" opacity={0.9} />
              ))}
              <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={6} fill="#fffaf0" opacity={0.35} />
            </>
          ) : (
            <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={v.covering === 'fondant' ? 8 : 5} fill={v.frosting} stroke={frostEdge} strokeWidth={1} />
          )}
          {(v.covering === 'buttercream' || v.covering === 'whipped') &&
            Array.from({ length: Math.round(l.w / 12) }, (_, k) => (
              <circle key={k} cx={l.x + 6 + k * 12} cy={l.y + l.h - 2} r={5} fill={v.accent} opacity={0.9} />
            ))}
          {v.pearls &&
            Array.from({ length: Math.round(l.w / 9) }, (_, k) => (
              <circle key={k} cx={l.x + 4 + k * 9} cy={l.y + l.h - 3} r={3.2} fill="#fdf8ee" stroke="#d8cbb5" strokeWidth={0.6} />
            ))}
          {v.gold && i === layout.length - 1 &&
            Array.from({ length: 7 }, (_, k) => (
              <rect key={k} x={l.x + 10 + rand() * (l.w - 24)} y={l.y + 10 + rand() * (l.h - 20)} width={6 + rand() * 6} height={4 + rand() * 4} fill="#d4af37" transform={`rotate(${rand() * 60 - 30})`} transform-origin="center" />
            ))}
        </g>
      ))}

      {top && v.drip && (
        <path
          d={(() => {
            const n = Math.max(6, Math.round(top.w / 16));
            let d = `M ${top.x} ${top.y + 4}`;
            for (let k = 0; k < n; k++) {
              const x0 = top.x + (k * top.w) / n;
              const x1 = top.x + ((k + 1) * top.w) / n;
              const depth = 10 + ((k * 37) % 5) * 6;
              d += ` L ${x0 + (x1 - x0) * 0.3} ${top.y + 8} Q ${x0 + (x1 - x0) * 0.5} ${top.y + depth + 10} ${x0 + (x1 - x0) * 0.7} ${top.y + 8} L ${x1} ${top.y + 6}`;
            }
            d += ` L ${top.x + top.w} ${top.y} L ${top.x} ${top.y} Z`;
            return d;
          })()}
          fill={v.dripColor}
        />
      )}

      {top && v.textStyle === 'piped' && v.text && (
        <text x={W / 2} y={top.y + top.h * 0.58} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight={700} fontSize={Math.min(18, (top.w / Math.max(6, v.text.length)) * 1.7)} fill={v.accent}>
          {v.text}
        </text>
      )}

      {top && v.sprinkles &&
        Array.from({ length: 26 }, (_, k) => (
          <rect key={k} x={top.x + 6 + rand() * (top.w - 12)} y={top.y + 2 + rand() * (top.h * 0.9)} width={5} height={2} rx={1} fill={sprinkleColors[k % sprinkleColors.length]} transform={`rotate(${rand() * 180} ${top.x + top.w / 2} ${top.y + top.h / 2})`} opacity={0.95} />
        ))}

      {top && v.rosettes &&
        (() => {
          const n = Math.max(4, Math.round(top.w / 18));
          return Array.from({ length: n }, (_, k) => (
            <circle key={k} cx={top.x + 8 + (k * (top.w - 16)) / (n - 1)} cy={top.y - 4} r={6.5} fill={v.accent} stroke={shade(v.accent, -0.2)} />
          ));
        })()}

      {top && v.fruits && (
        <g>
          {[0.25, 0.45, 0.65].map((f, k) => (
            <path key={k} d={`M ${top.x + top.w * f} ${top.y - 2} l 7 -14 l 7 14 z`} fill="#d23a3a" />
          ))}
          {[0.35, 0.55, 0.78].map((f, k) => (
            <circle key={k} cx={top.x + top.w * f} cy={top.y - 5} r={5} fill="#2c3e8f" />
          ))}
        </g>
      )}

      {top && v.flowers && (
        <g>
          {[
            [top.x + top.w * 0.78, top.y - 6, 13],
            [top.x + top.w * 0.92, top.y + 10, 10],
            [top.x + top.w * 0.64, top.y - 2, 9],
          ].map(([cx, cy, r], k) => (
            <g key={k}>
              {Array.from({ length: 6 }, (_, p) => (
                <circle key={p} cx={cx! + Math.cos((p * Math.PI) / 3) * r! * 0.55} cy={cy! + Math.sin((p * Math.PI) / 3) * r! * 0.55} r={r! * 0.5} fill={k === 1 ? '#fffaf3' : v.accent} />
              ))}
              <circle cx={cx} cy={cy} r={r! * 0.3} fill="#f5d34a" />
            </g>
          ))}
          <ellipse cx={top.x + top.w * 0.86} cy={top.y + 2} rx={9} ry={4} fill="#5fae6b" transform={`rotate(-25 ${top.x + top.w * 0.86} ${top.y + 2})`} />
        </g>
      )}

      {top && v.motif && (() => {
        const withWords = v.textStyle === 'acrylic' && !!v.text;
        const size = Math.max(44, Math.min(78, top.w * (withWords ? 0.36 : 0.5)));
        const cx = withWords ? top.x + top.w * 0.8 : W / 2;
        const stick = 16;
        const y0 = top.y - stick - size;
        return (
          <g data-part="motif">
            <line x1={cx} y1={top.y + 2} x2={cx} y2={top.y - stick - 4} stroke="#c9a227" strokeWidth={2} />
            <g transform={`translate(${cx - size / 2} ${y0}) scale(${size / 100})`}>
              {MOTIFS[v.motif.key].layers.map((l, i) => (
                <path key={i} d={l.d} fill={motifFill(l.fill, v.motif!)} stroke={i === 0 ? '#00000026' : 'none'} strokeWidth={1.5} />
              ))}
            </g>
          </g>
        );
      })()}

      {top && v.candles > 0 &&
        Array.from({ length: v.candles }, (_, k) => {
          const cx = top.x + top.w * 0.2 + (k * top.w * 0.6) / Math.max(1, v.candles - 1 || 1) - (v.candles === 1 ? -top.w * 0.3 : 0);
          return (
            <g key={k}>
              <rect x={cx - 2.5} y={top.y - 26} width={5} height={24} fill={k % 2 ? '#fffaf3' : v.accent} stroke="#00000022" />
              <path d={`M ${cx} ${top.y - 38} q 5 7 0 11 q -5 -4 0 -11`} fill="#ffb400" />
            </g>
          );
        })}

      {top && v.textStyle === 'acrylic' && v.text && (
        <g>
          <line x1={W / 2 - 30} y1={top.y} x2={W / 2 - 30} y2={top.y - 40} stroke="#c9a227" strokeWidth={2} />
          <line x1={W / 2 + 30} y1={top.y} x2={W / 2 + 30} y2={top.y - 40} stroke="#c9a227" strokeWidth={2} />
          <text x={W / 2} y={top.y - 46} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight={700} fontSize={Math.min(24, 260 / Math.max(6, v.text.length))} fill="#b8901c" stroke="#7a5c0a" strokeWidth={0.4}>
            {v.text}
          </text>
        </g>
      )}

      {top && v.figure && (
        <g>
          <ellipse cx={top.x + top.w * 0.3} cy={top.y - 14} rx={9} ry={13} fill={v.accent} />
          <circle cx={top.x + top.w * 0.3} cy={top.y - 32} r={8} fill="#f6d2b8" />
          <circle cx={top.x + top.w * 0.3 - 3} cy={top.y - 33} r={1.2} fill="#2a2a2a" />
          <circle cx={top.x + top.w * 0.3 + 3} cy={top.y - 33} r={1.2} fill="#2a2a2a" />
        </g>
      )}
    </svg>
  );
});
