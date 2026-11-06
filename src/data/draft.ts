import { useCallback, useSyncExternalStore } from 'react';
import type { Reading } from '../ai/client';
import type { CakeLook, DesignTier, Selection } from '../domain/types';

/**
 * The customer's in-progress request. Saved in sessionStorage so a refresh or a
 * quick switch to Messenger doesn't lose their answers. The inspo photo is NOT
 * saved (privacy); it stays in memory only.
 */

export const STEPS = ['welcome', 'occasion', 'date', 'servings', 'budget', 'describe', 'designs', 'customize', 'contact', 'done'] as const;
export type Step = (typeof STEPS)[number];

export interface Draft {
  step: Step;
  occasion: string;
  eventDate: string;
  servings: number | null;
  budget: number | null;
  noBudget: boolean;
  description: string;
  reading: Reading | null;
  tier: DesignTier;
  selection: Selection | null;
  look: CakeLook;
  name: string;
  contact: string;
  note: string;
  consent: boolean;
  sentId: string | null;
  sentLink: string | null;
  sentMessage: string | null;
}

export const EMPTY_DRAFT: Draft = {
  step: 'welcome',
  occasion: '',
  eventDate: '',
  servings: null,
  budget: null,
  noBudget: false,
  description: '',
  reading: null,
  tier: 'classic',
  selection: null,
  look: { colors: [], textOnCake: '', candles: 0 },
  name: '',
  contact: '',
  note: '',
  consent: false,
  sentId: null,
  sentLink: null,
  sentMessage: null,
};

const key = (slug: string) => `cakeita.draft.${slug}`;
const listeners = new Set<() => void>();
const cache = new Map<string, Draft>();

function load(slug: string): Draft {
  if (cache.has(slug)) return cache.get(slug)!;
  let d = EMPTY_DRAFT;
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (raw) d = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    /* ignore */
  }
  cache.set(slug, d);
  return d;
}

export function writeDraft(slug: string, d: Draft) {
  cache.set(slug, d);
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(d));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function clearDraft(slug: string) {
  writeDraft(slug, EMPTY_DRAFT);
}

export function useDraft(slug: string): [Draft, (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void] {
  const draft = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(slug),
    () => EMPTY_DRAFT,
  );
  const update = useCallback(
    (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
      const cur = load(slug);
      writeDraft(slug, { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) });
    },
    [slug],
  );
  return [draft, update];
}
