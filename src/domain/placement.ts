import type { FlowerStyle, OwnItem } from './types';

/** Labels for placement presets and things the customer brings (English, Taglish). */
export const FLOWER_LABELS: Record<FlowerStyle, [string, string]> = {
  side: ['On one side', 'Sa gilid'],
  cascade: ['Cascade down', 'Pababa sa gilid'],
  crown: ['Crown on top', 'Korona sa ibabaw'],
  scatter: ['Scattered', 'Nakakalat'],
};
export const OWN_LABELS: Record<OwnItem, [string, string]> = {
  topper: ['My own topper', 'Sariling topper ko'],
  figurine: ['My own figurine or toy', 'Sariling figurine o laruan ko'],
  stand: ['My own cake stand', 'Sariling cake stand ko'],
};

/** "I will bring my own topper and cake stand" in the customer's language. */
export function ownText(own: OwnItem[] | undefined, lang: 'tl' | 'en'): string {
  if (!own?.length) return '';
  const names = own.map((o) => OWN_LABELS[o][lang === 'en' ? 0 : 1].replace(/^(My own|Sariling) /, '').replace(/ ko$/, ''));
  return lang === 'en' ? `I will bring my own ${names.join(' and ')}.` : `Magdadala ako ng sariling ${names.join(' at ')}.`;
}
