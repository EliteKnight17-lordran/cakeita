import type { ColorHit, ParsedRequest } from './requestReader';
import type { FlowerStyle, PublicMenu, TopperSpot } from './types';

/**
 * What we learned from the customer's inspo photo, kept apart from what they typed,
 * so it survives when they keep typing. The photo itself is never saved, only these hints.
 * Every id is checked against the menu; prices still come only from the menu.
 */
export interface PhotoHints {
  colors: ColorHit[];
  componentIds: string[];
  flavorId: string | null;
  coveringId: string | null;
  tiers: number | null;
  theme: string;
  /** Words written on the cake in the photo. */
  textOnCake?: string;
  licensedNote: string;
  unavailable: string[];
  flowerStyle: FlowerStyle | null;
  topperSpot: TopperSpot | null;
  summary: string;
  /** true: AI looked at the photo. false: only its colors were read on the phone. */
  usedAi: boolean;
}

/** Add the photo's hints to a reading. What the customer typed always wins. */
export function withPhoto<R extends ParsedRequest>(reading: R, hints: PhotoHints | null | undefined, menu: PublicMenu): R {
  if (!hints) return reading;
  const ids = new Set(menu.components.map((c) => c.id));
  const cat = (id: string) => menu.components.find((c) => c.id === id)?.category;
  const extra = hints.componentIds.filter((id) => ids.has(id) && cat(id) !== 'flavor' && cat(id) !== 'covering' && !reading.componentIds.includes(id));
  return {
    ...reading,
    colors: reading.colors.length ? reading.colors : hints.colors.slice(0, 2),
    componentIds: [...reading.componentIds, ...extra],
    flavorId: reading.flavorId ?? (hints.flavorId && cat(hints.flavorId) === 'flavor' ? hints.flavorId : null),
    coveringId: reading.coveringId ?? (hints.coveringId && cat(hints.coveringId) === 'covering' ? hints.coveringId : null),
    tiers: reading.tiers ?? hints.tiers,
    theme: reading.theme || hints.theme,
    textOnCake: reading.textOnCake || (hints.textOnCake ?? '').slice(0, 40),
    licensedNote: reading.licensedNote || hints.licensedNote,
    unavailable: [...new Set([...reading.unavailable, ...hints.unavailable])].slice(0, 10),
  };
}
