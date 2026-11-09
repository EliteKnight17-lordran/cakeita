import { SurveyStrip, SurveyTimedPrompt } from './SurveyFinish';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import { IconMenu, IconUser } from './icons';
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
      <span className="logo-word font-display text-[1.45rem] font-semibold tracking-tight text-ink">Cakeita</span>
    </span>
  );
}

/** wide = two-column pages (order form) get more room on laptops. */
export function Layout({ children, nav, wide = false }: { children: ReactNode; nav?: ReactNode; wide?: boolean }) {
  const w = wide ? 'max-w-3xl lg:max-w-6xl' : 'max-w-3xl';
  const prefs = usePrefs();
  const tx = useTx();
  const taps = useRef<number[]>([]);
  const account = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenuOpen(false), [loc.pathname]);
  const links = [
    { to: '/near', label: tx('Find bakers', 'Maghanap ng baker') },
    { to: '/me', label: tx('My cakes', 'Mga cake ko') },
    { to: '/baker', label: tx('For bakers', 'Para sa baker') },
    { to: '/demo', label: 'Demo' },
    { to: '/feedback', label: tx('Feedback', 'Feedback') },
  ];
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-[0.95rem] font-medium ${isActive ? 'text-berry' : 'text-ink hover:text-berry'}`;
  const user = account.status === 'signed-in' ? account.user : null;

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
    <div className="relative isolate min-h-dvh">
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">
        {tx('Skip to content', 'Lumaktaw sa nilalaman')}
      </a>
      <header className="scallop sticky top-0 z-30 bg-[#fffdfa]">
        {/* The header keeps one width on every page, so it doesn't jump when the page width changes. */}
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2 lg:max-w-6xl">
          <Link to="/" onClick={onLogoTap} aria-label="Cakeita home">
            <Logo />
          </Link>
          <nav aria-label={tx('Main', 'Pangunahing menu')} className="hidden items-center lg:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === '/baker' ? false : true}>
                {l.label}
              </NavLink>
            ))}
          </nav>
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
            {account.status !== 'off' && (
              <Link to="/account" className="btn-ghost !px-2" aria-label={user ? tx(`Account: ${user.name || user.email}`, `Account: ${user.name || user.email}`) : tx('Sign in', 'Mag-sign in')}>
                {user?.photo ? <img src={user.photo} alt="" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" /> : <IconUser />}
                <span className="hidden whitespace-nowrap text-sm sm:inline">{user ? tx('Account', 'Account') : tx('Sign in', 'Sign in')}</span>
              </Link>
            )}
            <button type="button" className="btn-ghost lg:hidden" aria-expanded={menuOpen} aria-controls="main-menu" aria-label={tx('Menu', 'Menu')} onClick={() => setMenuOpen((o) => !o)}>
              <IconMenu />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="main-menu" aria-label={tx('Main', 'Pangunahing menu')} className={`mx-auto ${w} px-2 pb-3 lg:hidden`}>
            <ul className="grid grid-cols-2 gap-1">
              {links.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} className={linkClass} end={l.to !== '/baker'}>
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {nav && <nav className="mx-auto max-w-3xl px-2 pb-2">{nav}</nav>}
        <SurveyStrip />
      </header>
      <main id="main" className={`page-in mx-auto ${w} px-4 pb-28 pt-7 sm:pt-9`}>
        {children}
      </main>
      <footer className="no-print mx-auto max-w-3xl space-y-2 px-4 pb-24 text-center text-sm text-ink-soft">
        <p>{tx('Cakeita never handles payments. Pay your baker directly.', 'Hindi humahawak ng bayad ang Cakeita. Sa baker ka mismo magbabayad.')}</p>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to={`/feedback?from=${encodeURIComponent(loc.pathname)}`} className="inline-flex min-h-11 items-center underline" data-footer-feedback>
            {tx('Feedback and help', 'Feedback at tulong')}
          </Link>
          <Link to="/about" className="inline-flex min-h-11 items-center underline">
            {tx('About', 'Tungkol')}
          </Link>
          <a href="./privacy.html" className="inline-flex min-h-11 items-center underline">
            {tx('Privacy', 'Privacy')}
          </a>
          <a href="./terms.html" className="inline-flex min-h-11 items-center underline">
            {tx('Terms', 'Terms')}
          </a>
        </p>
      </footer>
      <SurveyTimedPrompt />
      {prefs.dev && <DevPanel />}
    </div>
  );
}

export function TabNav({ tabs }: { tabs: Array<{ to: string; label: string; badge?: number }> }) {
  // On a phone the last tabs sit past the right edge: bring the open one into view.
  const list = useRef<HTMLUListElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const ul = list.current;
    const on = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!ul || !on) return;
    const r = on.getBoundingClientRect();
    const u = ul.getBoundingClientRect();
    if (r.left < u.left || r.right > u.right) ul.scrollLeft += r.left - u.left - (u.width - r.width) / 2;
  }, [pathname]);
  return (
    <ul ref={list} className="flex gap-1 overflow-x-auto">
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

/** After part 1 of the pilot survey, a small reminder to come back for part 2. */
