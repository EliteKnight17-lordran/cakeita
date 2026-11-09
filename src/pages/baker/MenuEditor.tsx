import { useMemo, useRef, useState } from 'react';
import { Field, Notice } from '../../components/ui';
import { IconAlert, IconMic } from '../../components/icons';
import { formatPeso } from '../../domain/money';
import { menuPriceCheck, priceSelection, upcomingDates } from '../../domain/pricing';
import { parsePriceUpdate, type PriceChange } from '../../domain/priceUpdate';
import type { Bakery, Ingredient } from '../../domain/types';
import { repo, useDb, type DbState } from '../../data/store';
import { useTx } from '../../lib/prefs';
import { BakerShell } from './BakerShell';

type SpeechRec = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

function getSpeech(): (new () => SpeechRec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const perFor = (unit: Ingredient['unit']) => (unit === 'pc' ? { per: 1, label: 'each' } : { per: 1000, label: unit === 'g' ? 'per kg' : 'per liter' });

function plainParts(b: Bakery) {
  return b.components.filter((c) => c.canMake && (c.category === 'flavor' || c.category === 'covering')).filter((c, i, arr) => arr.findIndex((x) => x.category === c.category) === i);
}

export default function MenuEditor() {
  const db = useDb();
  const tx = useTx();
  const b = db.bakery!;
  const save = (patch: Partial<Bakery>) => repo.setBakery({ ...b, ...patch });

  // ---- quick price update ----
  const [updateText, setUpdateText] = useState('');
  const [pending, setPending] = useState<PriceChange[] | null>(null);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const recRef = useRef<SpeechRec | null>(null);
  const Speech = typeof window !== 'undefined' ? getSpeech() : null;

  const readUpdate = () => {
    const r = parsePriceUpdate(updateText, b.ingredients);
    setPending(r.changes);
    setUnknown(r.unknown);
    setSavedMsg('');
  };

  const listen = () => {
    if (!Speech) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Speech();
    rec.lang = 'fil-PH';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(', ');
      setUpdateText((cur) => (cur ? `${cur}, ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const applyUpdate = () => {
    if (!pending) return;
    const now = new Date().toISOString();
    const ingredients = b.ingredients.map((i) => {
      const ch = pending.find((p) => p.ingredientId === i.id);
      return ch ? { ...i, costPerUnit: ch.newCost, updatedAt: now } : i;
    });
    const next = { ...b, ingredients };
    repo.setBakery(next);
    const open = db.orders.filter((o) => o.status === 'quoted' && o.quote);
    const affected = open.filter((o) => {
      const q = priceSelection(next, o.quote!.selection);
      return q && q.suggestedPrice > o.quote!.price;
    });
    setSavedMsg(
      tx(
        `Saved ${pending.length} price(s).${affected.length ? ` ${affected.length} open quote(s) now earn less than your target. Check them in Orders.` : ''}`,
        `Na-save ang ${pending.length} presyo.${affected.length ? ` ${affected.length} na bukas na quote ang mababa na sa target. I-check sa Orders.` : ''}`,
      ),
    );
    setPending(null);
    setUpdateText('');
  };

  const lugi = useMemo(() => b.baseCakes.map((base) => ({ base, check: menuPriceCheck(b, base, plainParts(b)) })), [b]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(repo.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cakeita-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as DbState;
      if (data?.v !== 1 || !Array.isArray(data.orders) || !data.bakery) throw new Error('bad');
      if (window.confirm(tx('Replace everything on this device with this backup?', 'Palitan ang lahat sa device na ito ng backup?'))) repo.replaceAll(data);
    } catch {
      window.alert(tx('That file is not a Cakeita backup.', 'Hindi Cakeita backup ang file.'));
    }
  };

  return (
    <BakerShell>
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">{tx('Menu and prices', 'Menu at presyo')}</h1>

        <section className="card space-y-3" aria-labelledby="up-h">
          <h2 id="up-h" className="font-display text-xl font-semibold">
            {tx('New prices from the store?', 'May bagong presyo?')}
          </h2>
          <Field id="upd" label={tx('Type or say them', 'I-type o sabihin')} hint={tx('e.g. butter 520 per kilo, itlog 9.50 each, cream 62 per 250ml', 'hal. butter 520 per kilo, itlog 9.50 each, cream 62 per 250ml')}>
            <textarea id="upd" className="input min-h-20" value={updateText} onChange={(e) => setUpdateText(e.target.value)} aria-describedby="upd-hint" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn flex-1" disabled={!updateText.trim()} onClick={readUpdate}>
              {tx('Read prices', 'Basahin ang presyo')}
            </button>
            {Speech && (
              <button type="button" className="btn-secondary" onClick={listen} aria-pressed={listening}>
                <IconMic /> {listening ? tx('Stop', 'Itigil') : tx('Speak', 'Magsalita')}
              </button>
            )}
          </div>
          {pending && (
            <div className="space-y-2">
              {pending.length === 0 ? (
                <Notice tone="warn">{tx('No prices found. Try "butter 520 per kilo".', 'Walang nabasang presyo. Subukan ang "butter 520 per kilo".')}</Notice>
              ) : (
                <>
                  <p className="font-bold">{tx('Check before saving:', 'I-check bago i-save:')}</p>
                  <ul className="space-y-2">
                    {pending.map((p, i) => (
                      <li key={i} className={`rounded-xl border p-3 ${p.warning ? 'border-[#e6cf9c] bg-amber-bg' : 'border-line bg-white'}`}>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-sm">
                          {tx('Old', 'Dati')}: ₱{p.oldCost} → <strong>{tx('New', 'Bago')}: ₱{p.newCost}</strong> {tx('per', 'kada')} {b.ingredients.find((x) => x.id === p.ingredientId)?.unit}
                        </p>
                        <p className="text-sm text-ink-soft">{p.how}</p>
                        {p.warning && (
                          <p className="flex gap-1.5 text-sm font-semibold text-amber-ink">
                            <IconAlert size={16} className="mt-0.5 shrink-0" /> {p.warning}
                          </p>
                        )}
                        <button type="button" className="btn-ghost mt-1" onClick={() => setPending(pending.filter((_, j) => j !== i))}>
                          {tx('Skip this one', 'Huwag isama')}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn w-full" onClick={applyUpdate}>
                    {tx('Save new prices', 'I-save ang bagong presyo')}
                  </button>
                </>
              )}
              {unknown.length > 0 && <p className="text-sm text-ink-soft">{tx("Couldn't read", 'Hindi nabasa')}: {unknown.join('; ')}</p>}
            </div>
          )}
          {savedMsg && <Notice tone="ok">{savedMsg}</Notice>}
        </section>

        <section className="card space-y-3" aria-labelledby="lugi-h">
          <h2 id="lugi-h" className="font-display text-xl font-semibold">
            {tx('Are your menu prices still earning?', 'Kumikita pa ba ang menu prices mo?')}
          </h2>
          <p className="text-sm text-ink-soft">{tx('Plain cake (first flavor and frosting) at your current costs.', 'Simpleng cake (unang flavor at frosting) sa kasalukuyang gastos.')}</p>
          <ul className="space-y-2">
            {lugi.map(({ base, check }) => (
              <li key={base.id} className={`rounded-xl border p-3 ${check.belowTarget ? 'border-[#e8b4ad] bg-danger-bg' : 'border-line bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{base.name}</p>
                  <p className="text-sm">
                    {tx('Cost', 'Gastos')} {formatPeso(check.quote.costTotal)} · {tx('suggested', 'suggested')} <strong>{formatPeso(check.quote.suggestedPrice)}</strong>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Field id={`mp-${base.id}`} label={tx('Your menu price (₱)', 'Presyo mo ngayon (₱)')}>
                    <input
                      id={`mp-${base.id}`}
                      type="number"
                      min={0}
                      className="input w-36"
                      value={base.menuPrice ?? ''}
                      onChange={(e) => save({ baseCakes: b.baseCakes.map((x) => (x.id === base.id ? { ...x, menuPrice: e.target.value ? Math.max(0, Number(e.target.value)) : undefined } : x)) })}
                    />
                  </Field>
                  {check.belowTarget && (
                    <button type="button" className="btn" onClick={() => save({ baseCakes: b.baseCakes.map((x) => (x.id === base.id ? { ...x, menuPrice: check.quote.suggestedPrice } : x)) })}>
                      {tx(`Raise to ${formatPeso(check.quote.suggestedPrice)}?`, `Itaas sa ${formatPeso(check.quote.suggestedPrice)}?`)}
                    </button>
                  )}
                </div>
                {check.menuPrice != null && (
                  <p className={`mt-1 text-sm font-semibold ${check.belowTarget ? 'text-danger-ink' : 'text-ok-ink'}`}>
                    {check.loss ? tx('You lose money at this price.', 'Lugi ka sa presyong ito.') : `${tx('Margin', 'Tubo')} ${Math.round(check.marginPct * 10) / 10}%`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-3" aria-labelledby="ing-h">
          <h2 id="ing-h" className="font-display text-xl font-semibold">
            {tx('Ingredient prices', 'Presyo ng sangkap')}
          </h2>
          <ul className="space-y-2">
            {b.ingredients.map((i) => {
              const { per, label } = perFor(i.unit);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
                  <label htmlFor={`ing-${i.id}`} className="min-w-0 flex-1 font-semibold">
                    {i.name} <span className="text-sm text-ink-soft">(₱ {label})</span>
                    {!i.updatedAt && <span className="tag ml-1 bg-amber-bg text-xs text-amber-ink">{tx('estimate, edit me', 'tantya, palitan')}</span>}
                  </label>
                  <input
                    id={`ing-${i.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    className="input w-32"
                    value={Math.round(i.costPerUnit * per * 100) / 100}
                    onChange={(e) => save({ ingredients: b.ingredients.map((x) => (x.id === i.id ? { ...x, costPerUnit: Math.max(0, Number(e.target.value) / per), updatedAt: new Date().toISOString() } : x)) })}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card space-y-3" aria-labelledby="parts-h">
          <h2 id="parts-h" className="font-display text-xl font-semibold">
            {tx('What you make', 'Ano ang ginagawa mo')}
          </h2>
          <p className="text-sm text-ink-soft">{tx('Turn off anything you do not make. Customers will never be offered it.', 'I-off ang hindi mo ginagawa. Hindi ito iaalok sa customer.')}</p>
          <ul className="space-y-2">
            {b.components.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line p-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
                    <input type="checkbox" className="h-6 w-6 accent-[#8c2246]" checked={c.canMake} onChange={(e) => save({ components: b.components.map((x) => (x.id === c.id ? { ...x, canMake: e.target.checked } : x)) })} />
                    {c.name} <span className="text-xs text-ink-soft">({c.category})</span>
                  </label>
                  <label className="text-sm">
                    {tx('Labor min', 'Minuto')}{' '}
                    <input type="number" min={0} className="input w-20" value={c.laborMinutes} onChange={(e) => save({ components: b.components.map((x) => (x.id === c.id ? { ...x, laborMinutes: Math.max(0, Number(e.target.value)) } : x)) })} />
                  </label>
                  <label className="text-sm">
                    {tx('Extra ₱', 'Extra ₱')}{' '}
                    <input type="number" min={0} className="input w-24" value={c.extraCost} onChange={(e) => save({ components: b.components.map((x) => (x.id === c.id ? { ...x, extraCost: Math.max(0, Number(e.target.value)) } : x)) })} />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-3" aria-labelledby="rules-h">
          <h2 id="rules-h" className="font-display text-xl font-semibold">
            {tx('Your rates and rules', 'Rates at rules mo')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="r-labor" label={tx('Labor rate (₱/hour)', 'Bayad sa oras (₱/oras)')}>
              <input id="r-labor" type="number" min={0} className="input" value={b.laborRatePerHour} onChange={(e) => save({ laborRatePerHour: Math.max(0, Number(e.target.value)) })} />
            </Field>
            <Field id="r-margin" label={tx('Target margin (%)', 'Target na tubo (%)')}>
              <input id="r-margin" type="number" min={0} max={90} className="input" value={b.targetMarginPct} onChange={(e) => save({ targetMarginPct: Math.max(0, Math.min(90, Number(e.target.value))) })} />
            </Field>
            <Field id="r-min" label={tx('Minimum order (₱)', 'Minimum order (₱)')}>
              <input id="r-min" type="number" min={0} className="input" value={b.minOrderPrice} onChange={(e) => save({ minOrderPrice: Math.max(0, Number(e.target.value)) })} />
            </Field>
            <Field id="r-lead" label={tx('Notice needed (days)', 'Abiso (araw)')}>
              <input id="r-lead" type="number" min={0} max={60} className="input" value={b.leadTimeDays} onChange={(e) => save({ leadTimeDays: Math.max(0, Math.min(60, Math.round(Number(e.target.value)))) })} />
            </Field>
            <Field id="r-tiers" label={tx('Most tiers you make', 'Pinakamaraming tier')}>
              <input id="r-tiers" type="number" min={1} max={3} className="input" value={b.skills.maxTiers} onChange={(e) => save({ skills: { ...b.skills, maxTiers: Math.max(1, Math.min(3, Math.round(Number(e.target.value)))) } })} />
            </Field>
            <Field id="r-cant" label={tx("Things you don't do (comma separated)", 'Hindi mo ginagawa (may comma)')}>
              <input id="r-cant" className="input" defaultValue={b.skills.cannotDo.join(', ')} onBlur={(e) => save({ skills: { ...b.skills, cannotDo: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 30) } })} />
            </Field>
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-6 w-6 accent-[#8c2246]" checked={b.settings.showEstimates} onChange={(e) => save({ settings: { ...b.settings, showEstimates: e.target.checked } })} />
            <span>
              <strong>{tx('Show estimated prices to customers', 'Ipakita ang tantyang presyo sa customer')}</strong>
              <br />
              <span className="text-sm text-ink-soft">{tx('They still need your approval. Turn off if you prefer to quote only by hand.', 'Kailangan pa rin ng approval mo. I-off kung mas gusto mong mag-quote nang manual.')}</span>
            </span>
          </label>
        </section>

        <FullDates bakery={b} orders={db.orders} onChange={(fullDates) => save({ fullDates })} />

        <section className="card space-y-3" aria-labelledby="info-h">
          <h2 id="info-h" className="font-display text-xl font-semibold">
            {tx('Bakery info', 'Info ng bakery')}
          </h2>
          <Field id="i-name" label={tx('Name', 'Pangalan')}>
            <input id="i-name" className="input" maxLength={80} value={b.name} onChange={(e) => save({ name: e.target.value })} />
          </Field>
          <Field id="i-contact" label={tx('Contact (Messenger link or number)', 'Contact (Messenger link o number)')}>
            <input id="i-contact" className="input" maxLength={120} value={b.contact} onChange={(e) => save({ contact: e.target.value })} />
          </Field>
          <Field id="i-city" label={tx('City', 'Lungsod')}>
            <input id="i-city" className="input" maxLength={60} value={b.city} onChange={(e) => save({ city: e.target.value })} />
          </Field>
        </section>

        <section className="card space-y-3" aria-labelledby="data-h">
          <h2 id="data-h" className="font-display text-xl font-semibold">
            {tx('Your data', 'Ang data mo')}
          </h2>
          <p className="text-sm text-ink-soft">{tx('Everything is saved on this phone only. Back it up now and then.', 'Naka-save lang sa phone na ito ang lahat. Mag-backup paminsan-minsan.')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={exportData}>
              ⬇️ {tx('Download backup', 'I-download ang backup')}
            </button>
            <label className="btn-secondary cursor-pointer">
              ⬆️ {tx('Restore backup', 'I-restore ang backup')}
              <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            </label>
            <button type="button" className="btn-danger" onClick={() => window.confirm(tx('Delete your bakery and all orders on this device?', 'Burahin ang bakery at lahat ng order sa device na ito?')) && repo.reset()}>
              {tx('Delete everything', 'Burahin lahat')}
            </button>
          </div>
        </section>
      </div>
    </BakerShell>
  );
}

/** Days the baker can't take more orders. Customers can't pick them, and the map says so. */
function FullDates({ bakery, orders, onChange }: { bakery: Bakery; orders: DbState['orders']; onChange: (d: string[]) => void }) {
  const tx = useTx();
  const [pick, setPick] = useState('');
  const days = upcomingDates(bakery.fullDates ?? []);
  // Days that already have confirmed cakes, as quick suggestions.
  const busy = useMemo(() => {
    const count = new Map<string, number>();
    for (const o of orders) if (['confirmed', 'baking', 'ready'].includes(o.status)) count.set(o.eventDate, (count.get(o.eventDate) ?? 0) + 1);
    return upcomingDates([...count.keys()]).filter((d) => !days.includes(d)).map((d) => [d, count.get(d)!] as const);
  }, [orders, days]);
  const label = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const add = (d: string) => d && onChange(upcomingDates([...days, d]));
  return (
    <section className="card space-y-3" aria-labelledby="full-h">
      <h2 id="full-h" className="font-display text-xl font-semibold">{tx('Fully booked days', 'Mga araw na puno na')}</h2>
      <p className="text-sm text-ink-soft">{tx("Customers can't pick these days, and the map shows you as booked.", 'Hindi ito mapipili ng customer, at nakalagay sa mapa na puno ka.')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field id="full-date" label={tx('Add a day', 'Magdagdag ng araw')}>
          <input id="full-date" type="date" className="input" value={pick} onChange={(e) => setPick(e.target.value)} />
        </Field>
        <button type="button" className="btn-secondary" disabled={!pick} onClick={() => { add(pick); setPick(''); }}>{tx('Mark as full', 'Markahan na puno')}</button>
      </div>
      {busy.length > 0 && (
        <div>
          <p className="hint mb-1">{tx('Days with confirmed cakes:', 'May confirmed na cake:')}</p>
          <div className="flex flex-wrap gap-2">
            {busy.map(([d, n]) => (
              <button key={d} type="button" className="btn-ghost" onClick={() => add(d)}>{label(d)} · {n} {tx(n === 1 ? 'cake' : 'cakes', 'cake')} · {tx('mark full', 'markahan')}</button>
            ))}
          </div>
        </div>
      )}
      {days.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={tx('Fully booked days', 'Mga araw na puno na')}>
          {days.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full border border-line bg-[#faf6f1] py-1 pl-3 pr-1 text-sm">
              {label(d)}
              <button type="button" className="btn-ghost !min-h-8 !px-2" aria-label={tx(`Open ${label(d)} again`, `Buksan ulit ang ${label(d)}`)} onClick={() => onChange(days.filter((x) => x !== d))}>×</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">{tx('No full days yet.', 'Wala pang puno na araw.')}</p>
      )}
    </section>
  );
}
