import { useCallback, useSyncExternalStore } from 'react';
import type { Reading } from '../ai/client';
import type { PhotoHints } from '../domain/photoHints';
import type { CakeLook, DesignTier, Handoff, Selection } from '../domain/types';

/**
 * The customer's in-progress request. Saved in sessionStorage so a refresh or a
 * quick switch to Messenger doesn't lose their answers. The inspo photo is NOT
 * saved (privacy); it stays in memory only.
 */

/** One page to fill in, then the "send it to the baker" screen. */
export const STEPS = ['order', 'done'] as const;
export type Step = (typeof STEPS)[number];

/** The open designer goes one step at a time: idea (photo + words), the 3D cake, then the price. */
export const STAGES = ['idea', 'cake', 'price'] as const;
export type Stage = (typeof STAGES)[number];

export interface Draft {
  step: Step;
  stage: Stage;
  occasion: string;
  eventDate: string;
  servings: number | null;
  budget: number | null;
  noBudget: boolean;
  description: string;
  /** A smart (AI) reading, kept only while the message it read is unchanged. */
  reading: Reading | null;
  /** The exact message `reading` was made from. */
  readingFor: string;
  /** True once the customer picks colors/words/candles by hand. */
  lookTouched: boolean;
  tier: DesignTier;
  selection: Selection | null;
  /** The cake as they last changed it in Customize; the suggested designs are built from it. */
  handPicked: Selection | null;
  look: CakeLook;
  name: string;
  contact: string;
  note: string;
  consent: boolean;
  sentId: string | null;
  sentLink: string | null;
  sentMessage: string | null;
  /** What the inspo photo showed (not the photo itself). */
  photoHints: PhotoHints | null;
  /** What they can't eat, as typed. null = not typed yet (we use what the description says). */
  allergies: string | null;
  /** Pickup or delivery (delivery fee paid by the customer), the time, and the delivery address. */
  handoff: Handoff;
  handoffTime: string;
  address: string;
}

export const EMPTY_DRAFT: Draft = {
  step: 'order',
  stage: 'idea',
  occasion: '',
  eventDate: '',
  servings: null,
  budget: null,
  noBudget: false,
  description: '',
  reading: null,
  readingFor: '',
  lookTouched: false,
  tier: 'classic',
  selection: null,
  handPicked: null,
  look: { colors: [], textOnCake: '', candles: 0 },
  name: '',
  contact: '',
  note: '',
  consent: false,
  sentId: null,
  sentLink: null,
  sentMessage: null,
  photoHints: null,
  allergies: null,
  handoff: 'pickup',
  handoffTime: '',
  address: '',
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
    // Drafts saved by the old step-by-step form: anything not sent is the one-page form now.
    if (!(STEPS as readonly string[]).includes(d.step)) d = { ...d, step: 'order' };
    if (!(STAGES as readonly string[]).includes(d.stage)) d = { ...d, stage: 'idea' };
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
