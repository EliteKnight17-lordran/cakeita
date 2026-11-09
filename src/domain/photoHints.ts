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
  /** Age shown in the photo (e.g. a number topper); what the customer types wins. */
  age?: number | null;
  /** About how many people the cake in the photo feeds; what the customer types or picks wins. */
  servings?: number | null;
  /** Set when the photo is a known featured design (see showcase.ts). */
  showcase?: string;
}

export const ordinal = (n: number): string => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
};

/** The photo's message ("Happy 11th Birthday") with the customer's own age, when they typed one. */
export function photoText(hints: PhotoHints, typedAge: number | null): string {
  const text = hints.textOnCake ?? '';
  if (!text || !hints.age || !typedAge || typedAge === hints.age) return text;
  return text.replace(ordinal(hints.age), ordinal(typedAge));
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
    textOnCake: reading.textOnCake || photoText(hints, reading.age).slice(0, 40),
    age: reading.age ?? hints.age ?? null,
    servings: reading.servings ?? hints.servings ?? null,
    licensedNote: reading.licensedNote || hints.licensedNote,
    unavailable: [...new Set([...reading.unavailable, ...hints.unavailable])].slice(0, 10),
  };
}
