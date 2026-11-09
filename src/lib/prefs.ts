import { useCallback, useSyncExternalStore } from 'react';

/** Per-device display preferences. Stored in localStorage; safe if storage is blocked. */
export interface Prefs {
  lang: 'tl' | 'en';
  /** Elder-friendly mode: bigger text, bigger buttons, stronger contrast. */
  big: boolean;
  /** Developer panel for quick testing. */
  dev: boolean;
  /** Dev: always draw the 2D cake (simulates phones without WebGL). */
  force2D: boolean;
  /** Dev: never call the AI route (simulates no internet / no key). */
  aiOff: boolean;
}

const KEY = 'cakeita.prefs.v1';
const DEFAULTS: Prefs = { lang: 'tl', big: false, dev: false, force2D: false, aiOff: false };

/** What this device saved, or {} when nothing is saved or storage is blocked. */
function saved(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? (v as Partial<Prefs>) : {};
  } catch {
    return {};
  }
}

function load(): Prefs {
  return { ...DEFAULTS, ...saved() };
}

let state: Prefs = typeof window === 'undefined' ? DEFAULTS : load();
const listeners = new Set<() => void>();

function apply(p: Prefs) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = p.lang === 'tl' ? 'fil' : 'en';
  document.documentElement.dataset.big = p.big ? 'true' : 'false';
}
apply(state);

export function getPrefs(): Prefs {
  return state;
}

function notify() {
  apply(state);
  listeners.forEach((l) => l());
}

/**
 * Another tab (a Messenger link, "open like a customer") changed the prefs.
 * Pick them up right away so a stale tab never writes the old language back.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return;
    state = { ...state, ...saved() };
    notify();
  });
  // Coming back to a tab (or a phone's in-app browser) re-reads the saved choice.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const fresh = { ...state, ...saved() };
    if (JSON.stringify(fresh) !== JSON.stringify(state)) {
      state = fresh;
      notify();
    }
  });
}

export function setPrefs(patch: Partial<Prefs>) {
  // Merge over what is saved now, not what this tab loaded earlier.
  state = { ...state, ...saved(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory */
  }
  notify();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => DEFAULTS,
  );
}

/** Inline bilingual text: tx('Next', 'Sunod'). Taglish is the default. Stable while the language stays the same, so it is safe in effect deps. */
export function useTx() {
  const { lang } = usePrefs();
  return useCallback((en: string, tl: string) => (lang === 'tl' ? tl : en), [lang]);
}
