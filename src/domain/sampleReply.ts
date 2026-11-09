import { addDays } from './insights';
import { roundUpTo50, formatPeso } from './money';
import { priceSelection } from './pricing';
import type { Bakery, CakeRequest } from './types';

/**
 * How the SAMPLE bakeries answer, so a demo customer can try the whole back-and-forth
 * without a real baker. Plain rules, no AI. Every price comes from the bakery's own
 * costs through pricing.ts; the "lowest price" keeps a margin and is never below cost.
 * Real bakers always answer by hand.
 */

export type SampleReply =
  | { kind: 'declined'; reason: string }
  | { kind: 'quote'; price: number; note: string };

/** Lowest price a sample baker will take for this cake: still a margin, never a loss. */
export function floorPrice(bakery: Bakery, cost: number): number {
  const minMargin = Math.max(10, bakery.targetMarginPct - 12) / 100;
  return Math.max(bakery.minOrderPrice, roundUpTo50(cost / (1 - minMargin)));
}

export function sampleBakerReply(bakery: Bakery, req: CakeRequest): SampleReply {
  const t = (en: string, tl: string) => (req.lang === 'en' ? en : tl);
  if (req.eventDate < addDays(req.createdAt, bakery.leadTimeDays)) {
    return { kind: 'declined', reason: t(`We need ${bakery.leadTimeDays} days' notice, so ${req.eventDate} is too soon for us.`, `Kailangan namin ng ${bakery.leadTimeDays} araw na abiso, kaya masyadong maaga ang ${req.eventDate}.`) };
  }
  if (bakery.fullDates?.includes(req.eventDate)) {
    return { kind: 'declined', reason: t(`We're fully booked on ${req.eventDate}.`, `Puno na kami sa ${req.eventDate}.`) };
  }
  const q = priceSelection(bakery, req.selection);
  if (!q || q.suggestedPrice <= 0) {
    return { kind: 'declined', reason: t("We don't make this size or design.", 'Hindi namin ginagawa ang ganitong laki o design.') };
  }
  const price = q.suggestedPrice;
  if (req.budget == null || price <= req.budget) {
    return { kind: 'quote', price, note: t('Thank you! We can bake this for you.', 'Salamat po! Kaya naming i-bake ito para sa inyo.') };
  }
  const floor = floorPrice(bakery, q.costTotal);
  const counter = Math.max(floor, Math.floor(req.budget / 50) * 50);
  if (counter >= price) {
    return { kind: 'quote', price, note: t(`This design is ${formatPeso(price)} with us. A simpler design would fit ${formatPeso(req.budget)}.`, `${formatPeso(price)} po ang design na ito sa amin. Mas simpleng design ang papasok sa ${formatPeso(req.budget)}.`) };
  }
  return counter <= req.budget
    ? { kind: 'quote', price: counter, note: t(`We can do it for ${formatPeso(counter)} to fit your budget.`, `Kaya namin sa ${formatPeso(counter)} para pumasok sa budget mo.`) }
    : { kind: 'quote', price: counter, note: t(`Our best price for this cake is ${formatPeso(counter)}.`, `${formatPeso(counter)} po ang pinakamababa namin para sa cake na ito.`) };
}

/** A sample baker takes the customer's offer if it still leaves their minimum margin. */
export function sampleOfferAnswer(bakery: Bakery, req: CakeRequest, offerPrice: number): boolean {
  const q = priceSelection(bakery, req.selection);
  if (!q) return false;
  return offerPrice >= floorPrice(bakery, q.costTotal);
}
