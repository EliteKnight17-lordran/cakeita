import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { analyzeRequest, type Reading } from '../ai/client';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { Cake2D } from '../cake/Cake2D';
import { Layout } from '../components/Layout';
import { ShareBox } from '../components/ShareBox';
import { Bubble, Chip, Field, Notice, SampleBadge, Stepper } from '../components/ui';
import { buildDesigns, normalizeSelection, type DesignOption, type Wants } from '../domain/designs';
import { addDays, earliestDate } from '../domain/insights';
import { formatPeso } from '../domain/money';
import { requestToOrder } from '../domain/orders';
import { estimateFromMenu } from '../domain/pricing';
import { COLOR_WORDS } from '../domain/requestReader';
import { cakeRequestSchema } from '../domain/schemas';
import type { CakeRequest, PublicMenu, Selection } from '../domain/types';
import { toVisual } from '../domain/visual';
import { SCENARIOS } from '../data/demoScenarios';
import { clearDraft, STEPS, useDraft, type Draft, type Step } from '../data/draft';
import { newId, repo } from '../data/store';
import { resizeImage, type SmallImage } from '../lib/image';
import { linkErrorText } from '../lib/codec';
import { requestLink } from '../lib/links';
import { usePrefs, useTx } from '../lib/prefs';
import { useMenu } from './useMenu';

const OCCASIONS: Array<[string, string, string]> = [
  ['Birthday', 'Birthday', '🎂'],
  ['Debut', 'Debut', '👑'],
  ['Wedding', 'Kasal', '💍'],
  ['Christening', 'Binyag', '🕊️'],
  ['Anniversary', 'Anniversary', '💞'],
  ['Graduation', 'Graduation', '🎓'],
  ['Other', 'Iba pa', '✨'],
];

const Heading = forwardRef<HTMLHeadingElement, { children: ReactNode }>(function Heading({ children }, ref) {
  return (
    <h1 ref={ref} tabIndex={-1} className="font-display text-2xl font-bold leading-tight outline-none sm:text-3xl">
      {children}
    </h1>
  );
});

const PALETTE = COLOR_WORDS.map(([, name, hex]) => ({ name, hex }));

export function wantsFrom(draft: Draft): Wants {
  const r = draft.reading;
  return {
    servings: draft.servings ?? r?.servings ?? null,
    budget: draft.noBudget ? null : draft.budget ?? r?.budget ?? null,
    tiers: r?.tiers ?? null,
    sizeIn: r?.sizeIn ?? null,
    flavorId: r?.flavorId ?? null,
    coveringId: r?.coveringId ?? null,
    componentIds: r?.componentIds ?? [],
    textOnCake: r?.textOnCake ?? '',
  };
}

function lookFromReading(r: Reading | null, occasion: string) {
  return {
    colors: (r?.colors ?? []).slice(0, 2).map((c) => c.hex),
    textOnCake: r?.textOnCake ?? '',
    candles: r?.age ? Math.min(10, r.age) : occasion === 'Birthday' ? 1 : 0,
  };
}

export default function CustomerFlow() {
  const { slug = 'sample' } = useParams();
  const loc = useLocation();
  const code = new URLSearchParams(loc.search).get('m');
  const state = useMenu(slug, code);
  const tx = useTx();

  if (state.status === 'loading') {
    return (
      <Layout>
        <p className="py-20 text-center text-lg" aria-live="polite">
          {tx('Opening the bakery…', 'Binubuksan ang bakery…')}
        </p>
      </Layout>
    );
  }
  if (state.status === 'error') {
    return (
      <Layout>
        <div className="space-y-4 py-10">
          <Notice tone="warn" title={tx("We couldn't open this bakery link", 'Hindi mabuksan ang link ng bakery')}>
            {state.error === 'missing' || state.error === 'mismatch'
              ? tx('Ask the baker to send their full Cakeita link again.', 'Pakihingi ulit sa baker ang buong Cakeita link nila.')
              : linkErrorText(state.error, tx)}
          </Notice>
          <Link className="btn" to="/b/sample">
            {tx('Try the sample bakery', 'Subukan ang sample bakery')}
          </Link>
        </div>
      </Layout>
    );
  }
  return <Flow menu={state.menu} />;
}

function Flow({ menu }: { menu: PublicMenu }) {
  const tx = useTx();
  const prefs = usePrefs();
  const [draft, update] = useDraft(menu.slug);
  const [photo, setPhoto] = useState<SmallImage | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const today = useMemo(() => new Date(), []);
  const minDate = earliestDate(menu.leadTimeDays, today);
  const stepIndex = STEPS.indexOf(draft.step);

  // Move focus to the new question for screen readers and keyboard users.
  useEffect(() => {
    headingRef.current?.focus();
    setError('');
  }, [draft.step]);

  const go = (step: Step) => update({ step });
  const back = () => go(STEPS[Math.max(0, stepIndex - 1)]!);

  const wants = wantsFrom(draft);
  const designs = useMemo(() => buildDesigns(menu, wants), [menu, JSON.stringify(wants)]); // eslint-disable-line react-hooks/exhaustive-deps
  const selection = draft.selection ?? designs.options.find((o) => o.tier === draft.tier)?.selection ?? designs.options[0]?.selection ?? null;
  const estimate = selection ? estimateFromMenu(menu, selection) : null;
  const visual = selection ? toVisual(menu, selection, draft.look) : null;
  const colorNames = draft.look.colors.map((h) => PALETTE.find((p) => p.hex === h)?.name ?? '').filter(Boolean);
  const description = visual ? describeCake(visual, prefs.lang, colorNames) : '';

  const runReading = async (text: string, nextStep: Step, prefill = false) => {
    setBusy(true);
    try {
      const reading = await analyzeRequest(text, menu, {
        image: photo ? { mimeType: photo.mimeType, base64: photo.base64 } : null,
        allowAi: !prefs.aiOff,
      });
      update((d) => {
        const occasion = d.occasion || reading.occasion;
        return {
          description: text,
          reading,
          occasion: prefill ? reading.occasion || d.occasion : occasion,
          servings: prefill ? reading.servings ?? d.servings : d.servings,
          budget: prefill ? reading.budget ?? d.budget : d.budget,
          eventDate: prefill && reading.eventDate && reading.eventDate >= minDate ? reading.eventDate : d.eventDate,
          look: lookFromReading(reading, occasion),
          selection: null,
          tier: 'classic',
          step: nextStep,
        };
      });
    } finally {
      setBusy(false);
    }
  };

  const pickDesign = (o: DesignOption) => update({ tier: o.tier, selection: o.selection });

  const submit = async () => {
    if (!selection) return;
    if (!draft.name.trim() || draft.contact.trim().length < 5) {
      setError(tx('Please add your name and a way to reach you.', 'Pakilagay ang pangalan mo at paano ka makokontak.'));
      return;
    }
    if (!draft.consent) {
      setError(tx('Please tick the box so we can send this to the baker.', 'Pakicheck ang box para maipadala namin ito sa baker.'));
      return;
    }
    const servings = wants.servings ?? menu.baseCakes.find((b) => b.id === selection.baseCakeId)?.servings ?? 1;
    const req: CakeRequest = {
      id: newId('rq'),
      bakerySlug: menu.slug,
      createdAt: new Date().toISOString(),
      customer: { name: draft.name.trim().slice(0, 80), contact: draft.contact.trim().slice(0, 120) },
      occasion: (draft.occasion || draft.reading?.occasion || 'Other').slice(0, 40),
      eventDate: draft.eventDate || minDate,
      servings: Math.max(1, Math.min(500, Math.round(servings))),
      budget: wants.budget,
      description: [draft.description, draft.note && `Note: ${draft.note}`].filter(Boolean).join('\n').slice(0, 1000),
      tier: draft.selection && designs.options.every((o) => JSON.stringify(o.selection) !== JSON.stringify(draft.selection)) ? 'custom' : draft.tier,
      selection: normalizeSelection(menu, selection).selection,
      look: { ...draft.look, textOnCake: draft.look.textOnCake.slice(0, 40) },
      theme: (draft.reading?.theme ?? '').slice(0, 60),
      licensedNote: (draft.reading?.licensedNote ?? '').slice(0, 240),
      unavailable: (draft.reading?.unavailable ?? []).slice(0, 20),
      estimate: menu.showEstimates ? estimate : null,
      hasInspoPhoto: !!photo,
      lang: prefs.lang,
    };
    const valid = cakeRequestSchema.safeParse(req);
    if (!valid.success) {
      setError(tx('Something is missing. Please check your answers.', 'May kulang pa. Pakicheck ang mga sagot mo.'));
      return;
    }
    const link = await requestLink(req);
    const lines = [
      tx(`Hi ${menu.name}! Cake request from ${req.customer.name}:`, `Hi ${menu.name}! Cake request po mula kay ${req.customer.name}:`),
      `• ${req.occasion}, ${req.eventDate}, ${tx('for', 'para sa')} ${req.servings} ${tx('people', 'tao')}`,
      `• ${description}`,
      req.budget != null ? `• Budget: ${formatPeso(req.budget)}` : '',
      req.estimate != null ? `• ${tx('Estimate in the app', 'Tantya sa app')}: ${formatPeso(req.estimate)}` : '',
      photo ? tx('• I will send my inspo photo here too.', '• Ise-send ko rin dito ang inspo photo ko.') : '',
      tx('Open my request:', 'Buksan ang request ko:'),
    ].filter(Boolean);
    const message = lines.join('\n');
    repo.addMyRequest({ id: req.id, bakerySlug: menu.slug, bakeryName: menu.name, createdAt: req.createdAt, summary: description, requestLink: link, status: 'sent' });
    // Same device as the baker (demo laptop or a baker testing their own link): drop it straight in the inbox.
    const own = repo.get().bakery;
    if (own && own.slug === menu.slug) repo.upsertOrder(requestToOrder(req, 'same-device'));
    update({ sentId: req.id, sentLink: link, sentMessage: message, step: 'done' });
  };

  const header = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{tx('Cake request for', 'Cake request para sa')}</p>
        <p className="font-display text-xl font-bold">{menu.name}</p>
      </div>
      <SampleBadge show={menu.isSample} text={tx('Sample bakery, demo data', 'Sample bakery, demo data')} />
    </div>
  );

  const nav = (canNext: boolean, onNext: () => void, nextLabel = tx('Next', 'Sunod')) => (
    <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/95 p-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-2">
        {stepIndex > 0 && (
          <button type="button" className="btn-secondary" onClick={back}>
            ← {tx('Back', 'Bumalik')}
          </button>
        )}
        <button type="button" className="btn flex-1" disabled={!canNext || busy} onClick={onNext}>
          {busy ? tx('Reading…', 'Binabasa…') : nextLabel}
        </button>
      </div>
    </div>
  );

  const total = STEPS.length - 2;
  const stepper = stepIndex > 0 && draft.step !== 'done' && <Stepper step={stepIndex} total={total} label={tx('Your cake request', 'Ang cake request mo')} />;

  // ---------------- steps ----------------
  let body: ReactNode = null;
  let footer: ReactNode = null;

  switch (draft.step) {
    case 'welcome': {
      body = (
        <div className="space-y-5">
          <Heading ref={headingRef}>{tx("Let's find a cake that fits your budget", 'Hanapin natin ang cake na pasok sa budget mo')}</Heading>
          <Bubble from="app">
            {tx(
              "Answer a few quick questions. You'll see 3 cake designs you can turn around in 3D, with an estimated price. The baker confirms the final price.",
              'Sagutin lang ang ilang tanong. Makikita mo ang 3 cake design na puwede mong ikutin sa 3D, may tantyang presyo. Ang baker ang magko-confirm ng final na presyo.',
            )}
          </Bubble>
          <div className="card space-y-3">
            <p className="font-bold">{tx('Already wrote a message? Paste it here and we fill in the rest.', 'May message ka na? I-paste dito at kami na ang bahala.')}</p>
            <label htmlFor="paste" className="sr-only">
              {tx('Your message', 'Ang message mo')}
            </label>
            <textarea
              id="paste"
              className="input min-h-28"
              placeholder={tx('e.g. 2 tier pink cake for 30 pax, budget 2.5k, Dec 12', 'hal. 2 tier pink cake, 30 pax, budget 2.5k, Dec 12')}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={2000}
            />
            <button type="button" className="btn-secondary w-full" disabled={!draft.description.trim() || busy} onClick={() => runReading(draft.description, 'occasion', true)}>
              {busy ? tx('Reading…', 'Binabasa…') : tx('Read my message', 'Basahin ang message ko')}
            </button>
            {menu.isSample && (
              <div>
                <p className="hint mb-2">{tx('Or try a sample message:', 'O subukan ang sample na message:')}</p>
                <div className="flex flex-wrap gap-2">
                  {SCENARIOS.slice(0, 4).map((s) => (
                    <button key={s.key} type="button" className="btn-ghost" onClick={() => update({ description: s.message })}>
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-ink-soft">
            {tx('Free to use. No payment happens here. Your photo is never saved.', 'Libre. Walang bayaran dito. Hindi sine-save ang photo mo.')}
          </p>
        </div>
      );
      footer = nav(true, () => go('occasion'), tx('Start', 'Simulan'));
      break;
    }
    case 'occasion': {
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx("What's the occasion?", 'Para saan ang cake?')}</Heading>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Occasion', 'Okasyon')}>
            {OCCASIONS.map(([en, tl, icon]) => (
              <Chip key={en} pressed={draft.occasion === en} onClick={() => update({ occasion: en, look: { ...draft.look, candles: en === 'Birthday' ? draft.look.candles || 1 : draft.look.candles } })}>
                <span aria-hidden="true">{icon}</span> {tx(en, tl)}
              </Chip>
            ))}
          </div>
        </div>
      );
      footer = nav(!!draft.occasion, () => go('date'));
      break;
    }
    case 'date': {
      const tooSoon = !!draft.eventDate && draft.eventDate < minDate;
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('When do you need it?', 'Kailan kailangan?')}</Heading>
          <Field id="date" label={tx('Date', 'Petsa')} hint={tx(`${menu.name} needs at least ${menu.leadTimeDays} days' notice.`, `Kailangan ng ${menu.name} ng ${menu.leadTimeDays} araw na abiso.`)}>
            <input id="date" type="date" className="input" min={minDate} max={addDays(today, 365)} value={draft.eventDate} onChange={(e) => update({ eventDate: e.target.value })} aria-describedby="date-hint" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[menu.leadTimeDays, 7, 14].map((d, i) => {
              const day = addDays(today, Math.max(d, menu.leadTimeDays));
              return (
                <button key={i} type="button" className="btn-ghost" onClick={() => update({ eventDate: day })}>
                  {new Date(`${day}T00:00:00`).toLocaleDateString(prefs.lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                </button>
              );
            })}
          </div>
          {tooSoon && <Notice tone="warn">{tx('That is too soon for this baker. Please pick a later date.', 'Masyadong maaga para sa baker. Pumili ng mas huling petsa.')}</Notice>}
        </div>
      );
      footer = nav(!!draft.eventDate && !tooSoon, () => go('servings'));
      break;
    }
    case 'servings': {
      const opts = [8, 12, 20, 30, 45];
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('How many people will eat?', 'Ilan ang kakain?')}</Heading>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Number of people', 'Bilang ng tao')}>
            {opts.map((n) => (
              <Chip key={n} pressed={draft.servings === n} onClick={() => update({ servings: n })}>
                {n} {tx('people', 'tao')}
              </Chip>
            ))}
          </div>
          <Field id="servings" label={tx('Or type a number', 'O i-type ang bilang')}>
            <input id="servings" type="number" inputMode="numeric" min={1} max={500} className="input" value={draft.servings ?? ''} onChange={(e) => update({ servings: e.target.value ? Math.max(1, Math.min(500, Number(e.target.value))) : null })} />
          </Field>
        </div>
      );
      footer = nav(!!draft.servings && draft.servings > 0, () => go('budget'));
      break;
    }
    case 'budget': {
      const opts = [800, 1500, 2500, 4000];
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx("What's your budget?", 'Magkano ang budget mo?')}</Heading>
          <Bubble from="app">{tx("So we can design a cake that fits. It's okay if you're not sure.", 'Para makagawa kami ng design na pasok sa budget mo. Okay lang kung hindi ka pa sigurado.')}</Bubble>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Budget">
            {opts.map((n) => (
              <Chip key={n} pressed={!draft.noBudget && draft.budget === n} onClick={() => update({ budget: n, noBudget: false })}>
                {formatPeso(n)}
              </Chip>
            ))}
            <Chip pressed={draft.noBudget} onClick={() => update({ noBudget: !draft.noBudget })}>
              {tx('No budget yet', 'Wala pa akong budget')}
            </Chip>
          </div>
          {!draft.noBudget && (
            <Field id="budget" label={tx('Or type an amount (₱)', 'O i-type ang halaga (₱)')}>
              <input id="budget" type="number" inputMode="numeric" min={100} max={500000} step={50} className="input" value={draft.budget ?? ''} onChange={(e) => update({ budget: e.target.value ? Math.max(0, Math.min(500000, Number(e.target.value))) : null })} />
            </Field>
          )}
        </div>
      );
      footer = nav(draft.noBudget || (draft.budget ?? 0) >= 100, () => go('describe'));
      break;
    }
    case 'describe': {
      const r = draft.reading;
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('Describe your dream cake', 'Ilarawan ang gusto mong cake')}</Heading>
          <Field id="desc" label={tx('Colors, flavor, design, words on the cake (Taglish OK)', 'Kulay, flavor, design, nakasulat sa cake (Taglish OK)')} hint={tx('Example: ube, pastel pink, fresh flowers, "Happy 80th Lola"', 'Halimbawa: ube, pastel pink, may bulaklak, "Happy 80th Lola"')}>
            <textarea id="desc" className="input min-h-32" maxLength={2000} value={draft.description} onChange={(e) => update({ description: e.target.value })} aria-describedby="desc-hint" />
          </Field>
          <div className="card space-y-2">
            <p className="font-bold">{tx('Inspo photo (optional)', 'Inspo photo (optional)')}</p>
            <input
              id="photo"
              type="file"
              accept="image/*"
              className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-berry-soft file:px-4 file:font-bold file:text-berry-dark"
              aria-label={tx('Choose an inspo photo', 'Pumili ng inspo photo')}
              onChange={async (e) => {
                setPhotoError('');
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setPhoto(await resizeImage(f));
                } catch {
                  setPhotoError(tx("We couldn't open that photo. Try a screenshot of it instead.", 'Hindi mabuksan ang photo. Subukan ang screenshot nito.'));
                }
              }}
            />
            {photo && (
              <div className="flex items-center gap-3">
                <img src={photo.dataUrl} alt={tx('Your inspo photo', 'Ang inspo photo mo')} className="h-24 w-24 rounded-2xl object-cover" />
                <button type="button" className="btn-ghost" onClick={() => setPhoto(null)}>
                  {tx('Remove', 'Alisin')}
                </button>
              </div>
            )}
            {photoError && <Notice tone="warn">{photoError}</Notice>}
            <p className="hint">{tx('Your photo stays on your phone unless smart reading is on. It is never saved.', 'Nasa phone mo lang ang photo maliban kung naka-on ang smart reading. Hindi ito sine-save.')}</p>
          </div>
          {r && r.found.length > 0 && <ReadSummary reading={r} menu={menu} />}
        </div>
      );
      footer = nav(true, () => runReading(draft.description, 'designs'), draft.description.trim() || photo ? tx('Show me designs', 'Ipakita ang designs') : tx('Surprise me', 'Kayo na ang bahala'));
      break;
    }
    case 'designs': {
      const r = draft.reading;
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('Pick a design', 'Pumili ng design')}</Heading>
          {r?.aiNote === 'photo-not-read' && <Notice tone="info">{tx('We could not read your photo automatically. Please describe it in words, and send the photo to the baker too.', 'Hindi namin nabasa ang photo. Ilarawan mo sa salita, at i-send din ang photo sa baker.')}</Notice>}
          {r && <ReadSummary reading={r} menu={menu} compact />}
          {designs.budgetTooLow && wants.budget != null && (
            <Notice tone="warn" title={tx('Your budget is a bit low for this many people', 'Medyo kulang ang budget para sa ganitong dami')}>
              {tx(`The simplest cake that feeds ${wants.servings ?? 'everyone'} starts at about ${formatPeso(designs.lowestPrice)}. You can pick fewer people or ask the baker.`, `Ang pinakasimpleng cake para sa ${wants.servings ?? 'lahat'} ay mga ${formatPeso(designs.lowestPrice)}. Puwedeng bawasan ang tao o itanong sa baker.`)}
            </Notice>
          )}
          {visual && <CakeView visual={visual} description={description} />}
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={tx('Designs', 'Mga design')}>
            {designs.options.map((o) => (
              <DesignCard key={o.tier} option={o} menu={menu} look={draft.look} selected={JSON.stringify(selection) === JSON.stringify(o.selection)} onPick={() => pickDesign(o)} budget={wants.budget} />
            ))}
          </div>
        </div>
      );
      footer = nav(!!selection, () => {
        if (!draft.selection && selection) update({ selection, step: 'customize' });
        else go('customize');
      }, tx('Customize this', 'I-customize ito'));
      break;
    }
    case 'customize': {
      body = selection && visual ? (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('Make it yours', 'Gawin mong sa iyo')}</Heading>
          <CakeView visual={visual} description={description} />
          <PriceBar menu={menu} estimate={estimate} budget={wants.budget} />
          <Customizer menu={menu} selection={selection} look={draft.look} servings={wants.servings} onChange={(sel, look) => update({ selection: sel, look })} />
        </div>
      ) : null;
      footer = nav(!!selection, () => go('contact'));
      break;
    }
    case 'contact': {
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('Where can the baker reach you?', 'Saan ka makokontak ng baker?')}</Heading>
          <Field id="name" label={tx('Your name', 'Pangalan mo')}>
            <input id="name" className="input" autoComplete="name" maxLength={80} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field id="contact" label={tx('Messenger name or mobile number', 'Messenger name o mobile number')}>
            <input id="contact" className="input" autoComplete="tel" maxLength={120} value={draft.contact} onChange={(e) => update({ contact: e.target.value })} />
          </Field>
          <Field id="note" label={tx('Anything else? (optional)', 'May iba pa? (optional)')}>
            <textarea id="note" className="input min-h-20" maxLength={300} value={draft.note} onChange={(e) => update({ note: e.target.value })} />
          </Field>
          <label className="flex items-start gap-3 rounded-2xl border-2 border-line bg-white p-3">
            <input type="checkbox" className="mt-1 h-6 w-6 accent-[#b3164f]" checked={draft.consent} onChange={(e) => update({ consent: e.target.checked })} />
            <span>
              {tx(
                'I agree to send my name, contact and this request to the baker. No payment happens in Cakeita.',
                'Pumapayag ako na ipadala ang pangalan, contact at request na ito sa baker. Walang bayaran sa Cakeita.',
              )}
            </span>
          </label>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      );
      footer = nav(true, submit, tx('Send to baker', 'Ipadala sa baker'));
      break;
    }
    case 'done': {
      body = (
        <div className="space-y-4">
          <Heading ref={headingRef}>{tx('Done! Now send it to the baker', 'Ayos! Ipadala na sa baker')}</Heading>
          <Bubble from="app">
            {tx(
              `Tap Send and choose Messenger. ${menu.name} will check it and send you the final price. This is not an order yet.`,
              `I-tap ang Ipadala at piliin ang Messenger. Titingnan ito ng ${menu.name} at ipapadala ang final na presyo. Hindi pa ito order.`,
            )}
          </Bubble>
          {visual && <CakeView visual={visual} description={description} interactive={false} />}
          {draft.sentLink && draft.sentMessage && (
            <ShareBox url={draft.sentLink} message={draft.sentMessage} title={tx('Cake request', 'Cake request')} contact={menu.contact} qrLabel={tx('QR code of your request for the baker to scan', 'QR code ng request mo para i-scan ng baker')} />
          )}
          {menu.contact && <p className="text-center text-sm text-ink-soft">{tx('Baker contact', 'Contact ng baker')}: {menu.contact}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            {draft.sentId && (
              <Link className="btn-ghost" to={`/o/${draft.sentId}`}>
                {tx('Check status', 'Tingnan ang status')}
              </Link>
            )}
            <button type="button" className="btn-ghost" onClick={() => { setPhoto(null); clearDraft(menu.slug); }}>
              {tx('Start a new request', 'Bagong request')}
            </button>
          </div>
        </div>
      );
      break;
    }
  }

  return (
    <Layout>
      {header}
      {stepper}
      {body}
      {footer}
    </Layout>
  );
}

function ReadSummary({ reading: r, menu, compact = false }: { reading: Reading; menu: PublicMenu; compact?: boolean }) {
  const tx = useTx();
  const name = (id: string) => {
    const c = menu.components.find((x) => x.id === id);
    return c ? tx(c.name, c.nameTl ?? c.name) : id;
  };
  const bits: string[] = [];
  if (r.occasion) bits.push(r.occasion);
  if (r.servings) bits.push(`${r.servings} ${tx('people', 'tao')}`);
  if (r.budget) bits.push(`budget ${formatPeso(r.budget)}`);
  if (r.tiers) bits.push(`${r.tiers} tier`);
  if (r.flavorId) bits.push(name(r.flavorId));
  if (r.coveringId) bits.push(name(r.coveringId));
  r.componentIds.forEach((id) => bits.push(name(id)));
  r.colors.forEach((c) => bits.push(c.name));
  if (r.theme) bits.push(`${tx('theme', 'tema')}: ${r.theme}`);
  if (r.textOnCake) bits.push(`"${r.textOnCake}"`);
  return (
    <div className="space-y-2">
      {bits.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-3">
          <p className="text-sm font-bold text-ink-soft">
            {tx('What we understood', 'Ang naintindihan namin')}
            {r.usedAi ? ' (smart reading)' : ''}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {bits.map((b, i) => (
              <li key={i} className="tag bg-berry-soft text-berry-dark">
                {b}
              </li>
            ))}
          </ul>
          {!compact && r.summary && <p className="mt-2 text-sm">{r.summary}</p>}
        </div>
      )}
      {r.unavailable.length > 0 && (
        <Notice tone="warn" title={tx('This baker does not make:', 'Hindi ito ginagawa ng baker:')}>
          {r.unavailable.join(', ')}. {tx('We used the closest options instead.', 'Pinalitan namin ng pinakamalapit na option.')}
        </Notice>
      )}
      {r.licensedNote && (
        <Notice tone="info" title={tx('About characters', 'Tungkol sa character')}>
          {tx('We design a generic theme. Ask the baker about a licensed topper or toy for the character.', 'Generic na tema ang design. Itanong sa baker ang licensed topper o laruan para sa character.')}
        </Notice>
      )}
    </div>
  );
}

function DesignCard({ option, menu, look, selected, onPick, budget }: { option: DesignOption; menu: PublicMenu; look: Draft['look']; selected: boolean; onPick: () => void; budget: number | null }) {
  const tx = useTx();
  const prefs = usePrefs();
  const v = toVisual(menu, option.selection, look);
  const label = { simple: tx('Simple', 'Simple'), classic: tx('Classic', 'Classic'), showstopper: tx('Showstopper', 'Showstopper') }[option.tier];
  const base = menu.baseCakes.find((b) => b.id === option.selection.baseCakeId);
  const parts = option.selection.componentIds.map((id) => menu.components.find((c) => c.id === id)).filter((c) => !!c && c.category !== 'flavor');
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} className={`card text-left transition ${selected ? 'border-2 border-berry ring-4 ring-berry-soft' : 'hover:border-berry'}`}>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold">{label}</span>
        {selected && <span className="tag bg-berry text-white">✓ {tx('Picked', 'Napili')}</span>}
      </div>
      <Cake2D visual={v} title={describeCake(v, prefs.lang)} className="my-2 h-28 w-full" />
      <p className="text-sm text-ink-soft">
        {base?.sizeLabel} · {tx('feeds', 'pang')} {option.servings}
      </p>
      <p className="text-sm">{parts.map((p) => p!.name).join(', ')}</p>
      {menu.showEstimates ? (
        <p className="mt-2">
          <span className="text-sm text-ink-soft">{tx('About', 'Mga')} </span>
          <span className="price text-2xl">{formatPeso(option.estimate)}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm font-semibold">{tx('Baker will give the price', 'Ang baker ang magbibigay ng presyo')}</p>
      )}
      {budget != null && menu.showEstimates && (
        <span className={`tag mt-1 ${option.overBudget ? 'bg-amber-bg text-amber-ink' : 'bg-ok-bg text-ok-ink'}`}>
          {option.overBudget ? tx('Over budget', 'Lampas sa budget') : tx('Fits budget', 'Pasok sa budget')}
        </span>
      )}
      {option.servingsShort && <p className="mt-1 text-sm font-semibold text-amber-ink">{tx('Not enough for everyone. Ask the baker for cupcakes on the side.', 'Kulang para sa lahat. Itanong sa baker kung may cupcakes.')}</p>}
    </button>
  );
}

function PriceBar({ menu, estimate, budget }: { menu: PublicMenu; estimate: number | null; budget: number | null }) {
  const tx = useTx();
  if (!menu.showEstimates || estimate == null) {
    return <Notice tone="info">{tx('The baker will send you the price after checking.', 'Ipapadala ng baker ang presyo pagkatapos i-check.')}</Notice>;
  }
  const over = budget != null && estimate > budget;
  return (
    <div className="card flex items-center justify-between gap-3" aria-live="polite">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{tx('Estimated price', 'Tantyang presyo')}</p>
        <p className="price">{formatPeso(estimate)}</p>
        <p className="text-xs text-ink-soft">{tx('Final price is confirmed by the baker.', 'Ang baker ang magko-confirm ng final na presyo.')}</p>
      </div>
      {budget != null && (
        <span className={`tag ${over ? 'bg-amber-bg text-amber-ink' : 'bg-ok-bg text-ok-ink'}`}>
          {over ? `+${formatPeso(estimate - budget)} ${tx('over', 'lampas')}` : tx('Fits budget', 'Pasok sa budget')}
        </span>
      )}
    </div>
  );
}

export function Customizer({ menu, selection, look, servings, onChange, showPrices }: { menu: PublicMenu; selection: Selection; look: Draft['look']; servings: number | null; onChange: (s: Selection, l: Draft['look']) => void; showPrices?: boolean }) {
  const tx = useTx();
  const prices = showPrices ?? menu.showEstimates;
  const byCat = (c: string) => menu.components.filter((x) => x.category === c);
  const has = (id: string) => selection.componentIds.includes(id);
  const base = menu.baseCakes.find((b) => b.id === selection.baseCakeId) ?? menu.baseCakes[0]!;
  const delta = (id: string) => {
    const c = menu.components.find((x) => x.id === id);
    if (!c) return 0;
    return Math.round(c.p * (c.scales ? base.scale : 1));
  };
  const setOne = (cat: string, id: string) => {
    const others = selection.componentIds.filter((x) => menu.components.find((c) => c.id === x)?.category !== cat);
    onChange({ ...selection, componentIds: [...others, id] }, look);
  };
  const toggle = (id: string) => onChange({ ...selection, componentIds: has(id) ? selection.componentIds.filter((x) => x !== id) : [...selection.componentIds, id] }, look);
  const textPart = menu.components.find((c) => c.visual === 'text');
  const acrylic = menu.components.find((c) => c.visual === 'acrylic');
  const candlePart = menu.components.find((c) => c.visual === 'candles');
  const extras = menu.components.filter((c) => ['decoration', 'finish'].includes(c.category) || (c.category === 'topper' && c.visual === 'figure'));
  const swatch = (slot: 0 | 1) => (
    <div role="group" aria-label={slot === 0 ? tx('Main color', 'Pangunahing kulay') : tx('Accent color', 'Pangalawang kulay')} className="flex flex-wrap gap-2">
      {PALETTE.map((p) => {
        const on = look.colors[slot] === p.hex;
        return (
          <button
            key={p.name}
            type="button"
            aria-pressed={on}
            aria-label={p.name}
            title={p.name}
            onClick={() => {
              const colors = [...look.colors];
              colors[slot] = p.hex;
              if (slot === 1 && !colors[0]) colors[0] = '#fbf1e4';
              onChange(selection, { ...look, colors: colors.filter(Boolean).slice(0, 2) });
            }}
            className={`h-11 w-11 rounded-full border-2 ${on ? 'border-berry ring-4 ring-berry-soft' : 'border-line'}`}
            style={{ background: p.hex }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <section>
        <h2 className="label">{tx('Size', 'Laki')}</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tx('Size', 'Laki')}>
          {menu.baseCakes.map((b) => {
            const short = servings != null && b.servings < servings;
            return (
              <button key={b.id} type="button" role="radio" aria-checked={b.id === selection.baseCakeId} onClick={() => onChange({ ...selection, baseCakeId: b.id }, look)} className={`chip justify-between ${b.id === selection.baseCakeId ? 'border-berry bg-berry-soft' : ''}`}>
                <span>
                  {b.name} <span className="text-sm text-ink-soft">· {tx('feeds', 'pang')} {b.servings}</span>
                </span>
                {short && <span className="text-xs text-amber-ink">{tx('small', 'kulang')}</span>}
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="label">Flavor</h2>
        <div className="flex flex-wrap gap-2">
          {byCat('flavor').map((c) => (
            <Chip key={c.id} pressed={has(c.id)} onClick={() => setOne('flavor', c.id)}>
              <span aria-hidden="true" className="h-4 w-4 rounded-full border border-line" style={{ background: c.color }} /> {c.name}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h2 className="label">{tx('Frosting', 'Frosting')}</h2>
        <div className="flex flex-wrap gap-2">
          {byCat('covering').map((c) => (
            <Chip key={c.id} pressed={has(c.id)} onClick={() => setOne('covering', c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h2 className="label">{tx('Colors', 'Kulay')}</h2>
        <p className="hint mb-2">{tx('Main', 'Pangunahin')}</p>
        {swatch(0)}
        <p className="hint mb-2 mt-3">{tx('Accent', 'Pangalawa')}</p>
        {swatch(1)}
      </section>
      <section>
        <h2 className="label">{tx('Decorations', 'Dekorasyon')}</h2>
        <div className="flex flex-wrap gap-2">
          {extras.map((c) => (
            <Chip key={c.id} pressed={has(c.id)} onClick={() => toggle(c.id)}>
              {tx(c.name, c.nameTl ?? c.name)}
              {prices && <span className="text-sm text-ink-soft">+{formatPeso(delta(c.id))}</span>}
            </Chip>
          ))}
        </div>
      </section>
      {(textPart || acrylic) && (
        <section className="space-y-2">
          <Field id="cake-text" label={tx('Words on the cake', 'Nakasulat sa cake')} hint={tx('Up to 32 letters', 'Hanggang 32 letra')}>
            <input
              id="cake-text"
              className="input"
              maxLength={32}
              value={look.textOnCake}
              onChange={(e) => {
                const t = e.target.value;
                let ids = selection.componentIds;
                const hasTextPart = ids.some((id) => id === textPart?.id || id === acrylic?.id);
                if (t.trim() && !hasTextPart && textPart) ids = [...ids, textPart.id];
                if (!t.trim()) ids = ids.filter((id) => id !== textPart?.id && id !== acrylic?.id);
                onChange({ ...selection, componentIds: ids }, { ...look, textOnCake: t });
              }}
            />
          </Field>
          {look.textOnCake.trim() && !selection.componentIds.some((id) => id === textPart?.id || id === acrylic?.id) && (
            <Notice tone="warn">{tx('Pick how to put the words on the cake, or they will not be included.', 'Pumili kung paano ilalagay ang sulat, kundi hindi ito kasama.')}</Notice>
          )}
          <div className="flex flex-wrap gap-2">
            {[textPart, acrylic].filter((c) => !!c).map((c) => (
              <Chip key={c!.id} pressed={has(c!.id)} onClick={() => {
                const ids = selection.componentIds.filter((id) => id !== textPart?.id && id !== acrylic?.id);
                onChange({ ...selection, componentIds: has(c!.id) ? ids : [...ids, c!.id] }, look);
              }}>
                {tx(c!.name, c!.nameTl ?? c!.name)}
                {prices && <span className="text-sm text-ink-soft">+{formatPeso(delta(c!.id))}</span>}
              </Chip>
            ))}
          </div>
        </section>
      )}
      {candlePart && (
        <section>
          <h2 className="label" id="candles-label">{tx('Candles', 'Kandila')}</h2>
          <div className="flex items-center gap-3" role="group" aria-labelledby="candles-label">
            <button type="button" className="btn-ghost text-xl" aria-label={tx('Fewer candles', 'Bawasan ang kandila')} onClick={() => {
              const n = Math.max(0, look.candles - 1);
              const ids = n === 0 ? selection.componentIds.filter((id) => id !== candlePart.id) : selection.componentIds;
              onChange({ ...selection, componentIds: ids }, { ...look, candles: n });
            }}>
              −
            </button>
            <span className="min-w-8 text-center text-xl font-bold" aria-live="polite">
              {has(candlePart.id) ? look.candles || 1 : 0}
            </span>
            <button type="button" className="btn-ghost text-xl" aria-label={tx('More candles', 'Dagdagan ang kandila')} onClick={() => {
              const n = Math.min(10, (has(candlePart.id) ? look.candles || 1 : 0) + 1);
              const ids = has(candlePart.id) ? selection.componentIds : [...selection.componentIds, candlePart.id];
              onChange({ ...selection, componentIds: ids }, { ...look, candles: n });
            }}>
              +
            </button>
            {prices && <span className="text-sm text-ink-soft">+{formatPeso(delta(candlePart.id))}</span>}
          </div>
        </section>
      )}
    </div>
  );
}
