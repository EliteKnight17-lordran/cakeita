import { MOTIFS } from '../domain/motifs';
import type { CakeVisual } from '../domain/visual';

const COVERING_NAME: Record<string, [string, string]> = {
  buttercream: ['buttercream', 'buttercream'],
  whipped: ['whipped cream', 'whipped cream'],
  fondant: ['fondant', 'fondant'],
  ganache: ['chocolate ganache', 'chocolate ganache'],
  naked: ['semi-naked', 'semi-naked'],
};

/** Plain-language description for screen readers and captions. */
export function describeCake(v: CakeVisual, lang: 'tl' | 'en', colorNames: string[] = []): string {
  const tl = lang === 'tl';
  const tiers = v.tiers.length === 1 ? (tl ? '1 tier' : 'one-tier') : `${v.tiers.length}-tier`;
  const cov = COVERING_NAME[v.covering]?.[tl ? 1 : 0] ?? v.covering;
  const color = colorNames.length ? `${colorNames.join(tl ? ' at ' : ' and ')} ` : '';
  const extras: string[] = [];
  if (v.drip) extras.push(tl ? 'drip' : 'a drip');
  if (v.sprinkles) extras.push('sprinkles');
  if (v.rosettes) extras.push(tl ? 'rosettes' : 'piped rosettes');
  if (v.flowers) {
    const style: Record<string, [string, string]> = { side: ['fresh flowers on one side', 'bulaklak sa gilid'], cascade: ['cascading fresh flowers', 'bulaklak na pababa sa gilid'], crown: ['a crown of fresh flowers', 'koronang bulaklak sa ibabaw'], scatter: ['scattered fresh flowers', 'nakakalat na bulaklak'] };
    const f = style[v.flowerStyle] ?? style.side!;
    extras.push(tl ? f[1] : f[0]);
  }
  if (v.pearls) extras.push(tl ? 'pearls' : 'sugar pearls');
  if (v.fruits) extras.push(tl ? 'prutas' : 'fresh fruit');
  if (v.gold) extras.push(tl ? 'gold leaf' : 'gold leaf');
  if (v.figure) extras.push(tl ? 'figure sa ibabaw' : 'a figure on top');
  if (v.motif) extras.push(tl ? `${MOTIFS[v.motif.key].nameTl.toLowerCase()} na topper` : `a ${MOTIFS[v.motif.key].name.toLowerCase()} topper`);
  if (v.stand === 'gold') extras.push(tl ? 'gold na pedestal stand' : 'a gold pedestal stand');
  if (v.stand === 'wood') extras.push(tl ? 'kahoy na stand' : 'a wooden slab stand');
  if (v.candles) extras.push(`${v.candles} ${tl ? 'kandila' : v.candles === 1 ? 'candle' : 'candles'}`);
  if (v.text) extras.push(tl ? `nakasulat na "${v.text}"` : `the words "${v.text}"`);
  const head = tl ? `${tiers} na ${color}${cov} cake` : `A ${tiers} ${color}${cov} cake`;
  if (!extras.length) return `${head}.`;
  return `${head} ${tl ? 'na may' : 'with'} ${extras.join(', ')}.`;
}
