import { addThemeTopper, COLOR_WORDS, findTrademark, type ColorHit, type ParsedRequest } from '../domain/requestReader';
import type { AiReading } from '../domain/schemas';
import type { FlowerStyle, PublicMenu, TopperSpot } from '../domain/types';

/**
 * Combine an AI reading with the rule-based reading.
 * - Unknown IDs from the AI are dropped (and reported), never trusted.
 * - Numbers the customer typed (budget, servings) come from the rule-based reader
 *   when it found them, because regexes don't hallucinate.
 */
export function mergeReading(rule: ParsedRequest, ai: AiReading, menu: PublicMenu): ParsedRequest & { droppedIds: string[]; summary: string; flowerStyle: FlowerStyle | null; topperSpot: TopperSpot | null } {
  const byId = new Map(menu.components.map((c) => [c.id, c]));
  const droppedIds: string[] = [];
  const okId = (idv: string | null | undefined, cat?: string) => {
    if (!idv) return null;
    const c = byId.get(idv);
    if (!c || (cat && c.category !== cat)) {
      droppedIds.push(idv);
      return null;
    }
    return c.id;
  };
  const flavorId = rule.flavorId ?? okId(ai.flavorId, 'flavor');
  const coveringId = rule.coveringId ?? okId(ai.coveringId, 'covering');
  const aiParts = ai.componentIds.map((x) => okId(x)).filter((x): x is string => !!x);
  const componentIds = [...rule.componentIds];
  for (const p of aiParts) {
    const cat = byId.get(p)?.category;
    if (cat !== 'flavor' && cat !== 'covering' && !componentIds.includes(p)) componentIds.push(p);
  }

  const colors: ColorHit[] = [...rule.colors];
  for (const name of ai.colors) {
    const row = COLOR_WORDS.find(([words, n]) => n === name.toLowerCase() || words.includes(name.toLowerCase()));
    if (row && !colors.some((c) => c.name === row[1])) colors.push({ name: row[1], hex: row[2] });
  }

  let theme = rule.theme || ai.theme;
  let licensedNote = rule.licensedNote;
  const tm = findTrademark(`${ai.theme} ${ai.summaryTaglish}`);
  if (tm) {
    theme = tm.theme;
    licensedNote ||= `Inspo shows a licensed character. Use a licensed topper or toy; keep the cake design generic.`;
  }
  const baseTiers = ai.baseCakeId ? menu.baseCakes.find((b) => b.id === ai.baseCakeId)?.tiers.length ?? null : null;
  const unavailable = [...new Set([...rule.unavailable, ...ai.detectedButUnavailable.map((s) => s.trim()).filter(Boolean)])].slice(0, 10);

  return {
    ...rule,
    occasion: rule.occasion || ai.occasion,
    servings: rule.servings ?? ai.servings ?? null,
    budget: rule.budget ?? ai.budget ?? null,
    tiers: rule.tiers ?? ai.tiers ?? baseTiers,
    textOnCake: rule.textOnCake || ai.textOnCake,
    flavorId,
    coveringId,
    componentIds: addThemeTopper(componentIds, theme, menu),
    colors: colors.slice(0, 4),
    theme,
    licensedNote,
    unavailable,
    confidence: Math.max(rule.confidence, Math.min(0.95, ai.confidence)),
    droppedIds,
    summary: tm ? '' : ai.summaryTaglish,
    flowerStyle: ai.flowerStyle ?? null,
    topperSpot: ai.topperSpot ?? null,
  };
}
