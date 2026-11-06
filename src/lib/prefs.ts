import { useSyncExternalStore } from 'react';

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

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
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

export function setPrefs(patch: Partial<Prefs>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory */
  }
  apply(state);
  listeners.forEach((l) => l());
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

/** Inline bilingual text: tx('Next', 'Sunod'). Taglish is the default. */
export function useTx() {
  const { lang } = usePrefs();
  return (en: string, tl: string) => (lang === 'tl' ? tl : en);
}
