import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_DRAFT, writeDraft } from '../data/draft';
import { Cake2D } from '../cake/Cake2D';
import { CakeView } from '../cake/CakeView';
import { describeCake } from '../cake/describe';
import { buildDesigns } from '../domain/designs';
import { formatPeso } from '../domain/money';
import { motifFor } from '../domain/motifs';
import { priceSelection, toPublicMenu } from '../domain/pricing';
import { readRequest } from '../domain/requestReader';
import { createSampleBakery } from '../domain/starterMenus';
import type { Role } from '../domain/survey';
import { toVisual } from '../domain/visual';
import { usePrefs, useTx } from '../lib/prefs';

/**
 * Try Cakeita right inside the survey, so nobody has to leave and come back for part 2.
 * Customers type a cake and see it in 3D with three prices; bakers see a sample request
 * with the price worked out from costs and approve it. Same pricing code as the app.
 */
export function SurveyTry({ role, onTried }: { role: Role; onTried: () => void }) {
  return role === 'baker' ? <BakerTry onTried={onTried} /> : <CustomerTry onTried={onTried} />;
}

const TIER_NAME: Record<string, [string, string]> = { simple: ['Simple', 'Simple'], classic: ['Classic', 'Classic'], showstopper: ['Showstopper', 'Showstopper'] };

function CustomerTry({ onTried }: { onTried: () => void }) {
  const tx = useTx();
  const prefs = usePrefs();
  const bakery = useMemo(() => createSampleBakery(), []);
  const menu = useMemo(() => toPublicMenu(bakery), [bakery]);
  const [text, setText] = useState(() => tx('Ube birthday cake with chocolate drip and sprinkles, 20 pax, budget 1500', 'Ube na birthday cake, may chocolate drip at sprinkles, 20 pax, budget 1500'));
  const [pick, setPick] = useState<string | null>(null);
  const r = useMemo(() => readRequest(text, menu), [text, menu]);
  const designs = useMemo(
    () => buildDesigns(menu, { servings: r.servings, budget: r.budget, tiers: r.tiers, sizeIn: r.sizeIn, flavorId: r.flavorId, coveringId: r.coveringId, componentIds: r.componentIds, textOnCake: r.textOnCake }),
    [menu, r],
  );
  const chosen = designs.options.find((o) => o.tier === pick) ?? [...designs.options].reverse().find((o) => !o.overBudget) ?? designs.options[0];
  const look = { colors: r.colors.slice(0, 2).map((c) => c.hex), textOnCake: r.textOnCake, candles: r.age ? Math.min(10, r.age) : 1, motif: motifFor(r.theme, r.occasion), age: r.age ?? undefined };
  const visual = chosen ? toVisual(menu, chosen.selection, look) : null;
  const navigate = useNavigate();
  // Next step after seeing the designs: open this same cake in the full designer to customize it.
  const customize = () => {
    writeDraft('sample', { ...EMPTY_DRAFT, description: text, stage: 'cake', tier: chosen?.tier ?? 'classic' });
    navigate('/b/sample');
  };
  return (
    <section className="card space-y-3" data-survey-try>
      <h2 className="text-xl">{tx('Try it here: describe a cake', 'Subukan dito: i-describe ang cake')}</h2>
      <label htmlFor="try-desc" className="label">
        {tx('Your cake, with a budget (Taglish OK)', 'Ang cake mo, kasama ang budget (Taglish OK)')}
      </label>
      <textarea id="try-desc" className="input min-h-20" maxLength={400} value={text} onChange={(e) => { setText(e.target.value); setPick(null); }} />
      {visual && <CakeView visual={visual} description={describeCake(visual, prefs.lang)} showTools={false} />}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tx('Designs that fit', 'Mga design na pasok')}>
        {designs.options.map((o) => {
          const on = o.tier === chosen?.tier;
          return (
            <button key={o.tier} type="button" role="radio" aria-checked={on} className={`rounded-2xl border p-2 text-left transition ${on ? 'border-berry bg-berry-soft' : 'border-line bg-white'}`} onClick={() => setPick(o.tier)}>
              <span className="block text-sm font-semibold">{tx(TIER_NAME[o.tier]![0], TIER_NAME[o.tier]![1])}</span>
              <span className="price block text-lg">{formatPeso(o.estimate)}</span>
              {r.budget != null && <span className={`block text-xs font-bold ${o.overBudget ? 'text-amber-ink' : 'text-ok-ink'}`}>{o.overBudget ? tx('Over', 'Lampas') : tx('Fits', 'Pasok')}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-soft">{tx('Sample bakery prices (estimates).', 'Presyo ng sample bakery (tantya).')}</p>
      <button type="button" className="btn-secondary w-full" onClick={customize} data-try-link>
        {tx('Customize this cake', 'I-customize ang cake na ito')}
      </button>
      <button type="button" className="btn w-full" onClick={onTried} data-part2>
        {tx('Done trying: 3 quick taps', 'Tapos na: 3 mabilis na tap')}
      </button>
    </section>
  );
}

function BakerTry({ onTried }: { onTried: () => void }) {
  const tx = useTx();
  const prefs = usePrefs();
  const bakery = useMemo(() => createSampleBakery(), []);
  const menu = useMemo(() => toPublicMenu(bakery), [bakery]);
  const message = 'Hi po! Pa-quote ng ube cake with chocolate drip, 20 pax. Budget 1.5k po.';
  const sel = useMemo(() => {
    const r = readRequest(message, menu);
    const d = buildDesigns(menu, { servings: r.servings, budget: null, tiers: r.tiers, sizeIn: r.sizeIn, flavorId: r.flavorId, coveringId: r.coveringId, componentIds: r.componentIds, textOnCake: '' });
    return d.options.find((o) => o.tier === 'classic')?.selection ?? d.options[0]?.selection ?? null;
  }, [menu]);
  const q = sel ? priceSelection(bakery, sel) : null;
  const visual = sel ? toVisual(menu, sel, { colors: ['#9466c4'], textOnCake: '', candles: 0 }) : null;
  const [approved, setApproved] = useState(false);
  if (!q || !visual) return null;
  const kita = q.suggestedPrice - q.costTotal;
  return (
    <section className="card space-y-3" data-survey-try>
      <h2 className="text-xl">{tx('Try it here: a customer asks for a quote', 'Subukan dito: may nagpa-quote na customer')}</h2>
      <p className="rounded-2xl bg-[#f3eee8] p-3 text-[0.95rem]">“{message}”</p>
      <div className="flex items-center gap-3">
        <Cake2D visual={visual} title={describeCake(visual, prefs.lang)} crop className="h-24 w-28 shrink-0" />
        <dl className="grid flex-1 grid-cols-[1fr_auto] gap-x-3 text-sm">
          <dt>{tx('Ingredients', 'Sangkap')}</dt>
          <dd className="text-right">{formatPeso(q.ingredientsTotal)}</dd>
          <dt>{tx('Your time', 'Oras mo')}</dt>
          <dd className="text-right">{formatPeso(q.laborTotal + q.extrasTotal)}</dd>
          <dt className="font-semibold">{tx('Your profit', 'Kita mo')}</dt>
          <dd className="text-right font-semibold text-ok-ink">{formatPeso(kita)}</dd>
        </dl>
      </div>
      <p className="text-xs text-ink-soft">{tx('Sample costs (estimates). You set your own prices in the app.', 'Sample na gastos (tantya). Ikaw ang maglalagay ng sariling presyo sa app.')}</p>
      {approved ? (
        <p className="rounded-xl bg-ok-bg p-2 text-center text-sm font-semibold text-ok-ink" role="status">
          {tx(`Quote sent: ${formatPeso(q.suggestedPrice)} (sample only)`, `Naipadala ang quote: ${formatPeso(q.suggestedPrice)} (sample lang)`)}
        </p>
      ) : (
        <button type="button" className="btn-secondary w-full" onClick={() => setApproved(true)} data-try-approve>
          {tx(`Approve the quote at ${formatPeso(q.suggestedPrice)}`, `I-approve ang quote sa ${formatPeso(q.suggestedPrice)}`)}
        </button>
      )}
      <button type="button" className="btn w-full" onClick={onTried} data-part2>
        {tx('Done trying: 3 quick taps', 'Tapos na: 3 mabilis na tap')}
      </button>
    </section>
  );
}
