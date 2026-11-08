import { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Field, Notice, Stepper } from '../../components/ui';
import { formatPeso } from '../../domain/money';
import { priceSelection } from '../../domain/pricing';
import { createBakeryFromStarter, createSampleBakery, slugify, STARTER_PRESETS, type StarterKey } from '../../domain/starterMenus';
import type { Bakery } from '../../domain/types';
import { repo } from '../../data/store';
import { useTx } from '../../lib/prefs';

/** The five ingredient prices that move a home baker's cost the most. */
const KEY_INGREDIENTS: Array<{ id: string; per: number; unitLabel: string }> = [
  { id: 'butter', per: 1000, unitLabel: 'per kg' },
  { id: 'flour', per: 1000, unitLabel: 'per kg' },
  { id: 'sugar', per: 1000, unitLabel: 'per kg' },
  { id: 'eggs', per: 1, unitLabel: 'each' },
  { id: 'whip-cream', per: 1000, unitLabel: 'per liter' },
];

export default function Setup() {
  const tx = useTx();
  const [step, setStep] = useState(1);
  const [starter, setStarter] = useState<StarterKey>('home');
  const [info, setInfo] = useState({ name: '', ownerName: '', contact: '', city: '', slug: '' });
  const [draft, setDraft] = useState<Bakery | null>(null);

  const startDemo = () => repo.setBakery(createSampleBakery());

  const toNumbers = () => {
    const b = createBakeryFromStarter(starter, info);
    setDraft(b);
    setStep(3);
  };

  const finish = () => {
    if (!draft) return;
    repo.setBakery(draft);
  };

  const setIng = (id: string, perUnitValue: number, per: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      ingredients: draft.ingredients.map((i) => (i.id === id ? { ...i, costPerUnit: Math.max(0, perUnitValue / per), updatedAt: new Date().toISOString() } : i)),
    });
  };

  const preview = draft ? priceSelection(draft, { baseCakeId: 'r6-2', componentIds: ['fl-vanilla', 'cv-buttercream'] }) : null;

  return (
    <Layout>
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-semibold">{tx('Set up your bakery', 'I-set up ang bakery mo')}</h1>
        <Stepper step={step} total={3} label={tx('Setup', 'Setup')} />

        {step === 1 && (
          <div className="space-y-4">
            <p>{tx('Pick the menu closest to what you bake. You can change everything later.', 'Piliin ang menu na pinakamalapit sa bine-bake mo. Puwedeng baguhin lahat mamaya.')}</p>
            <div className="grid gap-3" role="radiogroup" aria-label={tx('Starter menu', 'Starter menu')}>
              {STARTER_PRESETS.map((p) => (
                <button key={p.key} type="button" role="radio" aria-checked={starter === p.key} onClick={() => setStarter(p.key)} className={`card text-left ${starter === p.key ? '!border-ink ring-1 ring-ink' : 'hover:border-[#cdbdb0]'}`}>
                  <p className="font-display text-xl font-semibold">{tx(p.title, p.titleTl)}</p>
                  <p>{tx(p.blurb, p.blurbTl)}</p>
                </button>
              ))}
            </div>
            <button type="button" className="btn w-full" onClick={() => setStep(2)}>
              {tx('Next', 'Sunod')}
            </button>
            <div className="card space-y-2 bg-berry-soft">
              <p className="font-bold">{tx('Just looking? Try the demo bakery.', 'Titingin lang? Subukan ang demo bakery.')}</p>
              <p className="text-sm">{tx('Loads a sample bakery with sample prices so you can see every screen.', 'May sample bakery at sample prices para makita mo lahat ng screen.')}</p>
              <button type="button" className="btn-secondary w-full" onClick={startDemo}>
                {tx('Use the demo bakery', 'Gamitin ang demo bakery')}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (info.name.trim()) toNumbers();
            }}
          >
            <Field id="bname" label={tx('Bakery name', 'Pangalan ng bakery')}>
              <input id="bname" className="input" required maxLength={80} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value, slug: info.slug || '' })} />
            </Field>
            <Field id="owner" label={tx('Your name', 'Pangalan mo')}>
              <input id="owner" className="input" maxLength={80} value={info.ownerName} onChange={(e) => setInfo({ ...info, ownerName: e.target.value })} />
            </Field>
            <Field id="bcontact" label={tx('How customers reach you', 'Paano ka makokontak ng customer')} hint={tx('Your Messenger link (m.me/yourpage) or mobile number', 'Messenger link mo (m.me/yourpage) o mobile number')}>
              <input id="bcontact" className="input" maxLength={120} value={info.contact} onChange={(e) => setInfo({ ...info, contact: e.target.value })} aria-describedby="bcontact-hint" />
            </Field>
            <Field id="city" label={tx('City', 'Lungsod')}>
              <input id="city" className="input" maxLength={60} value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} />
            </Field>
            <Field id="slug" label={tx('Link name', 'Pangalan ng link')} hint={`…/#/b/${slugify(info.slug || info.name || 'my-bakery')}`}>
              <input id="slug" className="input" maxLength={40} value={info.slug} placeholder={slugify(info.name || 'my-bakery')} onChange={(e) => setInfo({ ...info, slug: e.target.value })} aria-describedby="slug-hint" />
            </Field>
            {slugify(info.slug || info.name) === 'sample' && <Notice tone="warn">{tx('"sample" is reserved for the demo. Pick another link name.', 'Para sa demo ang "sample". Pumili ng ibang link name.')}</Notice>}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                ← {tx('Back', 'Bumalik')}
              </button>
              <button type="submit" className="btn flex-1" disabled={!info.name.trim() || slugify(info.slug || info.name) === 'sample'}>
                {tx('Next', 'Sunod')}
              </button>
            </div>
          </form>
        )}

        {step === 3 && draft && (
          <div className="space-y-4">
            <Notice tone="warn" title={tx('These are sample prices', 'Sample prices ang mga ito')}>
              {tx('Change them to what you actually pay. These 5 matter most.', 'Palitan ng totoong binabayaran mo. Ito ang 5 pinakamahalaga.')}
            </Notice>
            <div className="grid gap-3 sm:grid-cols-2">
              {KEY_INGREDIENTS.map((k) => {
                const ing = draft.ingredients.find((i) => i.id === k.id)!;
                return (
                  <Field key={k.id} id={`ing-${k.id}`} label={`${ing.name} (₱ ${k.unitLabel})`}>
                    <input id={`ing-${k.id}`} type="number" inputMode="decimal" min={0} step="0.01" className="input" value={Math.round(ing.costPerUnit * k.per * 100) / 100} onChange={(e) => setIng(k.id, Number(e.target.value), k.per)} />
                  </Field>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="labor" label={tx('Your labor rate (₱ per hour)', 'Bayad sa oras mo (₱ kada oras)')} hint={tx('Pay yourself. Your time is a cost too.', 'Bayaran mo ang sarili mo. Gastos din ang oras mo.')}>
                <input id="labor" type="number" min={0} className="input" value={draft.laborRatePerHour} onChange={(e) => setDraft({ ...draft, laborRatePerHour: Math.max(0, Number(e.target.value)) })} aria-describedby="labor-hint" />
              </Field>
              <Field id="margin" label={tx('Target profit margin (%)', 'Target na tubo (%)')}>
                <input id="margin" type="number" min={0} max={90} className="input" value={draft.targetMarginPct} onChange={(e) => setDraft({ ...draft, targetMarginPct: Math.max(0, Math.min(90, Number(e.target.value))) })} />
              </Field>
              <Field id="minorder" label={tx('Minimum order (₱)', 'Pinakamababang order (₱)')}>
                <input id="minorder" type="number" min={0} className="input" value={draft.minOrderPrice} onChange={(e) => setDraft({ ...draft, minOrderPrice: Math.max(0, Number(e.target.value)) })} />
              </Field>
              <Field id="lead" label={tx('Days of notice you need', 'Ilang araw na abiso')}>
                <input id="lead" type="number" min={0} max={60} className="input" value={draft.leadTimeDays} onChange={(e) => setDraft({ ...draft, leadTimeDays: Math.max(0, Math.min(60, Math.round(Number(e.target.value)))) })} />
              </Field>
            </div>
            {preview && (
              <div className="card" aria-live="polite">
                <p className="text-sm font-semibold text-ink-soft">{tx('With these numbers, a plain 6" 2-layer buttercream cake is', 'Sa mga numerong ito, ang simpleng 6" 2-layer buttercream cake ay')}</p>
                <p className="price">{formatPeso(preview.suggestedPrice)}</p>
                <p className="text-sm">
                  {tx('Cost', 'Gastos')} {formatPeso(preview.costTotal)} · {tx('margin', 'tubo')} {preview.marginPct}%
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                ← {tx('Back', 'Bumalik')}
              </button>
              <button type="button" className="btn flex-1" onClick={finish}>
                {tx('Open my bakery', 'Buksan ang bakery ko')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
