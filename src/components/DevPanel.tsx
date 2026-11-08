import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiAvailable, type Reading } from '../ai/client';
import { hasWebGL } from '../cake/CakeView';
import { addDays } from '../domain/insights';
import { motifFor } from '../domain/motifs';
import { applyConfirmation, approveOrder } from '../domain/orders';
import { priceSelection, toPublicMenu } from '../domain/pricing';
import { readRequest } from '../domain/requestReader';
import { createSampleBakery } from '../domain/starterMenus';
import { SCENARIOS } from '../data/demoScenarios';
import { EMPTY_DRAFT, writeDraft } from '../data/draft';
import { demoOrders, scenarioOrder } from '../data/seed';
import { localBakeryFor, repo, useDb } from '../data/store';
import { setPrefs, usePrefs } from '../lib/prefs';
import { IconWrench } from './icons';

/**
 * Developer panel for fast testing. Open with ?dev=1 in the link, or tap the
 * Cakeita logo 5 times. Everything here only touches this device's data.
 */
export function DevPanel() {
  const prefs = usePrefs();
  const db = useDb();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0]!.key);
  const [ai, setAi] = useState<string>('…');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (open) aiAvailable().then((v) => setAi(v ? 'on' : 'off (offline reader)'));
  }, [open]);

  const say = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(''), 2500);
  };

  const slugInPath = /^\/b\/([^/?]+)/.exec(loc.pathname)?.[1] ?? 'sample';

  const fillCustomer = (withContact: boolean) => {
    const s = SCENARIOS.find((x) => x.key === scenario)!;
    const bakery = localBakeryFor(slugInPath) ?? createSampleBakery();
    const menu = toPublicMenu(bakery);
    const r = readRequest(s.message, menu);
    const reading: Reading = { ...r, summary: '', usedAi: false, aiNote: '' };
    writeDraft(menu.slug, {
      ...EMPTY_DRAFT,
      step: 'order',
      occasion: s.occasion,
      eventDate: addDays(new Date(), Math.max(s.inDays, bakery.leadTimeDays)),
      servings: s.servings,
      budget: s.budget,
      noBudget: s.budget == null,
      description: s.message,
      reading,
      readingFor: s.message,
      look: { colors: r.colors.slice(0, 2).map((c) => c.hex), textOnCake: r.textOnCake.slice(0, 32), candles: r.age ? Math.min(10, r.age) : 1, motif: motifFor(r.theme, s.occasion) },
      name: withContact ? s.customer.name : '',
      contact: withContact ? s.customer.contact : '',
      consent: withContact,
    });
    if (!loc.pathname.startsWith(`/b/${menu.slug}`)) nav(`/b/${menu.slug}${menu.slug === 'sample' ? '' : loc.search}`);
    say(`Customer filled: ${s.title}`);
    window.setTimeout(() => document.getElementById(withContact ? 'sec-contact' : 'sec-designs')?.scrollIntoView({ block: 'start' }), 300);
  };

  const ensureBakery = () => {
    if (!repo.get().bakery) repo.setBakery(createSampleBakery());
    return repo.get().bakery!;
  };

  const approveAll = () => {
    const b = ensureBakery();
    let n = 0;
    for (const o of repo.get().orders.filter((x) => x.status === 'new')) {
      const q = priceSelection(b, o.selection);
      if (!q) continue;
      repo.upsertOrder(approveOrder(b, o, { selection: o.selection, look: o.look, price: q.suggestedPrice, note: 'Dev auto-approve', validDays: 3 }));
      n++;
    }
    say(`Approved ${n}`);
  };

  const confirmAll = () => {
    let n = 0;
    for (const o of repo.get().orders.filter((x) => x.status === 'quoted' && x.quote)) {
      const r = applyConfirmation(o, { v: 1, orderId: o.id, price: o.quote!.price, confirmedAt: new Date().toISOString(), note: 'Dev confirm', customerName: o.customer.name });
      if (r.ok) {
        repo.upsertOrder(r.order);
        n++;
      }
    }
    say(`Confirmed ${n}`);
  };

  const storageKb = (() => {
    try {
      return Math.round((localStorage.getItem('cakeita.db.v1')?.length ?? 0) / 1024);
    } catch {
      return 0;
    }
  })();

  return (
    <div className="no-print fixed bottom-24 right-3 z-50">
      {open ? (
        <div className="max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto rounded-2xl border border-ink bg-white p-4 text-sm shadow-2xl" role="dialog" aria-label="Developer panel">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 font-bold">
              <IconWrench /> Developer panel
            </p>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close developer panel">
              ✕
            </button>
          </div>

          <fieldset className="space-y-2 border-t border-line pt-2">
            <legend className="font-bold">Customer flow</legend>
            <label className="block">
              Scenario
              <select className="input mt-1" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                {SCENARIOS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => fillCustomer(false)}>
                Fill + jump
              </button>
              <button type="button" className="btn-ghost" onClick={() => fillCustomer(true)}>
                Fill all (ready to send)
              </button>
              <button type="button" className="btn-ghost" onClick={() => { writeDraft(slugInPath, EMPTY_DRAFT); say('Draft cleared'); }}>
                Clear draft
              </button>
            </div>
          </fieldset>

          <fieldset className="mt-3 space-y-2 border-t border-line pt-2">
            <legend className="font-bold">Baker</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => { repo.setBakery(createSampleBakery()); say('Demo bakery loaded'); }}>
                Load demo bakery
              </button>
              <button type="button" className="btn-ghost" onClick={() => { const b = ensureBakery(); demoOrders(b).forEach((o) => repo.upsertOrder(o)); say('Demo orders added'); }}>
                + Demo board
              </button>
              <button type="button" className="btn-ghost" onClick={() => { const b = ensureBakery(); const s = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]!; repo.upsertOrder(scenarioOrder(b, s)); say(`New request: ${s.title}`); }}>
                + 1 request
              </button>
              <button type="button" className="btn-ghost" onClick={approveAll}>
                Approve all new
              </button>
              <button type="button" className="btn-ghost" onClick={confirmAll}>
                Confirm all quoted
              </button>
              <button type="button" className="btn-ghost" onClick={() => { repo.replaceAll({ ...repo.get(), orders: [] }); say('Orders cleared'); }}>
                Clear orders
              </button>
              <button type="button" className="btn-danger" onClick={() => { if (window.confirm('Reset ALL Cakeita data on this device?')) { repo.reset(); writeDraft('sample', EMPTY_DRAFT); say('Everything reset'); } }}>
                Reset all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => nav('/baker')}>
                → Baker
              </button>
              <button type="button" className="btn-ghost" onClick={() => nav('/b/sample')}>
                → Customer
              </button>
              <button type="button" className="btn-ghost" onClick={() => nav('/baker/board')}>
                → Board
              </button>
            </div>
          </fieldset>

          <fieldset className="mt-3 space-y-1 border-t border-line pt-2">
            <legend className="font-bold">Simulate</legend>
            {(
              [
                ['force2D', 'No WebGL (2D cake)'],
                ['aiOff', 'AI off (offline reader only)'],
                ['big', 'Elder mode (big text)'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" className="h-5 w-5" checked={prefs[k]} onChange={(e) => setPrefs({ [k]: e.target.checked })} />
                {label}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={prefs.lang === 'en'} onChange={(e) => setPrefs({ lang: e.target.checked ? 'en' : 'tl' })} />
              English
            </label>
          </fieldset>

          <div className="mt-3 border-t border-line pt-2 text-xs text-ink-soft">
            <p>Mode: {import.meta.env.MODE} · WebGL: {hasWebGL() ? 'yes' : 'no'} · AI route: {ai}</p>
            <p>
              Orders: {db.orders.length} · Bakery: {db.bakery?.slug ?? 'none'} · Storage: {storageKb} KB
            </p>
            <button type="button" className="btn-ghost mt-2" onClick={() => setPrefs({ dev: false })}>
              Turn off developer mode
            </button>
          </div>
          <p className="mt-2 min-h-5 font-bold text-ok-ink" aria-live="polite">
            {toast}
          </p>
        </div>
      ) : (
        <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-ink bg-white text-ink shadow-lg" onClick={() => setOpen(true)} aria-label="Open developer panel">
          <IconWrench size={22} />
        </button>
      )}
    </div>
  );
}
