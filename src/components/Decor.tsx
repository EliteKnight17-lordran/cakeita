/**
 * Decorative pieces (all aria-hidden): sprinkles that float around the hero cake and
 * gold sparkles that twinkle on the cake stage. They stop for "reduce motion".
 */

const SPARKLE = 'M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z';

export function Sparkle({ className = '', size = 16, color = '#d4af37', style }: { className?: string; size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true" focusable="false">
      <path d={SPARKLE} fill={color} />
    </svg>
  );
}

/** Sparkles over the cake stage. Sits inside a relatively positioned box. */
export function StageSparkles() {
  const spots: Array<[string, string, number, string, string]> = [
    ['12%', '16%', 14, '0s', '3.4s'],
    ['84%', '12%', 18, '1.1s', '3.8s'],
    ['90%', '58%', 12, '2.2s', '3.1s'],
    ['8%', '64%', 11, '1.6s', '4.2s'],
    ['70%', '30%', 9, '0.6s', '2.8s'],
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {spots.map(([left, top, size, d, t], i) => (
        <span key={i} className="absolute" style={{ left, top }}>
          <Sparkle className="twinkle" size={size} color={i % 3 === 2 ? '#e8b7c4' : '#d4af37'} style={{ ['--d' as string]: d, ['--t' as string]: t }} />
        </span>
      ))}
    </div>
  );
}

/** Sprinkles drifting around the hero cake on the home page. */
export function HeroSprinkles() {
  // [left, top, kind, color, rotation, duration, delay]
  const bits: Array<[string, string, 'pill' | 'dot' | 'star', string, number, string, string]> = [
    ['-2%', '18%', 'pill', '#8c2246', 30, '6.5s', '0s'],
    ['6%', '62%', 'star', '#d4af37', 0, '5.2s', '0.8s'],
    ['3%', '88%', 'pill', '#e8b7c4', -40, '7s', '1.4s'],
    ['14%', '6%', 'dot', '#d4af37', 0, '5.6s', '0.3s'],
    ['92%', '10%', 'star', '#d4af37', 0, '6s', '0.5s'],
    ['97%', '42%', 'pill', '#c45a7a', 60, '6.8s', '1s'],
    ['88%', '78%', 'dot', '#8c2246', 0, '5.4s', '1.8s'],
    ['80%', '-2%', 'pill', '#f0c96a', -20, '7.4s', '2.1s'],
    ['24%', '96%', 'dot', '#e8b7c4', 0, '6.2s', '0.9s'],
    ['70%', '98%', 'star', '#e8b7c4', 0, '5.8s', '2.4s'],
  ];
  return (
    <div className="pointer-events-none absolute -inset-x-2 -inset-y-3 sm:-inset-x-8" aria-hidden="true">
      {bits.map(([left, top, kind, color, r, t, d], i) => (
        <span key={i} className="floaty absolute" style={{ left, top, ['--r' as string]: `${r}deg`, ['--t' as string]: t, ['--d' as string]: d }}>
          {kind === 'star' ? (
            <Sparkle size={18} color={color} />
          ) : (
            <span className="block rounded-full shadow-[0_1px_2px_rgb(36_26_23/0.15)]" style={{ background: color, width: kind === 'dot' ? 9 : 6, height: kind === 'dot' ? 9 : 18 }} />
          )}
        </span>
      ))}
    </div>
  );
}
