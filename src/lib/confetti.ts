/**
 * A tiny confetti burst for happy moments (quote approved, cake confirmed).
 * Pure DOM, no library, decorative only (aria-hidden), skipped for reduced motion.
 */
const COLORS = ['#f08db0', '#b3164f', '#f5c76a', '#8cc7ef', '#9ed8ab', '#c7a3e8', '#ffd6e4'];

export function popConfetti(pieces = 60) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement('i');
    const round = i % 4 === 0;
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = COLORS[i % COLORS.length]!;
    if (round) {
      p.style.width = p.style.height = '10px';
      p.style.borderRadius = '50%';
    }
    p.style.animationDelay = `${Math.random() * 0.35}s`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
    box.appendChild(p);
  }
  document.body.appendChild(box);
  window.setTimeout(() => box.remove(), 2600);
}
