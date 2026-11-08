import { useEffect, useState, type RefObject } from 'react';
import { Cake2D } from '../cake/Cake2D';
import { IconArrow } from '../components/icons';
import type { CakeVisual } from '../domain/visual';
import { useTx } from '../lib/prefs';

/**
 * Phones: once the big 3D cake scrolls off the top, a small live cake floats above the price bar.
 * Tap it to enlarge, then "See it in 3D" jumps back up to the big cake.
 */
export function MiniCake({ target, visual, description, price }: { target: RefObject<HTMLElement | null>; visual: CakeVisual; description: string; price: string | null }) {
  const tx = useTx();
  const [past, setPast] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reads the ref on every check, so it keeps working if the big cake re-mounts.
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = target.current;
      // Only after scrolling past the cake, not before reaching it.
      const gone = !!el && el.getBoundingClientRect().bottom < 0;
      // Keep the open/closed choice: a resize (rotating the phone) must not close it.
      setPast(gone);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!past) return null;

  const backTo3D = () => {
    setOpen(false);
    target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!open) {
    return (
      <button
        type="button"
        data-testid="mini-cake"
        onClick={() => setOpen(true)}
        aria-label={tx('Show my cake', 'Ipakita ang cake ko')}
        className="no-print fixed bottom-24 right-3 z-30 flex flex-col items-center rounded-2xl border border-line bg-white p-1.5 shadow-[0_10px_28px_-12px_rgb(36_26_23/0.5)] transition hover:border-[#cdbdb0]"
      >
        <Cake2D visual={visual} title={description} className="h-16 w-16" />
        <span className="px-1 pb-0.5 text-[0.7rem] font-semibold text-ink-soft">{tx('My cake', 'Cake ko')}</span>
      </button>
    );
  }

  return (
    <div role="dialog" aria-label={tx('Your cake', 'Ang cake mo')} data-testid="mini-cake-open" className="no-print fixed inset-x-3 bottom-24 z-30 rounded-2xl border border-line bg-white p-4 shadow-[0_18px_40px_-16px_rgb(36_26_23/0.55)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{tx('Your cake so far', 'Ang cake mo ngayon')}</p>
          {price && <p className="price text-2xl">{price}</p>}
        </div>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          {tx('Minimize', 'Paliitin')}
        </button>
      </div>
      <Cake2D visual={visual} title={description} className="mx-auto my-2 h-48 w-full max-w-xs rounded-xl bg-[#faf6f1]" />
      <p className="text-sm text-ink-soft">{description}</p>
      <button type="button" className="btn-secondary mt-3 w-full" onClick={backTo3D}>
        {tx('See it in 3D', 'Tingnan sa 3D')} <IconArrow className="-rotate-90" />
      </button>
    </div>
  );
}
