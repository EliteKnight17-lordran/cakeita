import type { Ingredient } from './types';

/**
 * Reads quick price updates typed or spoken by the baker, e.g.
 *   "butter 520 per kilo, itlog 9.50 each, cream 62 per 250ml, eggs 270 per tray"
 * Units are converted in code. Nothing is saved until the baker confirms.
 */

export interface PriceChange {
  ingredientId: string;
  name: string;
  oldCost: number;
  newCost: number;
  /** Human explanation, e.g. "₱520 per kg = ₱0.52 per g". */
  how: string;
  /** Set when the baker must double-check (unclear unit, big jump). */
  warning: string;
  raw: string;
}

export interface PriceUpdateResult {
  changes: PriceChange[];
  unknown: string[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findIngredient(segment: string, ingredients: Ingredient[]): Ingredient | null {
  const s = segment.toLowerCase();
  let best: { ing: Ingredient; len: number } | null = null;
  for (const ing of ingredients) {
    for (const word of [ing.name, ...(ing.aliases ?? [])]) {
      const w = word.toLowerCase();
      if (new RegExp(`(^|[^a-z])${escapeRe(w)}(?=$|[^a-z])`).test(s) && (!best || w.length > best.len)) best = { ing, len: w.length };
    }
  }
  return best?.ing ?? null;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function parsePriceUpdate(text: string, ingredients: Ingredient[]): PriceUpdateResult {
  const segments = text
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .split(/[\n;,]+|\s+(?:at|and|tapos)\s+(?=[a-z])/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const changes: PriceChange[] = [];
  const unknown: string[] = [];

  for (const seg of segments) {
    const ing = findIngredient(seg, ingredients);
    const norm = seg.replace(/(\d),(\d{3})/g, '$1$2');
    const priceM = /(?:₱|php|p)?\s*(\d+(?:[.,]\d+)?)/i.exec(norm);
    if (!ing || !priceM) {
      unknown.push(seg);
      continue;
    }
    const price = Number(priceM[1]!.replace(',', '.'));
    const rest = norm.slice((priceM.index ?? 0) + priceM[0].length).toLowerCase();
    let per = 1;
    let how = '';
    let warning = '';
    const pack = /(\d+(?:\.\d+)?)\s*(g|grams?|gramo|ml|mL|pcs?|pieces?|piraso|kg|kilos?|l|liters?|litro)\b/i.exec(rest);
    if (pack) {
      const n = Number(pack[1]);
      const u = pack[2]!.toLowerCase();
      if (/^(kg|kilos?)$/.test(u)) per = n * 1000;
      else if (/^(l|liters?|litro)$/.test(u)) per = n * 1000;
      else per = n;
      how = `₱${price} per ${pack[1]} ${pack[2]}`;
    } else if (/\b(kilo|kilos|kg|k)\b/.test(rest)) {
      per = 1000;
      how = `₱${price} per kg`;
    } else if (/\b(liter|litro|l)\b/.test(rest)) {
      per = 1000;
      how = `₱${price} per liter`;
    } else if (/\b(dozen|dosena)\b/.test(rest)) {
      per = 12;
      how = `₱${price} per dozen`;
    } else if (/\btray\b/.test(rest)) {
      per = 30;
      how = `₱${price} per tray of 30`;
    } else if (/\b(each|pc|piece|piraso|isa|per pc|apiece)\b/.test(rest)) {
      per = 1;
      how = `₱${price} each`;
    } else if (/\b(gram|grams|g|ml)\b/.test(rest)) {
      per = 1;
      how = `₱${price} per ${ing.unit}`;
    } else {
      // No unit given. Use the most common way it's sold, and ask the baker to check.
      per = ing.unit === 'pc' ? 1 : 1000;
      how = ing.unit === 'pc' ? `₱${price} each` : `₱${price} per ${ing.unit === 'g' ? 'kg' : 'liter'}`;
      warning = ing.unit === 'pc' ? 'Each ba ito?' : `Per ${ing.unit === 'g' ? 'kilo' : 'liter'} ba ito? Pakicheck.`;
    }
    if (ing.unit === 'pc' && per >= 1000) warning = 'This ingredient is counted per piece. Pakicheck ang unit.';
    const newCost = round4(price / per);
    if (!warning && ing.costPerUnit > 0 && (newCost > ing.costPerUnit * 3 || newCost < ing.costPerUnit / 3)) {
      warning = 'Malaki ang pagbabago. Tama ba?';
    }
    const unitWord = ing.unit === 'pc' ? 'piece' : ing.unit;
    changes.push({
      ingredientId: ing.id,
      name: ing.name,
      oldCost: ing.costPerUnit,
      newCost,
      how: `${how} = ₱${newCost} per ${unitWord}`,
      warning,
      raw: seg,
    });
  }
  return { changes, unknown };
}
