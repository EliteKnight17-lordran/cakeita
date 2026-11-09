import type { Reading } from '../ai/client';
import { buildDesigns, type DesignResult, type Wants } from '../domain/designs';
import { earliestDate } from '../domain/insights';
import { motifFor } from '../domain/motifs';
import { readRequest } from '../domain/requestReader';
import type { CakeLook, PublicMenu, Selection } from '../domain/types';
import type { Draft } from '../data/draft';
import { withPhoto } from '../domain/photoHints';

/**
 * The customer's cake as it stands right now, worked out from their draft.
 * Shared by the one-page order form and the "bakers near me" map so both
 * always show the same cake and the same price.
 */

export function wantsFrom(draft: Draft, reading: Reading | null = draft.reading): Wants {
  const r = reading;
  return {
    servings: draft.servings ?? r?.servings ?? null,
    budget: draft.noBudget ? null : draft.budget ?? r?.budget ?? null,
    tiers: r?.tiers ?? null,
    sizeIn: r?.sizeIn ?? null,
    flavorId: r?.flavorId ?? null,
    coveringId: r?.coveringId ?? null,
    componentIds: r?.componentIds ?? [],
    textOnCake: r?.textOnCake ?? '',
  };
}

export function lookFromReading(r: Reading | null, occasion: string): CakeLook {
  return {
    colors: (r?.colors ?? []).slice(0, 2).map((c) => c.hex),
    textOnCake: r?.textOnCake ?? '',
    candles: r?.age ? Math.min(10, r.age) : occasion === 'Birthday' ? 1 : 0,
    motif: motifFor(r?.theme ?? '', occasion),
  };
}

export function offlineReading(text: string, menu: PublicMenu): Reading {
  return { ...readRequest(text, menu), summary: '', usedAi: false, aiNote: '' };
}

export interface CurrentCake {
  reading: Reading;
  hasText: boolean;
  occasion: string;
  eventDate: string;
  minDate: string;
  wants: Wants;
  look: CakeLook;
  designs: DesignResult;
  selection: Selection | null;
  isCustom: boolean;
}

export function currentCake(menu: PublicMenu, draft: Draft, today: Date, live?: Reading): CurrentCake {
  const minDate = earliestDate(menu.leadTimeDays, today);
  const liveReading = live ?? offlineReading(draft.description, menu);
  // A smart (AI) reading is used only while the message it read hasn't changed.
  const typed = draft.reading && draft.readingFor === draft.description ? draft.reading : liveReading;
  // The inspo photo adds what it shows (tiers, decorations, colors); what they typed wins.
  const hints = draft.photoHints ?? null;
  const reading = withPhoto(typed, hints, menu);
  const hasText = draft.description.trim().length > 0 || !!hints;
  // What the customer picked by hand wins; otherwise use what we read from their message.
  const occasion = draft.occasion || (hasText ? reading.occasion : '');
  const readDate = reading.eventDate && reading.eventDate >= minDate ? reading.eventDate : '';
  const eventDate = draft.eventDate || readDate;
  const wants = wantsFrom(draft, hasText || draft.reading ? reading : null);
  // Placement and things the customer brings are always their own choice, even when colors follow the message.
  const keep = { flowerStyle: draft.look.flowerStyle ?? hints?.flowerStyle ?? undefined, topperSpot: draft.look.topperSpot ?? hints?.topperSpot ?? undefined, own: draft.look.own };
  const look = draft.lookTouched ? draft.look : { ...lookFromReading(hasText ? reading : null, occasion), ...keep };
  const designs = buildDesigns(menu, wants);
  // Default pick: the tier they chose; if that tier isn't offered, the fullest design that still fits the budget.
  const fallback = [...designs.options].reverse().find((o) => !o.overBudget) ?? designs.options[0];
  const selection = draft.selection ?? designs.options.find((o) => o.tier === draft.tier)?.selection ?? fallback?.selection ?? null;
  const isCustom = !!draft.selection && designs.options.every((o) => JSON.stringify(o.selection) !== JSON.stringify(draft.selection));
  return { reading, hasText, occasion, eventDate, minDate, wants, look, designs, selection, isCustom };
}
