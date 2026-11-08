/**
 * A short burst of sprinkles and gold sparkles for happy moments (request sent, quote approved,
 * cake confirmed). Pure DOM + Web Animations, no library. Decorative only: aria-hidden, and
 * skipped entirely for people who turn on "reduce motion".
 */
const COLORS = ['#8c2246', '#d4af37', '#e8b7c4', '#f3e3c3', '#c45a7a', '#fffdfa', '#b8901c'];

export function celebrate(from?: Element | null, pieces = 72): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'celebrate';
  box.setAttribute('aria-hidden', 'true');
  const r = from?.getBoundingClientRect();
  const ox = r && r.width ? r.left + r.width / 2 : window.innerWidth / 2;
  const oy = r && r.height ? r.top + r.height / 2 : window.innerHeight * 0.4;
  const spread = Math.min(window.innerWidth, 900);
  for (let i = 0; i < pieces; i++) {
    const el = document.createElement('i');
    const kind = i % 6 === 0 ? 'star' : i % 4 === 0 ? 'dot' : 'pill';
    const w = kind === 'star' ? 12 + Math.random() * 8 : kind === 'dot' ? 7 : 4;
    const h = kind === 'star' ? w : kind === 'dot' ? 7 : 11 + Math.random() * 5;
    el.className = kind;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.left = `${ox - w / 2}px`;
    el.style.top = `${oy - h / 2}px`;
    el.style.background = kind === 'star' ? (i % 12 === 0 ? '#fffdfa' : '#d4af37') : COLORS[i % COLORS.length]!;
    if (kind !== 'star') el.style.boxShadow = '0 0 0 0.5px rgb(36 26 23 / 0.12)';
    box.appendChild(el);
    // Up and out first, then drift down with a little spin.
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
    const v = (0.18 + Math.random() * 0.32) * spread;
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v * 0.8;
    const fall = 260 + Math.random() * 320;
    const spin = (Math.random() - 0.5) * 1080;
    el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg) scale(0.4)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 3}deg) scale(1)`, opacity: 1, offset: 0.32 },
        { transform: `translate(${dx * 1.3}px, ${dy + fall}px) rotate(${spin}deg) scale(0.85)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 900, easing: 'cubic-bezier(0.18, 0.7, 0.3, 1)', fill: 'forwards', delay: Math.random() * 120 },
    );
  }
  document.body.appendChild(box);
  window.setTimeout(() => box.remove(), 2800);
}
