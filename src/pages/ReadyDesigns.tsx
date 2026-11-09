import { useMemo } from 'react';
import { Cake2D } from '../cake/Cake2D';
import { describeCake } from '../cake/describe';
import { buildDesigns } from '../domain/designs';
import { formatPeso } from '../domain/money';
import type { PublicMenu } from '../domain/types';
import { toVisual } from '../domain/visual';
import { usePrefs, useTx } from '../lib/prefs';
import { lookFromReading, offlineReading, wantsFrom } from './customerCake';
import { EMPTY_DRAFT } from '../data/draft';

/**
 * "Pick a ready design": a few popular cakes, each built from this baker's own priced parts
 * (same code as everything else), so the price on the card is the price on the next step.
 */
export interface ReadyDesign {
  key: string;
  name: [string, string];
  /** What it is, in the words the request reader understands. */
  text: [string, string];
  occasion: string;
  servings: number;
}

export const READY_DESIGNS: ReadyDesign[] = [
  { key: 'choco-drip', name: ['Chocolate drip', 'Chocolate drip'], text: ['Chocolate cake with chocolate ganache and chocolate drip, sprinkles, 12 pax', 'Chocolate cake, chocolate ganache at chocolate drip, may sprinkles, 12 pax'], occasion: 'Birthday', servings: 12 },
  { key: 'ube-bday', name: ['Ube birthday', 'Ube birthday'], text: ['Ube cake, purple and white buttercream, sprinkles, candles, 20 pax, "Happy Birthday"', 'Ube cake, lila at puting buttercream, may sprinkles at kandila, 20 pax, "Happy Birthday"'], occasion: 'Birthday', servings: 20 },
  { key: 'pink-2tier', name: ['Pink 2-tier', 'Pink 2-tier'], text: ['2 tier pink vanilla cake, buttercream rosettes and fresh flowers, 30 pax', '2 tier pink na vanilla cake, may buttercream rosettes at totoong bulaklak, 30 pax'], occasion: 'Birthday', servings: 30 },
  { key: 'floral', name: ['Floral for Mom or Lola', 'Floral para kay Mama o Lola'], text: ['Ube cake, lavender and white, fresh flowers and sugar pearls, 15 pax', 'Ube cake, lavender at puti, may totoong bulaklak at sugar pearls, 15 pax'], occasion: 'Birthday', servings: 15 },
  { key: 'hero', name: ['Superhero', 'Superhero'], text: ['Superhero theme cake, blue and red buttercream, theme topper, candles, 20 pax', 'Superhero theme cake, asul at pulang buttercream, may theme topper at kandila, 20 pax'], occasion: 'Birthday', servings: 20 },
  { key: 'mocha', name: ['Simple mocha', 'Simpleng mocha'], text: ['Mocha cake, white whipped cream, simple, 10 pax', 'Mocha cake, puting whipped cream, simple lang, 10 pax'], occasion: 'Other', servings: 10 },
];

export function ReadyDesigns({ menu, onPick }: { menu: PublicMenu; onPick: (d: ReadyDesign, text: string) => void }) {
  const tx = useTx();
  const prefs = usePrefs();
  const cards = useMemo(
    () =>
      READY_DESIGNS.map((d) => {
        const text = prefs.lang === 'tl' ? d.text[1] : d.text[0];
        const reading = offlineReading(text, menu);
        const wants = wantsFrom({ ...EMPTY_DRAFT, description: text, servings: d.servings }, reading);
        const look = lookFromReading(reading, d.occasion);
        const designs = buildDesigns(menu, look.colors.length ? { ...wants, colored: true } : wants);
        const o = designs.options.find((x) => x.tier === 'classic') ?? designs.options[0];
        if (!o) return null;
        const visual = toVisual(menu, o.selection, look);
        return { d, text, price: o.estimate, visual, desc: describeCake(visual, prefs.lang) };
      }).filter((c) => !!c),
    [menu, prefs.lang],
  );
  if (!cards.length) return null;
  return (
    <section className="space-y-2" aria-labelledby="ready-designs-h" data-ready-designs>
      <h2 id="ready-designs-h" className="text-lg font-semibold">
        {tx('Pick a ready design', 'Pumili ng ready design')}
      </h2>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible">
        {cards.map((c) => (
          <button key={c.d.key} type="button" className="w-36 shrink-0 snap-start rounded-2xl border border-line bg-white p-2 text-left transition hover:border-berry/60 sm:w-auto" onClick={() => onPick(c.d, c.text)} data-ready-design={c.d.key} aria-label={`${tx(c.d.name[0], c.d.name[1])}, ${tx('from', 'mula')} ${formatPeso(c.price)}. ${c.desc}`}>
            <Cake2D visual={c.visual} title={c.desc} crop className="h-24 w-full" />
            <span className="mt-1 block text-sm font-semibold leading-tight">{tx(c.d.name[0], c.d.name[1])}</span>
            <span className="block text-xs text-ink-soft">
              {c.d.servings} {tx('people', 'tao')} · <span className="font-semibold text-ink">{formatPeso(c.price)}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-soft">{tx('Prices from this baker’s menu (estimates). Tap one, then change anything.', 'Presyo mula sa menu ng baker (tantya). I-tap, tapos baguhin kahit ano.')}</p>
    </section>
  );
}
