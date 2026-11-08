import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { aiAvailable, analyzeRequest, type Reading } from '../ai/client';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { Cake2D } from '../cake/Cake2D';
import { MotifIcon } from '../cake/MotifIcon';
import { Layout } from '../components/Layout';
import { IconArrow, IconCamera, IconCheck, IconChevron, IconPin, IconSparkle } from '../components/icons';
import { ShareBox } from '../components/ShareBox';
import { Bubble, Chip, Field, Notice, SampleBadge } from '../components/ui';
import { leftOut, normalizeSelection, type DesignOption } from '../domain/designs';
import { addDays, earliestDate } from '../domain/insights';
import { formatPeso } from '../domain/money';
import { MOTIF_KEYS, MOTIFS } from '../domain/motifs';
import { requestToOrder } from '../domain/orders';
import { estimateFromMenu } from '../domain/pricing';
import { COLOR_WORDS } from '../domain/requestReader';
import { cakeRequestSchema } from '../domain/schemas';
import type { CakeRequest, PublicMenu, Selection } from '../domain/types';
import { toVisual } from '../domain/visual';
import { SCENARIOS } from '../data/demoScenarios';
import { clearDraft, useDraft, type Draft } from '../data/draft';
import { newId, repo } from '../data/store';
import { resizeImage, type SmallImage } from '../lib/image';
import { linkErrorText } from '../lib/codec';
import { requestLink } from '../lib/links';
import { usePrefs, useTx } from '../lib/prefs';
import { celebrate } from '../lib/celebrate';
import { cloudEnabled } from '../cloud/config';
import { useMedia } from '../lib/useMedia';
import { MiniCake } from './MiniCake';
import { currentCake, offlineReading } from './customerCake';
import { useMenu } from './useMenu';

const OCCASIONS: Array<[string, string]> = [
  ['Birthday', 'Birthday'],
  ['Debut', 'Debut'],
  ['Wedding', 'Kasal'],
  ['Christening', 'Binyag'],
  ['Anniversary', 'Anniversary'],
  ['Graduation', 'Graduation'],
  ['Other', 'Iba pa'],
];

/** Numbered section heading: a small "01" eyebrow over a serif title. */
function SectionTitle({ id, n, children, sub }: { id: string; n: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <p className="eyebrow" aria-hidden="true">
        {n}
      </p>
      <h2 id={id} className="mt-0.5 text-xl leading-snug">
        {children}
      </h2>
      {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

const PALETTE = COLOR_WORDS.map(([, name, hex]) => ({ name, hex }));

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
  const [errors, setErrors] = useState<Partial<Record<'date' | 'name' | 'contact' | 'consent' | 'form', string>>>({});
  const [smartAvailable, setSmartAvailable] = useState(false);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const cakeRef = useRef<HTMLDivElement>(null);
  const wide = useMedia('(min-width: 1024px)');
  const today = useMemo(() => new Date(), []);
  const minDate = earliestDate(menu.leadTimeDays, today);

  useEffect(() => {
    if (!prefs.aiOff) aiAvailable().then(setSmartAvailable).catch(() => setSmartAvailable(false));
  }, [prefs.aiOff]);

  // Live reading: the offline Taglish reader runs on every keystroke (fast, no network).
  const liveReading = useMemo(() => offlineReading(draft.description, menu), [draft.description, menu]);
  const cake = currentCake(menu, draft, today, liveReading);
  const { reading, hasText, occasion, eventDate, wants, look, designs, selection, isCustom } = cake;
  const wantsKey = JSON.stringify(wants);
  const estimate = selection ? estimateFromMenu(menu, selection) : null;
  const visual = selection ? toVisual(menu, selection, look) : null;
  const missingBase = selection ? leftOut(menu, wants, selection) : null;
  // The design that keeps the most of what they asked for, to offer when the current one drops things.
  const fullest = designs.options
    .map((o) => ({ o, n: leftOut(menu, wants, o.selection).parts.length }))
    .sort((a, b) => a.n - b.n || a.o.estimate - b.o.estimate)[0];
  const colorNames = look.colors.map((h) => PALETTE.find((p) => p.hex === h)?.name ?? '').filter(Boolean);
  // Semi-naked cakes have no frosting to color, so say so instead of quietly dropping the color.
  const missing = missingBase && visual?.covering === 'naked' && colorNames.length
    ? { ...missingBase, parts: [...missingBase.parts, tx(`${colorNames.join(' and ')} frosting (semi-naked has none)`, `${colorNames.join(' at ')} na frosting (walang frosting ang semi-naked)`)] }
    : missingBase;
  const description = visual ? describeCake(visual, prefs.lang, colorNames) : '';

  // When the request changes (people, budget, message), the suggested designs change too:
  // drop a hand-made selection so the cake on screen always matches what was asked.
  const firstWants = useRef(wantsKey);
  useEffect(() => {
    if (firstWants.current === wantsKey) return;
    firstWants.current = wantsKey;
    if (draft.selection) update({ selection: null });
  }, [wantsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same for the look: new colors, theme or words in the message replace hand-picked ones.
  const askedLook = JSON.stringify([reading.colors?.map((c) => c.hex), reading.theme, reading.textOnCake, reading.age]);
  const firstLook = useRef(askedLook);
  useEffect(() => {
    if (firstLook.current === askedLook) return;
    firstLook.current = askedLook;
    if (draft.lookTouched) update({ lookTouched: false });
  }, [askedLook]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draft.step === 'done') doneRef.current?.focus();
  }, [draft.step]);

  const smartRead = async (img: SmallImage | null) => {
    setBusy(true);
    try {
      const r = await analyzeRequest(draft.description, menu, { image: img ? { mimeType: img.mimeType, base64: img.base64 } : null, allowAi: !prefs.aiOff });
      update({ reading: r, readingFor: draft.description });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selection) return;
    const e: typeof errors = {};
    if (!eventDate) e.date = tx('Pick the date you need the cake.', 'Piliin kung kailan kailangan ang cake.');
    else if (eventDate < minDate) e.date = tx('That is too soon for this baker. Please pick a later date.', 'Masyadong maaga para sa baker. Pumili ng mas huling petsa.');
    if (!draft.name.trim()) e.name = tx('Please add your name.', 'Pakilagay ang pangalan mo.');
    if (draft.contact.trim().length < 5) e.contact = tx('Please add your Messenger name or mobile number.', 'Pakilagay ang Messenger name o mobile number mo.');
    if (!draft.consent) e.consent = tx('Please tick the box so we can send this to the baker.', 'Pakicheck ang box para maipadala namin ito sa baker.');
    setErrors(e);
    const first = (['date', 'name', 'contact', 'consent'] as const).find((k) => e[k]);
    if (first) {
      const el = document.getElementById(first === 'consent' ? 'consent' : first);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
      return;
    }
    const servings = wants.servings ?? menu.baseCakes.find((b) => b.id === selection.baseCakeId)?.servings ?? 1;
    const req: CakeRequest = {
      id: newId('rq'),
      bakerySlug: menu.slug,
      createdAt: new Date().toISOString(),
      customer: { name: draft.name.trim().slice(0, 80), contact: draft.contact.trim().slice(0, 120) },
      occasion: (occasion || 'Other').slice(0, 40),
      eventDate,
      servings: Math.max(1, Math.min(500, Math.round(servings))),
      budget: wants.budget,
      description: [draft.description, draft.note && `Note: ${draft.note}`].filter(Boolean).join('\n').slice(0, 1000),
      tier: isCustom ? 'custom' : draft.tier,
      selection: normalizeSelection(menu, selection).selection,
      look: { ...look, textOnCake: look.textOnCake.slice(0, 40) },
      theme: (reading.theme ?? '').slice(0, 60),
      licensedNote: (reading.licensedNote ?? '').slice(0, 240),
      unavailable: (reading.unavailable ?? []).slice(0, 20),
      estimate: menu.showEstimates ? estimate : null,
      hasInspoPhoto: !!photo,
      lang: prefs.lang,
    };
    const valid = cakeRequestSchema.safeParse(req);
    if (!valid.success) {
      setErrors({ form: tx('Something is missing. Please check your answers.', 'May kulang pa. Pakicheck ang mga sagot mo.') });
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
    // Bakers with an account get it in their inbox right away (the Messenger message still goes too).
    let cloud = false;
    if (menu.owner && cloudEnabled()) {
      try {
        const { sendRequest } = await import('../cloud/data');
        await Promise.race([sendRequest(req as CakeRequest, menu.owner), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 8000))]);
        cloud = true;
      } catch {
        cloud = false;
      }
    }
    repo.addMyRequest({ id: req.id, bakerySlug: menu.slug, bakeryName: menu.name, createdAt: req.createdAt, summary: description, requestLink: link, status: 'sent', cloud });
    // Same device as the baker (demo laptop or a baker testing their own link): drop it straight in the inbox.
    const own = repo.get().bakery;
    if (own && own.slug === menu.slug) repo.upsertOrder(requestToOrder(req, 'same-device'));
    update({ sentId: req.id, sentLink: link, sentMessage: message, step: 'done' });
    window.scrollTo({ top: 0 });
    celebrate();
  };

  const header = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{tx('Cake request for', 'Cake request para sa')}</p>
        <p className="font-display text-xl font-semibold">{menu.name}</p>
      </div>
      <SampleBadge show={menu.isSample} text={tx('Sample bakery, demo data', 'Sample bakery, demo data')} />
    </div>
  );

  if (draft.step === 'done') {
    return (
      <Layout>
        {header}
        <div className="space-y-4">
          <h1 ref={doneRef} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight outline-none sm:text-3xl">
            {tx('Done! Now send it to the baker', 'Ayos! Ipadala na sa baker')}
          </h1>
          <Bubble from="app">
            {tx(
              `Tap Send and choose Messenger. ${menu.name} will check it and send you the final price. This is not an order yet.`,
              `I-tap ang Ipadala at piliin ang Messenger. Titingnan ito ng ${menu.name} at ipapadala ang final na presyo. Hindi pa ito order.`,
            )}
          </Bubble>
          {repo.get().myRequests.find((r) => r.id === draft.sentId)?.cloud && (
            <Notice tone="ok" title={tx('Delivered to the baker’s inbox', 'Nasa inbox na ng baker')}>
              {tx('They got it in Cakeita already. Their quote will show up under My cakes the moment they approve it. Sending it on Messenger too helps them reply faster.', 'Natanggap na nila sa Cakeita. Lalabas ang quote nila sa "Mga cake ko" pag in-approve nila. Mas mabilis ang sagot kung ipapadala mo rin sa Messenger.')}
            </Notice>
          )}
          {visual && <CakeView visual={visual} description={description} />}
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
            <button type="button" className="btn-ghost" onClick={() => update({ step: 'order', sentId: null, sentLink: null, sentMessage: null })}>
              {tx('Edit this request', 'I-edit ang request')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setPhoto(null); clearDraft(menu.slug); }}>
              {tx('Start a new request', 'Bagong request')}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const tooSoon = !!eventDate && eventDate < minDate;
  const over = budgetGap(estimate, wants.budget);

  // One 3D cake on the page: pinned beside the form on laptops, inside "Pick a design" on phones.
  const cakeStage = visual && (
    <div ref={cakeRef} className="scroll-mt-20">
      <CakeView visual={visual} description={description} />
    </div>
  );

  return (
    <Layout wide>
      {header}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-10">
      {wide && (
        <aside className="sticky top-[calc(3.75rem+1.5rem)] space-y-3" aria-label={tx('Your cake', 'Ang cake mo')}>
          {cakeStage}
        </aside>
      )}
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl leading-tight sm:text-4xl">{tx('Design your cake', 'I-design ang cake mo')}</h1>
          <p className="text-ink-soft">
            {tx('One page. Type it like you would in Messenger, and the designs and prices update as you go.', 'Isang page lang. I-type na parang nasa Messenger ka, at kusang magbabago ang design at presyo.')}
          </p>
        </div>

        {/* 1. The message */}
        <section className="card space-y-3" aria-labelledby="sec-msg">
          <SectionTitle id="sec-msg" n="01">
            {tx('What cake do you want?', 'Anong cake ang gusto mo?')}
          </SectionTitle>
          <label htmlFor="desc" className="sr-only">
            {tx('Describe your cake (Taglish OK)', 'Ilarawan ang cake (Taglish OK)')}
          </label>
          <textarea
            id="desc"
            className="input min-h-24"
            maxLength={2000}
            placeholder={tx('e.g. 2 tier pink ube cake, chocolate drip, flowers, 30 pax, budget 2.5k, "Happy 7th Mia"', 'hal. 2 tier pink na ube cake, chocolate drip, bulaklak, 30 pax, budget 2.5k, "Happy 7th Mia"')}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
          />
          {menu.isSample && !hasText && (
            <div>
              <p className="hint mb-2">{tx('Or tap a sample:', 'O pumili ng sample:')}</p>
              <div className="flex flex-wrap gap-2">
                {SCENARIOS.slice(0, 4).map((s) => (
                  <button key={s.key} type="button" className="btn-ghost" onClick={() => update({ description: s.message })}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer">
              <IconCamera /> {photo ? tx('Change inspo photo', 'Palitan ang inspo photo') : tx('Add inspo photo', 'Magdagdag ng inspo photo')}
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  setPhotoError('');
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const img = await resizeImage(f);
                    setPhoto(img);
                    if (smartAvailable) await smartRead(img);
                  } catch {
                    setPhotoError(tx("We couldn't open that photo. Try a screenshot of it instead.", 'Hindi mabuksan ang photo. Subukan ang screenshot nito.'));
                  }
                }}
              />
            </label>
            {smartAvailable && hasText && !(draft.reading?.usedAi && draft.readingFor === draft.description) && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => smartRead(photo)}>
                <IconSparkle /> {busy ? tx('Reading…', 'Binabasa…') : tx('Smart read', 'Smart read')}
              </button>
            )}
            {photo && (
              <span className="inline-flex items-center gap-2">
                <img src={photo.dataUrl} alt={tx('Your inspo photo', 'Ang inspo photo mo')} className="h-11 w-11 rounded-xl object-cover" />
                <button type="button" className="btn-ghost" onClick={() => setPhoto(null)}>
                  {tx('Remove', 'Alisin')}
                </button>
              </span>
            )}
          </div>
          {photoError && <Notice tone="warn">{photoError}</Notice>}
          {reading.aiNote === 'photo-not-read' && <Notice tone="info">{tx('We could not read your photo automatically. Please describe it in words, and send the photo to the baker too.', 'Hindi namin nabasa ang photo. Ilarawan mo sa salita, at i-send din ang photo sa baker.')}</Notice>}
          {hasText && <ReadSummary reading={reading} menu={menu} compact />}
        </section>

        {/* 2. The basics, all on one card */}
        <section className="card space-y-4" aria-labelledby="sec-basics">
          <SectionTitle id="sec-basics" n="02">
            {tx('The basics', 'Ang basics')}
          </SectionTitle>
          <div>
            <p className="label" id="occ-label">{tx('Occasion', 'Okasyon')}</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-labelledby="occ-label">
              {OCCASIONS.map(([en, tl]) => (
                <Chip key={en} pressed={occasion === en} onClick={() => update({ occasion: draft.occasion === en ? '' : en })}>
                  <span className="whitespace-nowrap">{tx(en, tl)}</span>
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Field id="servings" label={tx('How many people?', 'Ilan ang kakain?')}>
                <input id="servings" type="number" inputMode="numeric" min={1} max={500} className="input" placeholder={tx('e.g. 20', 'hal. 20')} value={wants.servings ?? ''} onChange={(e) => update({ servings: e.target.value ? Math.max(1, Math.min(500, Number(e.target.value))) : null })} />
              </Field>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={tx('Quick pick: people', 'Mabilis na pili: tao')}>
                {[8, 12, 20, 30, 45].map((n) => (
                  <Chip key={n} pressed={wants.servings === n} onClick={() => update({ servings: n })}>
                    {n} {tx('people', 'tao')}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Field id="budget" label={tx('Budget (₱)', 'Budget (₱)')}>
                <input id="budget" type="number" inputMode="numeric" min={100} max={500000} step={50} className="input" placeholder={tx('e.g. 2500', 'hal. 2500')} disabled={draft.noBudget} value={draft.noBudget ? '' : wants.budget ?? ''} onChange={(e) => update({ budget: e.target.value ? Math.max(0, Math.min(500000, Number(e.target.value))) : null, noBudget: false })} />
              </Field>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={tx('Quick pick: budget', 'Mabilis na pili: budget')}>
                {[800, 1500, 2500, 4000].map((n) => (
                  <Chip key={n} pressed={!draft.noBudget && wants.budget === n} onClick={() => update({ budget: n, noBudget: false })}>
                    {formatPeso(n)}
                  </Chip>
                ))}
                <Chip pressed={draft.noBudget} onClick={() => update({ noBudget: !draft.noBudget })}>
                  {tx('Not sure', 'Hindi pa alam')}
                </Chip>
              </div>
            </div>
          </div>
          <div>
            <Field id="date" label={tx('When do you need it?', 'Kailan kailangan?')} hint={tx(`${menu.name} needs at least ${menu.leadTimeDays} days' notice.`, `Kailangan ng ${menu.name} ng ${menu.leadTimeDays} araw na abiso.`)}>
              <input id="date" type="date" className="input" min={minDate} max={addDays(today, 365)} value={eventDate} onChange={(e) => update({ eventDate: e.target.value })} aria-describedby="date-hint" aria-invalid={!!errors.date || tooSoon} />
            </Field>
            <div className="mt-2 flex flex-wrap gap-2">
              {[menu.leadTimeDays, 7, 14].map((d, i) => {
                const day = addDays(today, Math.max(d, menu.leadTimeDays));
                return (
                  <button key={i} type="button" data-quick-date className="btn-ghost" aria-pressed={eventDate === day} onClick={() => update({ eventDate: day })}>
                    {new Date(`${day}T00:00:00`).toLocaleDateString(prefs.lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </button>
                );
              })}
            </div>
            {(errors.date || tooSoon) && (
              <div className="mt-2">
                <Notice tone="warn">{errors.date ?? tx('That is too soon for this baker. Please pick a later date.', 'Masyadong maaga para sa baker. Pumili ng mas huling petsa.')}</Notice>
              </div>
            )}
          </div>
        </section>

        {/* 3. Designs, live */}
        <section className="space-y-3" aria-labelledby="sec-designs">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <SectionTitle id="sec-designs" n="03">
              {tx('Pick a design', 'Pumili ng design')}
            </SectionTitle>
            <Link to={`/near?from=${encodeURIComponent(menu.slug)}`} className="btn-ghost">
              <IconPin /> {tx('Compare bakers near me', 'Ikumpara ang malapit na baker')}
            </Link>
          </div>
          {designs.budgetTooLow && wants.budget != null && (
            <Notice tone="warn" title={tx('Your budget is a bit low for this many people', 'Medyo kulang ang budget para sa ganitong dami')}>
              {tx(`The simplest cake that feeds ${wants.servings ?? 'everyone'} starts at about ${formatPeso(designs.lowestPrice)}. You can pick fewer people or ask the baker.`, `Ang pinakasimpleng cake para sa ${wants.servings ?? 'lahat'} ay mga ${formatPeso(designs.lowestPrice)}. Puwedeng bawasan ang tao o itanong sa baker.`)}
            </Notice>
          )}
          {!wide && cakeStage}
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={tx('Designs', 'Mga design')}>
            {designs.options.map((o) => (
              <DesignCard key={o.tier} option={o} menu={menu} look={look} selected={!isCustom && JSON.stringify(selection) === JSON.stringify(o.selection)} onPick={() => update({ tier: o.tier, selection: null })} budget={wants.budget} />
            ))}
          </div>
          {missing?.maxTiers && (
            <Notice tone="info">{tx(`${menu.name} makes cakes up to ${missing.maxTiers} tiers, so the designs use ${missing.maxTiers}.`, `Hanggang ${missing.maxTiers} tier lang ang ginagawa ng ${menu.name}, kaya ${missing.maxTiers} tier ang mga design.`)}</Notice>
          )}
          {!isCustom && missing && missing.parts.length > 0 && (
            <div data-left-out>
              <Notice tone="info" title={wants.budget != null ? tx(`Left out to fit ${formatPeso(wants.budget)}`, `Tinanggal para pumasok sa ${formatPeso(wants.budget)}`) : tx('Not in this design', 'Wala sa design na ito')}>
                <p>{missing.parts.join(', ')}</p>
                {fullest && fullest.n < missing.parts.length && (
                  <button type="button" className="btn-secondary mt-2" onClick={() => update({ tier: fullest.o.tier, selection: null })}>
                    {fullest.n === 0 ? tx(`Show it with everything (${formatPeso(fullest.o.estimate)})`, `Ipakita nang kumpleto (${formatPeso(fullest.o.estimate)})`) : tx(`Show the closest match (${formatPeso(fullest.o.estimate)})`, `Ipakita ang pinakamalapit (${formatPeso(fullest.o.estimate)})`)}
                  </button>
                )}
              </Notice>
            </div>
          )}
          {isCustom && (
            <p className="text-sm">
              <span className="tag border border-line bg-[#faf6f1] text-ink">{tx('Your custom design', 'Sarili mong design')}</span>{' '}
              <button type="button" className="text-berry underline" onClick={() => update({ selection: null })}>
                {tx('Go back to the suggestions', 'Bumalik sa mga suggestion')}
              </button>
            </p>
          )}
          {selection && (
            <details className="card group" open={isCustom || undefined}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2">
                <span>
                  <span className="block font-display text-lg">{tx('Customize it', 'I-customize')}</span>
                  <span className="block text-sm text-ink-soft">{tx('Size, flavor, frosting, colors, toppings, words', 'Laki, flavor, frosting, kulay, toppings, sulat')}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line transition group-open:rotate-180">
                  <IconChevron />
                </span>
              </summary>
              <div className="mt-4">
                <Customizer menu={menu} selection={selection} look={look} servings={wants.servings} onChange={(sel, l) => update({ selection: sel, look: l, lookTouched: draft.lookTouched || JSON.stringify(l) !== JSON.stringify(look) })} />
              </div>
            </details>
          )}
        </section>

        {/* 4. Contact */}
        <section className="card space-y-3" aria-labelledby="sec-contact">
          <SectionTitle id="sec-contact" n="04">
            {tx('Where can the baker reach you?', 'Saan ka makokontak ng baker?')}
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="name" label={tx('Your name', 'Pangalan mo')}>
              <input id="name" className="input" autoComplete="name" maxLength={80} value={draft.name} aria-invalid={!!errors.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field id="contact" label={tx('Messenger name or mobile number', 'Messenger name o mobile number')}>
              <input id="contact" className="input" autoComplete="tel" maxLength={120} value={draft.contact} aria-invalid={!!errors.contact} onChange={(e) => update({ contact: e.target.value })} />
            </Field>
          </div>
          <Field id="note" label={tx('Anything else? (optional)', 'May iba pa? (optional)')}>
            <input id="note" className="input" maxLength={300} value={draft.note} onChange={(e) => update({ note: e.target.value })} />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-line bg-[#fffdfa] p-3.5">
            <input id="consent" type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[#8c2246]" checked={draft.consent} onChange={(e) => update({ consent: e.target.checked })} />
            <span>
              {tx('I agree to send my name, contact and this request to the baker. No payment happens in Cakeita.', 'Pumapayag ako na ipadala ang pangalan, contact at request na ito sa baker. Walang bayaran sa Cakeita.')}
            </span>
          </label>
          {(errors.name || errors.contact || errors.consent || errors.form) && (
            <Notice tone="danger">{[errors.name, errors.contact, errors.consent, errors.form].filter(Boolean).join(' ')}</Notice>
          )}
          <p className="text-sm text-ink-soft">{tx('Free to use. No payment happens here. Your photo is never saved.', 'Libre. Walang bayaran dito. Hindi sine-save ang photo mo.')}</p>
        </section>
      </div>
      </div>

      {!wide && visual && <MiniCake target={cakeRef} visual={visual} description={description} price={menu.showEstimates && estimate != null ? formatPeso(estimate) : null} />}

      {/* Sticky price + send */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[#fffdfa] p-3 shadow-[0_-12px_30px_-24px_rgb(36_26_23/0.45)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 lg:max-w-6xl">
          <div className="min-w-0 flex-1" aria-live="polite">
            {menu.showEstimates && estimate != null ? (
              <>
                <p className="eyebrow !text-ink-soft">{tx('Estimated price', 'Tantyang presyo')}</p>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span key={estimate} className="price pop text-2xl" data-testid="live-price">{formatPeso(estimate)}</span>
                  {wants.budget != null && (
                    <span className={`text-xs font-bold ${over > 0 ? 'text-amber-ink' : 'text-ok-ink'}`}>{over > 0 ? `+${formatPeso(over)} ${tx('over', 'lampas')}` : tx('Fits budget', 'Pasok sa budget')}</span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold">{tx('The baker gives the price', 'Ang baker ang magbibigay ng presyo')}</p>
            )}
          </div>
          <button type="button" className="btn shrink-0" disabled={!selection} onClick={submit}>
            {tx('Send to baker', 'Ipadala sa baker')} <IconArrow />
          </button>
        </div>
      </div>
    </Layout>
  );
}

function budgetGap(estimate: number | null, budget: number | null): number {
  if (estimate == null || budget == null) return 0;
  return Math.max(0, estimate - budget);
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
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} className={`card text-left transition ${selected ? '!border-ink ring-1 ring-ink' : 'hover:border-[#cdbdb0]'}`}>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg">{label}</span>
        {selected && (
          <span className="tag bg-ink text-white">
            <IconCheck size={13} /> {tx('Picked', 'Napili')}
          </span>
        )}
      </div>
      <Cake2D visual={v} title={describeCake(v, prefs.lang)} className="my-3 h-28 w-full rounded-xl bg-[#faf6f1]" />
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
  const motifPart = menu.components.find((c) => c.visual === 'motif');
  // Same colors the cake uses for the topper, so the picker previews what you'll get.
  const motifLook = motifPart ? toVisual(menu, { ...selection, componentIds: [...selection.componentIds, motifPart.id] }, look).motif : null;
  const motifOn = !!motifPart && has(motifPart.id);
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
            className={`h-11 w-11 rounded-full border-2 ${on ? 'border-white ring-2 ring-ink' : 'border-line'}`}
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
              <button key={b.id} type="button" role="radio" aria-checked={b.id === selection.baseCakeId} onClick={() => onChange({ ...selection, baseCakeId: b.id }, look)} className={`chip justify-between rounded-xl ${b.id === selection.baseCakeId ? '!border-ink ring-1 ring-ink' : ''}`}>
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
      {motifPart && motifLook && (
        <section>
          <h2 className="label" id="motif-label">
            {tx('Theme topper', 'Theme topper')}
            {prices && <span className="ml-2 text-sm font-normal text-ink-soft">+{formatPeso(delta(motifPart.id))}</span>}
          </h2>
          <p className="hint mb-2">
            {tx('A printed cut-out in your colors. Want a real character? Ask the baker for a licensed topper or toy.', 'Printed na cut-out sa kulay mo. Gusto ng totoong character? Itanong sa baker ang licensed topper o laruan.')}
          </p>
          <div role="group" aria-labelledby="motif-label" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button
              type="button"
              aria-pressed={!motifOn}
              onClick={() => onChange({ ...selection, componentIds: selection.componentIds.filter((x) => x !== motifPart.id) }, look)}
              className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border bg-white p-1.5 text-xs font-medium text-ink ${!motifOn ? 'border-ink ring-1 ring-ink' : 'border-line'}`}
            >
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-[#cdbdb0] text-ink-soft">∅</span>
              {tx('None', 'Wala')}
            </button>
            {MOTIF_KEYS.map((k) => {
              const on = motifOn && motifLook.key === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  data-motif={k}
                  onClick={() => onChange({ ...selection, componentIds: motifOn ? selection.componentIds : [...selection.componentIds, motifPart.id] }, { ...look, motif: k })}
                  className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl border bg-white p-1.5 text-center text-xs font-medium leading-tight text-ink ${on ? 'border-ink ring-1 ring-ink' : 'border-line'}`}
                >
                  <MotifIcon k={k} colors={motifLook} />
                  {tx(MOTIFS[k].name, MOTIFS[k].nameTl)}
                </button>
              );
            })}
          </div>
        </section>
      )}
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
