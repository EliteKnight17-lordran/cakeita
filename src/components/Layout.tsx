import { useRef, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { setPrefs, usePrefs, useTx } from '../lib/prefs';
import { DevPanel } from './DevPanel';

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#8c2246" />
        <g fill="none" stroke="#f8f4ef" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="7.5" y="17" width="17" height="8" rx="1.5" />
          <rect x="10.5" y="11.5" width="11" height="5.5" rx="1.2" />
          <path d="M16 7.5v4" strokeLinecap="round" />
        </g>
        <circle cx="16" cy="6.2" r="1.4" fill="#e6c27a" />
      </svg>
      <span className="font-display text-[1.45rem] font-semibold tracking-tight text-ink">Cakeita</span>
    </span>
  );
}

export function Layout({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const prefs = usePrefs();
  const tx = useTx();
  const taps = useRef<number[]>([]);

  // Hidden way to open the developer panel on a phone: tap the logo 5 times quickly.
  const onLogoTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setPrefs({ dev: !prefs.dev });
    }
  };

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">
        {tx('Skip to content', 'Lumaktaw sa nilalaman')}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-[#fffdfa]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link to="/" onClick={onLogoTap} aria-label="Cakeita home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPrefs({ lang: prefs.lang === 'tl' ? 'en' : 'tl' })}
              aria-label={prefs.lang === 'tl' ? 'Switch to English' : 'Lumipat sa Taglish'}
            >
              {prefs.lang === 'tl' ? 'EN' : 'TL'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              aria-pressed={prefs.big}
              onClick={() => setPrefs({ big: !prefs.big })}
              aria-label={tx('Bigger text', 'Mas malaking letra')}
              title={tx('Bigger text', 'Mas malaking letra')}
            >
              <span aria-hidden="true" className="font-bold">
                A<span className="text-lg">A</span>
              </span>
            </button>
          </div>
        </div>
        {nav && <nav className="mx-auto max-w-3xl px-2 pb-2">{nav}</nav>}
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pt-8">
        {children}
      </main>
      <footer className="no-print mx-auto max-w-3xl px-4 pb-24 text-center text-sm text-ink-soft">
        <p>
          {tx('Cakeita never handles payments. Pay your baker directly.', 'Hindi humahawak ng bayad ang Cakeita. Sa baker ka mismo magbabayad.')}{' '}
          <Link to="/about" className="underline">
            {tx('About and privacy', 'Tungkol at privacy')}
          </Link>
        </p>
      </footer>
      {prefs.dev && <DevPanel />}
    </div>
  );
}

export function TabNav({ tabs }: { tabs: Array<{ to: string; label: string; badge?: number }> }) {
  return (
    <ul className="flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <li key={t.to}>
          <NavLink
            to={t.to}
            end
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-[#f1ebe4]'}`
            }
          >
            {t.label}
            {!!t.badge && <span className="rounded-full bg-amber-bg px-2 text-xs text-amber-ink">{t.badge}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
