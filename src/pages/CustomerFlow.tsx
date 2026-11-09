import { SurveyFinishCard } from '../components/SurveyFinish';
import { useAccount } from '../cloud/account';
import { demoSeen, readMe, saveMe } from '../lib/me';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { aiAvailable, analyzeRequest, type Reading } from '../ai/client';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { Cake2D } from '../cake/Cake2D';
import { MotifIcon } from '../cake/MotifIcon';
import { AllergyNotice } from '../components/AllergyNotice';
import { Layout } from '../components/Layout';
import { IconArrow, IconCamera, IconCheck, IconChevron, IconSparkle } from '../components/icons';
import { ShareBox } from '../components/ShareBox';
import { Bubble, Chip, Field, Notice, SampleBadge } from '../components/ui';
import { leftOut, selectionKey, type DesignOption } from '../domain/designs';
import { addDays, earliestDate } from '../domain/insights';
import { formatPeso } from '../domain/money';
import { MOTIF_KEYS, MOTIFS } from '../domain/motifs';
import { estimateFromMenu, isFullDate } from '../domain/pricing';
import { COLOR_WORDS } from '../domain/requestReader';
import { FLOWER_STYLES, TOPPER_SPOTS, type DesignTier, type OwnItem, type PublicMenu, type Selection } from '../domain/types';
import { FLOWER_LABELS, OWN_LABELS } from '../domain/placement';
import { toVisual } from '../domain/visual';
import { SCENARIOS } from '../data/demoScenarios';
import { clearDraft, useDraft, type Draft, type Stage } from '../data/draft';
import { repo } from '../data/store';
import { photoPixels, resizeImage, samplePhoto, type SmallImage } from '../lib/image';
import { findShowcase, showcaseByKey, showcaseHints } from '../domain/showcase';
import { colorsFromPhoto } from '../domain/photoColors';
import type { PhotoHints } from '../domain/photoHints';
import { linkErrorText } from '../lib/codec';
import { canShareSheet } from '../lib/links';
import { usePrefs, useTx } from '../lib/prefs';
import { celebrate } from '../lib/celebrate';
import { QuoteAlertToggle } from '../push/PushButtons';
import { useMedia } from '../lib/useMedia';
import { MiniCake } from './MiniCake';
import { currentCake, offlineReading } from './customerCake';
import { useMenu } from './useMenu';
import { carryPhoto, sendCakeRequest, type RequestParts } from './sendRequest';

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
  const nav = useNavigate();
  const prefs = usePrefs();
  const [draft, update] = useDraft(menu.slug);
  const [photo, setPhoto] = useState<SmallImage | null>(null);
  // Once the customer opens Customize, keep it open even when their picks match a suggestion again.
  const [customOpen, setCustomOpen] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildKey, setBuildKey] = useState(0);
  // Name and contact: filled from this phone (or the signed-in account) and shown as one line.
  const account = useAccount();
  const [editMe, setEditMe] = useState(() => {
    const me = readMe();
    return !(me.name && me.contact);
  });
  const accountName = account.status === 'signed-in' ? account.user.name : '';
  useEffect(() => {
    const me = readMe();
    const name = draft.name.trim() ? '' : me.name || accountName || '';
    const contact = draft.contact.trim() ? '' : me.contact;
    if (name || contact) update({ ...(name ? { name } : {}), ...(contact ? { contact } : {}) });
    // Only when the page opens or the account loads; typing must not be overwritten.
  }, [accountName]); // eslint-disable-line react-hooks/exhaustive-deps
  const [errors, setErrors] = useState<Partial<Record<'date' | 'name' | 'contact' | 'form', string>>>({});
  const [smartAvailable, setSmartAvailable] = useState(false);
  const [notifySub, setNotifySub] = useState<string | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const cakeRef = useRef<HTMLDivElement>(null);
  const wide = useMedia('(min-width: 1024px)');
  const today = useMemo(() => new Date(), []);
  // The open designer (the sample menu anyone can use) sends to a baker picked on the map,
  // and each baker there checks their own notice days.
  const pickOnMap = menu.slug === 'sample';
  const minDate = pickOnMap ? addDays(today, 1) : earliestDate(menu.leadTimeDays, today);

  useEffect(() => {
    if (!prefs.aiOff) aiAvailable().then(setSmartAvailable).catch(() => setSmartAvailable(false));
  }, [prefs.aiOff]);

  // Live reading: the offline Taglish reader runs on every keystroke (fast, no network).
  const liveReading = useMemo(() => offlineReading(draft.description, menu), [draft.description, menu]);
  const cake = currentCake(menu, draft, today, liveReading);
  const { reading, hasText, occasion, eventDate, wants, look, designs, selection, isCustom } = cake;
  // What resets a hand-made cake: a new message or photo (start again from it), or a new
  // head count or allergy (the size and parts may no longer fit). A budget change never does.
  const askKey = JSON.stringify({ ...cake.asked, budget: null, servings: null, avoid: null });
  const fitKey = JSON.stringify([cake.asked.servings, cake.asked.avoid?.said ?? []]);
  const estimate = selection ? estimateFromMenu(menu, selection) : null;
  const visual = selection ? toVisual(menu, selection, look) : null;
  const missingBase = selection ? leftOut(menu, wants, selection) : null;
  // The design that keeps the most of what they asked for, to offer when the current one drops things.
  const fullest = designs.options
    .map((o) => ({ o, n: leftOut(menu, wants, o.selection).parts.length }))
    .sort((a, b) => a.n - b.n || a.o.estimate - b.o.estimate)[0];
  // Their own design (changed by hand in Customize) stays as the first card, so picking another
  // design never loses it: they can tap it again to get it back.
  const ownSel = isCustom ? selection : draft.handPicked && designs.options.every((o) => selectionKey(o.selection) !== selectionKey(draft.handPicked!)) ? draft.handPicked : null;
  const ownBase = ownSel ? menu.baseCakes.find((b) => b.id === ownSel.baseCakeId) : undefined;
  const ownPrice = ownSel ? estimateFromMenu(menu, ownSel) : null;
  const customOption: DesignCardOption | null =
    ownSel && ownBase && ownPrice != null
      ? { tier: 'custom', selection: ownSel, estimate: ownPrice, overBudget: wants.budget != null && ownPrice > wants.budget, servings: ownBase.servings, servingsShort: ownBase.servings < (wants.servings ?? 0) }
      : null;
  const colorNames = look.colors.map((h) => PALETTE.find((p) => p.hex === h)?.name ?? '').filter(Boolean);
  // Semi-naked cakes have no frosting to color, so say so instead of quietly dropping the color.
  const missing = missingBase && visual?.covering === 'naked' && colorNames.length
    ? { ...missingBase, parts: [...missingBase.parts, tx(`${colorNames.join(' and ')} frosting (semi-naked has none)`, `${colorNames.join(' at ')} na frosting (walang frosting ang semi-naked)`)] }
    : missingBase;
  const description = visual ? describeCake(visual, prefs.lang, colorNames) : '';

  // A new message or photo: the cake follows it again, and hand-made changes are dropped.
  const firstAsk = useRef(askKey);
  useEffect(() => {
    if (firstAsk.current === askKey) return;
    firstAsk.current = askKey;
    if (draft.selection || draft.handPicked) update({ selection: null, handPicked: null });
  }, [askKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // More people or a new allergy: show the designs again (still built from their own parts).
  const firstFit = useRef(fitKey);
  useEffect(() => {
    if (firstFit.current === fitKey) return;
    firstFit.current = fitKey;
    if (draft.selection) update({ selection: null });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * Turn the inspo photo into the cake: AI (when set up) reads tiers, decorations, colors and
   * placement using only this menu's parts; the phone itself always reads the main colors.
   * Then the design closest to the photo is picked. Prices still come only from the menu.
   */
  const readPhoto = async (img: SmallImage) => {
    setBusy(true);
    setBuilding(true);
    try {
      // A featured design is recognized on the phone first: then no AI is needed at all.
      const known = await photoPixels(img.dataUrl).then((p) => (p ? findShowcase(p) : null)).catch(() => null);
      // A short minimum so the "building your cake" steps can be seen even when reading is instant.
      const [ai, px] = await Promise.all([
        !known && smartAvailable && !prefs.aiOff ? analyzeRequest('', menu, { image: { mimeType: img.mimeType, base64: img.base64 }, allowAi: true }).catch(() => null) : Promise.resolve(null),
        samplePhoto(img.dataUrl).catch(() => ({ center: [], border: [] })),
        new Promise((res) => setTimeout(res, 1800)),
      ]);
      const usedAi = !!ai?.usedAi;
      const hints: PhotoHints = known ? showcaseHints(known, menu) : {
        colors: usedAi && ai!.colors.length ? ai!.colors.slice(0, 2) : colorsFromPhoto(px.center, px.border),
        componentIds: usedAi ? ai!.componentIds : [],
        flavorId: usedAi ? ai!.flavorId : null,
        coveringId: usedAi ? ai!.coveringId : null,
        tiers: usedAi ? ai!.tiers : null,
        theme: usedAi ? ai!.theme : '',
        textOnCake: usedAi ? ai!.textOnCake : '',
        licensedNote: usedAi ? ai!.licensedNote : '',
        unavailable: usedAi ? ai!.unavailable : [],
        flowerStyle: usedAi ? ai!.flowerStyle ?? null : null,
        topperSpot: usedAi ? ai!.topperSpot ?? null : null,
        summary: usedAi ? ai!.summary : '',
        usedAi,
      };
      // Show the design that keeps the most of what the photo (and anything typed) asks for,
      // then the one with the fewest extras, so we don't add decorations nobody asked for.
      const next = { ...draft, photoHints: hints, selection: null, handPicked: null, lookTouched: false };
      const c = currentCake(menu, next, today);
      // Parts a design adds that the photo doesn't show (flavor and frosting don't count).
      const extras = (ids: string[]) => ids.filter((id) => !c.wants.componentIds.includes(id) && !['flavor', 'covering'].includes(menu.components.find((x) => x.id === id)?.category ?? '')).length;
      const best = c.designs.options
        .map((o) => ({ o, missing: leftOut(menu, c.wants, o.selection).parts.length, extra: extras(o.selection.componentIds) }))
        .sort((a, b) => a.missing - b.missing || a.extra - b.extra || a.o.estimate - b.o.estimate)[0];
      update({ photoHints: hints, selection: null, handPicked: null, lookTouched: false, ...(best ? { tier: best.o.tier } : {}) });
      // Show the cake assembling itself.
      setBuildKey((k) => k + 1);
      requestAnimationFrame(() => cakeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    } finally {
      setBusy(false);
      setBuilding(false);
    }
  };

  /** Check the form. `anyBaker` skips this baker's own date limits (each baker on the map checks their own). */
  const formOk = (anyBaker: boolean): boolean => {
    const e: typeof errors = {};
    if (!eventDate) e.date = tx('Pick the date you need the cake.', 'Piliin kung kailan kailangan ang cake.');
    else if (eventDate < minDate) e.date = pickOnMap ? tx('Please pick a date after today.', 'Pumili ng petsa pagkatapos ng araw na ito.') : tx('That is too soon for this baker. Please pick a later date.', 'Masyadong maaga para sa baker. Pumili ng mas huling petsa.');
    else if (!anyBaker && isFullDate(menu, eventDate)) e.date = tx('The baker is fully booked that day. Please pick another date.', 'Puno na ang baker sa araw na iyon. Pumili ng ibang petsa.');
    if (!draft.name.trim()) e.name = tx('Please add your name.', 'Pakilagay ang pangalan mo.');
    if (draft.contact.trim().length < 5) e.contact = tx('Please add your Messenger name or mobile number.', 'Pakilagay ang Messenger name o mobile number mo.');
    setErrors(e);
    const first = (['date', 'name', 'contact'] as const).find((k) => e[k]);
    if (first) {
      if (first !== 'date') setEditMe(true);
      const el = document.getElementById(first);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
      return false;
    }
    // Tapping send after the notice in section 4 is the customer's consent to share these details.
    if (!draft.consent) update({ consent: true });
    saveMe({ name: draft.name, contact: draft.contact });
    return true;
  };

  /** Everything the request needs, for this baker (or another one picked on the map). */
  const requestParts = (to: PublicMenu): RequestParts => ({
    menu: to,
    fromSlug: menu.slug,
    name: draft.name,
    contact: draft.contact,
    note: draft.note,
    description: draft.description,
    occasion,
    eventDate,
    servings: wants.servings ?? menu.baseCakes.find((b) => b.id === selection?.baseCakeId)?.servings ?? 1,
    budget: wants.budget,
    tier: isCustom ? 'custom' : draft.tier,
    selection: selection!,
    look,
    theme: reading.theme ?? '',
    licensedNote: reading.licensedNote ?? '',
    unavailable: reading.unavailable ?? [],
    estimate,
    summary: description,
    photo,
    notifySub,
    lang: prefs.lang,
    allergies: cake.allergyText,
  });

  /** Main path from the open designer: see who can bake it, ranked, and send it to one of them. */
  const chooseBaker = () => {
    if (!selection || !formOk(true)) return;
    carryPhoto(photo);
    nav(`/near?from=${encodeURIComponent(menu.slug)}&send=1`);
  };

  const submit = async () => {
    if (!selection || !formOk(false)) return;
    const res = await sendCakeRequest(requestParts(menu), tx);
    if (!res.ok) {
      setErrors({ form: tx('Something is missing. Please check your answers.', 'May kulang pa. Pakicheck ang mga sagot mo.') });
      return;
    }
    update({ sentId: res.id, sentLink: res.link, sentMessage: res.message, step: 'done' });
    window.scrollTo({ top: 0 });
    celebrate();
  };


  const header = pickOnMap && draft.step !== 'done' ? null : (
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
            {canShareSheet()
              ? tx(
                  `Tap Send and choose Messenger. ${menu.name} will check it and send you the final price. This is not an order yet.`,
                  `I-tap ang Ipadala at piliin ang Messenger. Titingnan ito ng ${menu.name} at ipapadala ang final na presyo. Hindi pa ito order.`,
                )
              : tx(
                  `Copy the message and paste it in Messenger to ${menu.name}. They will check it and send you the final price. This is not an order yet.`,
                  `I-copy ang message at i-paste sa Messenger ng ${menu.name}. Titingnan nila ito at ipapadala ang final na presyo. Hindi pa ito order.`,
                )}
          </Bubble>
          <SurveyFinishCard />
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
  const booked = isFullDate(menu, eventDate);
  const over = budgetGap(estimate, wants.budget);
  const stage = pickOnMap ? draft.stage : null;

  // One 3D cake on the page: pinned beside the form on laptops, inside "Pick a design" on phones.
  const cakeStage = visual && (
    <div ref={cakeRef} className="scroll-mt-20">
      <CakeView visual={visual} description={description} buildKey={buildKey} />
    </div>
  );

  /** The photo is only attached here; in the step-by-step designer it is read when "Make my cake" is tapped. */
  const onPhotoFile = async (f: File | undefined) => {
    setPhotoError('');
    if (!f) return;
    try {
      const img = await resizeImage(f);
      setPhoto(img);
      if (pickOnMap) update({ photoHints: null });
      else await readPhoto(img);
    } catch {
      setPhotoError(tx("We couldn't open that photo. Try a screenshot of it instead.", 'Hindi mabuksan ang photo. Subukan ang screenshot nito.'));
    }
  };
  const removePhoto = () => {
    setPhoto(null);
    update({ photoHints: null });
  };

  /** Step 1 -> 2: read the photo and words, then show the cake assembling itself. */
  const makeCake = async () => {
    if (photo && !draft.photoHints) await readPhoto(photo);
    else {
      setBuilding(true);
      await new Promise((res) => setTimeout(res, 1300));
      setBuilding(false);
    }
    update({ stage: 'cake' });
    setBuildKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };
  const goStage = (s: Stage) => {
    update({ stage: s });
    window.scrollTo({ top: 0 });
  };

  const descBox = (
    <>
      <label htmlFor="desc" className={pickOnMap ? 'label' : 'sr-only'}>
        {pickOnMap ? tx('Describe it (Taglish OK)', 'Ilarawan ang cake (Taglish OK)') : tx('Describe your cake (Taglish OK)', 'Ilarawan ang cake (Taglish OK)')}
      </label>
      <textarea
        id="desc"
        className="input min-h-24"
        maxLength={2000}
        placeholder={tx('e.g. 2 tier pink ube cake, chocolate drip, flowers, 30 pax, budget 2.5k, "Happy 7th Mia"', 'hal. 2 tier pink na ube cake, chocolate drip, bulaklak, 30 pax, budget 2.5k, "Happy 7th Mia"')}
        value={draft.description}
        onChange={(e) => update({ description: e.target.value })}
      />
    </>
  );

  const photoInput = (
    <input id="photo" type="file" accept="image/*" className="sr-only" aria-label={tx('Add an inspo photo', 'Magdagdag ng inspo photo')} onChange={(e) => onPhotoFile(e.target.files?.[0])} />
  );

  const inspoCard = (
    <div className={`flex items-center gap-3 rounded-2xl border border-dashed p-2.5 transition ${photo ? 'border-berry/40 bg-white' : 'border-[#d9c9bb] bg-[#fbf7f2] hover:border-berry/50'}`} data-inspo>
      {photo ? (
        <img src={photo.dataUrl} alt={tx('Your inspo photo', 'Ang inspo photo mo')} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-berry-soft text-berry" aria-hidden="true">
          <IconCamera size={22} />
        </span>
      )}
      <p className="min-w-0 flex-1 text-[0.95rem] font-semibold leading-snug">{photo ? tx('Inspo photo added', 'May inspo photo na') : tx('Have an inspo photo?', 'May inspo photo ka?')}</p>
      <div className="flex shrink-0 gap-1">
        <label className={`${photo ? 'btn-ghost' : 'btn-secondary !px-4'} cursor-pointer !min-h-11`}>
          {photo ? tx('Change', 'Palitan') : tx('Add', 'Idagdag')}
          {photoInput}
        </label>
        {photo && (
          <button type="button" className="btn-ghost" onClick={removePhoto}>
            {tx('Remove', 'Alisin')}
          </button>
        )}
      </div>
    </div>
  );

  /** Step 1's big photo area: the whole box is the upload button. */
  const inspoBig = photo ? (
    <div className="flex items-center gap-3 rounded-2xl border border-berry/40 bg-white p-3" data-inspo>
      <img src={photo.dataUrl} alt={tx('Your inspo photo', 'Ang inspo photo mo')} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
      <p className="min-w-0 flex-1 font-semibold">{tx('Inspo photo added', 'May inspo photo na')}</p>
      <div className="flex shrink-0 flex-col gap-1">
        <label className="btn-ghost cursor-pointer !min-h-11">
          {tx('Change', 'Palitan')}
          {photoInput}
        </label>
        <button type="button" className="btn-ghost" onClick={removePhoto}>
          {tx('Remove', 'Alisin')}
        </button>
      </div>
    </div>
  ) : (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[#d9c9bb] bg-[#fbf7f2] px-4 py-8 text-center transition hover:border-berry/60" data-inspo>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-berry-soft text-berry" aria-hidden="true">
        <IconCamera size={28} />
      </span>
      <span className="font-display text-lg font-semibold">{tx('Upload an inspo photo', 'Mag-upload ng inspo photo')}</span>
      <span className="text-sm text-ink-soft">{tx('Optional. A screenshot works too.', 'Optional. Puwede ang screenshot.')}</span>
      {photoInput}
    </label>
  );

  const examples = menu.isSample && !hasText && (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-ink-soft">
        {tx('No idea yet? Try an example', 'Wala pang idea? Subukan ang halimbawa')}
        <IconChevron size={16} className="transition group-open:rotate-180" />
      </summary>
      <div className="mt-1 flex flex-wrap gap-2">
        {SCENARIOS.slice(0, 4).map((s) => (
          <button key={s.key} type="button" className="btn-ghost" onClick={() => update({ description: s.message })}>
            {s.title}
          </button>
        ))}
      </div>
    </details>
  );

  const smartButton = smartAvailable && draft.description.trim() && !(draft.reading?.usedAi && draft.readingFor === draft.description) && (
    <button type="button" className="btn-ghost" disabled={busy} onClick={() => smartRead(photo)}>
      <IconSparkle /> {busy ? tx('Reading…', 'Binabasa…') : tx('Smart read', 'Smart read')}
    </button>
  );

  const photoMatch = draft.photoHints && !building && (
    <PhotoMatch hints={draft.photoHints} menu={menu} hasPhoto={!!photo} onSee={() => cakeRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })} onRemove={removePhoto} />
  );
  const photoNotRead = reading.aiNote === 'photo-not-read' && <Notice tone="info">{tx('We could not read your photo automatically. Please describe it in words, and send the photo to the baker too.', 'Hindi namin nabasa ang photo. Ilarawan mo sa salita, at i-send din ang photo sa baker.')}</Notice>;

  const peopleBlock = (
    <div>
      <Field id="servings" label={tx('How many people?', 'Ilan ang kakain?')}>
        <input id="servings" type="number" inputMode="numeric" min={1} max={500} className="input" placeholder={tx('e.g. 20', 'hal. 20')} value={wants.servings ?? ''} onChange={(e) => update({ servings: e.target.value ? Math.max(1, Math.min(500, Number(e.target.value))) : null })} />
      </Field>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={tx('Quick pick: people', 'Mabilis na pili: tao')}>
        {[10, 20, 30, 50].map((n) => (
          <Chip key={n} pressed={wants.servings === n} onClick={() => update({ servings: n })}>
            {n} {tx('people', 'tao')}
          </Chip>
        ))}
      </div>
    </div>
  );

  const allergyBlock = (
    <Field id="allergies" label={tx('Any food allergies? (optional)', 'May allergy sa pagkain? (optional)')}>
      <input id="allergies" className="input" maxLength={120} autoComplete="off" placeholder={tx('e.g. peanuts, blueberries', 'hal. mani, blueberry')} value={cake.allergyText} onChange={(e) => update({ allergies: e.target.value })} data-allergy-input />
    </Field>
  );
  const allergyWarn = selection && cake.allergies.said.length > 0 && (
    <AllergyNotice menu={menu} selection={selection} text={cake.allergyText} who="customer" onRemove={(id) => {
      const next = { ...selection, componentIds: selection.componentIds.filter((x) => x !== id) };
      update({ selection: next, handPicked: next });
    }} />
  );

  const budgetInput = (
    <Field id="budget" label={pickOnMap ? tx('Or type an exact budget (₱)', 'O i-type ang eksaktong budget (₱)') : tx('Budget (₱)', 'Budget (₱)')}>
      <input id="budget" type="number" inputMode="numeric" min={100} max={500000} step={50} className="input" placeholder={tx('e.g. 2500', 'hal. 2500')} disabled={draft.noBudget} value={draft.noBudget ? '' : wants.budget ?? ''} onChange={(e) => update({ budget: e.target.value ? Math.max(0, Math.min(500000, Number(e.target.value))) : null, noBudget: false })} />
    </Field>
  );

  const budgetBlock = (
    <div>
      {budgetInput}
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
  );

  /** Step 3: price ranges; each one sets the top of the budget. */
  const rangeBlock = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={tx('Price range', 'Hanay ng presyo')} data-price-range>
        {PRICE_RANGES.map(([lo, hi]) => {
          const label = lo === 0 ? tx(`Up to ${formatPeso(hi)}`, `Hanggang ${formatPeso(hi)}`) : `${formatPeso(lo)} – ${formatPeso(hi)}`;
          const on = !draft.noBudget && wants.budget != null && wants.budget > lo && wants.budget <= hi;
          return (
            <button key={hi} type="button" className={`min-h-12 rounded-2xl border px-3 text-[0.95rem] font-semibold transition ${on ? 'border-berry bg-berry text-white' : 'border-line bg-white text-ink hover:border-berry/50'}`} aria-pressed={on} onClick={() => update({ budget: hi, noBudget: false })}>
              {label}
            </button>
          );
        })}
        <button type="button" className={`col-span-2 min-h-12 rounded-2xl border px-3 text-[0.95rem] font-semibold transition ${draft.noBudget ? 'border-berry bg-berry text-white' : 'border-line bg-white text-ink hover:border-berry/50'}`} aria-pressed={draft.noBudget} onClick={() => update({ noBudget: !draft.noBudget })}>
          {tx('Not sure yet, show me', 'Hindi pa alam, ipakita lang')}
        </button>
      </div>
      {budgetInput}
    </div>
  );

  const dateBlock = (
    <div>
      <Field id="date" label={tx('When do you need it?', 'Kailan kailangan?')} hint={pickOnMap ? tx('Most bakers need 2 to 7 days.', 'Karaniwang 2 hanggang 7 araw ang abiso.') : tx(`${menu.name} needs at least ${menu.leadTimeDays} days' notice.`, `Kailangan ng ${menu.name} ng ${menu.leadTimeDays} araw na abiso.`)}>
        <input id="date" type="date" className="input" min={minDate} max={addDays(today, 365)} value={eventDate} onChange={(e) => update({ eventDate: e.target.value })} aria-describedby="date-hint" aria-invalid={!!errors.date || tooSoon || booked} />
      </Field>
      <div className="mt-2 flex flex-wrap gap-2">
        {[menu.leadTimeDays, 7, 14].map((d, i) => {
          // Skip days the baker is fully booked.
          let day = addDays(today, Math.max(d, menu.leadTimeDays));
          for (let k = 0; k < 30 && isFullDate(menu, day); k++) day = addDays(day, 1);
          return (
            <button key={i} type="button" data-quick-date className="btn-ghost" aria-pressed={eventDate === day} onClick={() => update({ eventDate: day })}>
              {new Date(`${day}T00:00:00`).toLocaleDateString(prefs.lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
            </button>
          );
        })}
      </div>
      {booked && !errors.date && (
        <div className="mt-2">
          <Notice tone="warn">{tx(`${menu.name} is fully booked that day. Please pick another date.`, `Puno na ang ${menu.name} sa araw na iyon. Pumili ng ibang petsa.`)}</Notice>
        </div>
      )}
      {(errors.date || tooSoon) && (
        <div className="mt-2">
          <Notice tone="warn">{errors.date ?? (pickOnMap ? tx('Please pick a date after today.', 'Pumili ng petsa pagkatapos ng araw na ito.') : tx('That is too soon for this baker. Please pick a later date.', 'Masyadong maaga para sa baker. Pumili ng mas huling petsa.'))}</Notice>
        </div>
      )}
    </div>
  );

  const occasionBlock = (
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
  );

  // What the shown design leaves out of what they asked for (to fit the budget), with a way to see it all.
  const leftOutBlock = (
    <>
      {!isCustom && missing && missing.parts.length > 0 && (
        <div data-left-out>
          <Notice tone="info" title={wants.budget != null ? tx(`Left out to fit ${formatPeso(wants.budget)}`, `Tinanggal para pumasok sa ${formatPeso(wants.budget)}`) : tx('Not in this design', 'Wala sa design na ito')}>
            <p>{missing.parts.join(', ')}</p>
            {fullest && fullest.n < missing.parts.length && selection && selectionKey(fullest.o.selection) !== selectionKey(selection) && (
              <button type="button" className="btn-secondary mt-2" onClick={() => update({ tier: fullest.o.tier, selection: null })}>
                {fullest.n === 0 ? tx(`Show it with everything (${formatPeso(fullest.o.estimate)})`, `Ipakita nang kumpleto (${formatPeso(fullest.o.estimate)})`) : tx(`Show the closest match (${formatPeso(fullest.o.estimate)})`, `Ipakita ang pinakamalapit (${formatPeso(fullest.o.estimate)})`)}
              </button>
            )}
          </Notice>
        </div>
      )}
    </>
  );

  const designsBlock = (
    <>
      {designs.budgetTooLow && wants.budget != null && (
        <Notice tone="warn" title={tx('Budget is a bit low for this many people', 'Medyo kulang ang budget sa dami ng tao')}>
          {tx(`The simplest cake for ${wants.servings ?? 'everyone'} is about ${formatPeso(designs.lowestPrice)}.`, `Mga ${formatPeso(designs.lowestPrice)} ang pinakasimple para sa ${wants.servings ?? 'lahat'}.`)}
        </Notice>
      )}
      {!pickOnMap && !wide && cakeStage}
      {allergyWarn}
      <div className={`grid gap-3 ${customOption ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`} role="radiogroup" aria-label={tx('Designs', 'Mga design')}>
        {customOption && <DesignCard option={customOption} menu={menu} look={look} selected={isCustom} onPick={() => update({ selection: customOption.selection })} budget={wants.budget} missing={[]} />}
        {designs.options.map((o) => (
          <DesignCard key={o.tier} option={o} menu={menu} look={look} selected={!isCustom && !!selection && selectionKey(selection) === selectionKey(o.selection)} onPick={() => update({ tier: o.tier, selection: null })} budget={wants.budget} missing={leftOut(menu, wants, o.selection).parts} mine={!!draft.handPicked && selectionKey(draft.handPicked) === selectionKey(o.selection)} />
        ))}
      </div>
      {missing?.maxTiers && (
        <Notice tone="info">{tx(`${menu.name} makes cakes up to ${missing.maxTiers} tiers, so the designs use ${missing.maxTiers}.`, `Hanggang ${missing.maxTiers} tier lang ang ginagawa ng ${menu.name}, kaya ${missing.maxTiers} tier ang mga design.`)}</Notice>
      )}
      {leftOutBlock}
      {draft.handPicked && (
        <p className="text-sm">
          <button type="button" className="min-h-11 text-berry underline" onClick={() => update({ selection: null, handPicked: null })} data-clear-hand>
            {tx('Undo my changes and start again from my message', 'Burahin ang binago ko at bumalik sa mensahe ko')}
          </button>
        </p>
      )}
    </>
  );

  const customizeBlock = selection && (
    <details className="card group" open={isCustom || customOpen || undefined} onToggle={(e) => setCustomOpen((e.currentTarget as HTMLDetailsElement).open)}>
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
        <Customizer menu={menu} selection={selection} look={look} servings={wants.servings} onChange={(sel, l) => update({ selection: sel, handPicked: selectionKey(sel) !== selectionKey(selection) ? sel : draft.handPicked, look: l, lookTouched: draft.lookTouched || JSON.stringify(l) !== JSON.stringify(look) })} />
      </div>
    </details>
  );

  const contactBlock = (
    <>
      {!editMe && draft.name.trim() && draft.contact.trim() ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[#fffdfa] px-3.5 py-2" data-me-summary>
          <p className="min-w-0 text-[0.95rem]">
            <span className="text-ink-soft">{tx('Sending as', 'Ipapadala bilang')}</span> <strong>{draft.name}</strong> · {draft.contact}
          </p>
          <button type="button" className="link min-h-11 shrink-0 text-sm" onClick={() => setEditMe(true)}>
            {tx('Change', 'Palitan')}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="name" label={tx('Your name', 'Pangalan mo')}>
            <input id="name" className="input" autoComplete="name" maxLength={80} value={draft.name} aria-invalid={!!errors.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field id="contact" label={tx('Messenger name or mobile number', 'Messenger name o mobile number')}>
            <input id="contact" className="input" autoComplete="tel" maxLength={120} value={draft.contact} aria-invalid={!!errors.contact} onChange={(e) => update({ contact: e.target.value })} />
          </Field>
        </div>
      )}
      <QuoteAlertToggle show={!!menu.owner} value={notifySub} onChange={setNotifySub} />
      {(errors.name || errors.contact || errors.form) && <Notice tone="danger">{[errors.name, errors.contact, errors.form].filter(Boolean).join(' ')}</Notice>}
      <p className="text-sm text-ink-soft" data-consent-note>
        {tx('Sending shares your name, contact, request and photo (if any) with the baker. Free; no payment in Cakeita; the photo is never saved.', 'Kapag ipinadala, makikita ng baker ang pangalan, contact, request at photo mo (kung meron). Libre; walang bayaran sa Cakeita; hindi sine-save ang photo.')}
      </p>
      {pickOnMap && (demoSeen() || prefs.dev) && (
        <p className="text-center text-sm">
          <button type="button" className="min-h-11 text-ink-soft underline underline-offset-4" onClick={submit} disabled={!selection} data-send-direct>
            {tx(`Or send it straight to ${menu.name}`, `O ipadala diretso sa ${menu.name}`)}
          </button>
        </p>
      )}
    </>
  );

  const backButton = (to: Stage) => (
    <button type="button" className="btn-secondary shrink-0 !px-3" onClick={() => goStage(to)} data-stage-back={to} aria-label={tx('Back', 'Bumalik')}>
      <IconArrow className="rotate-180" /> <span className="hidden sm:inline">{tx('Back', 'Bumalik')}</span>
    </button>
  );

  const priceBar = (action: ReactNode, back?: ReactNode) => (
    <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[#fffdfa] p-3 shadow-[0_-12px_30px_-24px_rgb(36_26_23/0.45)]">
      <div className={`mx-auto flex max-w-3xl items-center gap-2 sm:gap-3 ${pickOnMap ? '' : 'lg:max-w-6xl'}`}>
        {back}
        <div className="min-w-0 flex-1" aria-live="polite">
          {menu.showEstimates && estimate != null ? (
            <>
              <p className="eyebrow !text-ink-soft">{pickOnMap ? tx('Sample estimate', 'Sample na tantya') : tx('Estimated price', 'Tantyang presyo')}</p>
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
        {action}
      </div>
    </div>
  );

  // ---------------- The open designer: one step at a time ----------------
  if (stage) {
    // Laptops: the cake stays in view beside the controls on the cake and price steps.
    const side = wide && stage !== 'idea';
    return (
      <Layout wide={side}>
        <Stepper stage={stage} />
        <div className={side ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-10' : ''}>
        {side && (
          <aside className="sticky top-[calc(3.75rem+1.5rem)] space-y-3" aria-label={tx('Your cake', 'Ang cake mo')} data-side-cake>
            {cakeStage}
          </aside>
        )}
        <div>
        {stage === 'idea' && (
          <div className="space-y-4" data-open-designer data-stage="idea">
            <div className="space-y-1">
              <h1 className="text-3xl leading-tight sm:text-4xl">{tx('What cake do you want?', 'Anong cake ang gusto mo?')}</h1>
              <p className="text-ink-soft">{tx('Add a photo, describe it, or both. We build it in 3D.', 'Mag-upload ng photo, i-describe, o pareho. Gagawin namin itong 3D.')}</p>
            </div>
            {building ? <PhotoBuilding photo={photo?.dataUrl ?? null} ai={!!photo && smartAvailable && !prefs.aiOff} /> : inspoBig}
            <div className="space-y-1">{descBox}</div>
            {photoError && <Notice tone="warn">{photoError}</Notice>}
            {examples}
            <button type="button" className="btn w-full" disabled={(!hasText && !photo) || building} onClick={makeCake} data-make-cake>
              <IconSparkle /> {building ? tx('Making your cake…', 'Ginagawa ang cake mo…') : tx('Make my 3D cake', 'Gawin ang 3D cake ko')}
            </button>
          </div>
        )}
        {stage === 'cake' && (
          <div className="space-y-4" data-open-designer data-stage="cake">
            <div className="space-y-1">
              <h1 className="text-3xl leading-tight sm:text-4xl">{tx('Your cake', 'Ang cake mo')}</h1>
              <p className="text-ink-soft">{tx('Change anything below. The price updates as you go.', 'Baguhin kahit ano sa ibaba. Kusang nagbabago ang presyo.')}</p>
            </div>
            {!side && cakeStage}
            {photoMatch}
            {photoNotRead}
            {hasText && <ReadSummary reading={reading} menu={menu} compact />}
            {smartButton}
            {leftOutBlock}
            <section className="card space-y-4" aria-label={tx('Size and allergies', 'Laki at allergy')}>
              {peopleBlock}
              {allergyBlock}
              {allergyWarn}
            </section>
            {customizeBlock}
          </div>
        )}
        {stage === 'price' && (
          <div className="space-y-5" data-open-designer data-stage="price">
            <div className="space-y-1">
              <h1 className="text-3xl leading-tight sm:text-4xl">{tx('What is your budget?', 'Magkano ang budget mo?')}</h1>
              <p className="text-ink-soft">{tx('Pick a range. We show what fits, then the bakers near you.', 'Pumili ng range. Ipapakita namin ang pasok, tapos ang mga baker na malapit.')}</p>
            </div>
            <section className="card">{rangeBlock}</section>
            {!side && cakeStage}
            <section className="space-y-3" aria-labelledby="sec-designs">
              <h2 id="sec-designs" className="text-xl">{tx('Pick a design', 'Pumili ng design')}</h2>
              {designsBlock}
            </section>
            <section className="card space-y-4" aria-labelledby="sec-contact">
              <h2 id="sec-contact" className="text-xl">{tx('When, and how to reach you', 'Kailan, at paano ka makokontak')}</h2>
              {dateBlock}
              {contactBlock}
            </section>
          </div>
        )}

        </div>
        </div>
        {stage !== 'idea' && !side && visual && <MiniCake key={stage} target={cakeRef} visual={visual} description={description} price={menu.showEstimates && estimate != null ? formatPeso(estimate) : null} />}
        {stage === 'cake' &&
          priceBar(
            <button type="button" className="btn shrink-0" disabled={!selection} onClick={() => goStage('price')} data-next-price>
              {tx('Next', 'Sunod')} <IconArrow />
            </button>,
            backButton('idea'),
          )}
        {stage === 'price' &&
          priceBar(
            <button type="button" className="btn shrink-0" disabled={!selection} onClick={chooseBaker} data-choose-baker>
              {tx('Next', 'Sunod')} <IconArrow />
            </button>,
            backButton('cake'),
          )}
      </Layout>
    );
  }

  // ---------------- A baker's own link: everything on one page ----------------
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
            <p className="text-ink-soft">{tx('Type it like a chat. The cake and price update as you go.', 'I-type na parang chat. Kusang magbabago ang cake at presyo.')}</p>
          </div>

          <section className="card space-y-3" aria-labelledby="sec-msg">
            <SectionTitle id="sec-msg" n="01">
              {tx('What cake do you want?', 'Anong cake ang gusto mo?')}
            </SectionTitle>
            {descBox}
            {inspoCard}
            {building && photo && <PhotoBuilding photo={photo.dataUrl} ai={smartAvailable && !prefs.aiOff} />}
            {photoMatch}
            {smartButton}
            {photoError && <Notice tone="warn">{photoError}</Notice>}
            {examples}
            {photoNotRead}
            {hasText && <ReadSummary reading={reading} menu={menu} compact />}
          </section>

          <section className="card space-y-4" aria-labelledby="sec-basics">
            <SectionTitle id="sec-basics" n="02">
              {tx('The basics', 'Ang basics')}
            </SectionTitle>
            {occasionBlock}
            <div className="grid gap-4 sm:grid-cols-2">
              {peopleBlock}
              {budgetBlock}
            </div>
            {dateBlock}
            {allergyBlock}
          </section>

          <section className="space-y-3" aria-labelledby="sec-designs">
            <SectionTitle id="sec-designs" n="03">
              {tx('Pick a design', 'Pumili ng design')}
            </SectionTitle>
            {designsBlock}
            {customizeBlock}
          </section>

          <section className="card space-y-3" aria-labelledby="sec-contact">
            <SectionTitle id="sec-contact" n="04">
              {tx('Where can the baker reach you?', 'Saan ka makokontak ng baker?')}
            </SectionTitle>
            {contactBlock}
          </section>
        </div>
      </div>

      {!wide && visual && <MiniCake target={cakeRef} visual={visual} description={description} price={menu.showEstimates && estimate != null ? formatPeso(estimate) : null} />}

      {priceBar(
        <button type="button" className="btn shrink-0" disabled={!selection} onClick={submit}>
          {tx('Send to baker', 'Ipadala sa baker')} <IconArrow />
        </button>,
      )}
    </Layout>
  );
}

/** Price ranges for step 3: [above, up to]. */
const PRICE_RANGES: Array<[number, number]> = [
  [0, 1000],
  [1000, 2000],
  [2000, 3500],
  [3500, 6000],
];

/** 1 Idea, 2 Cake, 3 Price, 4 Bakers. Earlier steps can be revisited; later ones open once there is a cake. */
/**
 * 1 Idea, 2 Cake, 3 Price, 4 Bakers. Shows progress only (not buttons): each finished step's
 * circle fills in. Moving between steps is done with the Back and Next buttons at the bottom.
 */
function Stepper({ stage }: { stage: Stage }) {
  const tx = useTx();
  const steps: Array<[Stage | 'map', string]> = [
    ['idea', tx('Idea', 'Idea')],
    ['cake', tx('Cake', 'Cake')],
    ['price', tx('Price', 'Presyo')],
    ['map', tx('Bakers', 'Baker')],
  ];
  const at = steps.findIndex(([k]) => k === stage);
  return (
    <div className="mb-5" data-stepper>
      <p className="sr-only">{tx(`Step ${at + 1} of 4: ${steps[at]![1]}`, `Hakbang ${at + 1} sa 4: ${steps[at]![1]}`)}</p>
      <ol className="flex items-center gap-1" aria-hidden="true">
        {steps.map(([key, label], i) => {
          const current = i === at;
          const done = i < at;
          return (
            <li key={key} className="flex min-w-0 flex-1 items-center gap-1" data-step={key} data-step-state={done ? 'done' : current ? 'current' : 'todo'}>
              <span className="flex min-h-11 items-center gap-1.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors ${done ? 'bg-berry text-white' : current ? 'border-2 border-berry bg-white text-berry' : 'border border-line bg-white text-ink-soft'}`}>
                  {done ? <IconCheck size={14} /> : i + 1}
                </span>
                <span className={`step-label text-sm ${current ? 'font-semibold text-ink' : 'step-other text-ink-soft'}`}>{label}</span>
              </span>
              {i < steps.length - 1 && <span className={`h-0.5 min-w-2 flex-1 rounded-full transition-colors ${done ? 'bg-berry' : 'bg-line'}`} />}
            </li>
          );
        })}
      </ol>
    </div>
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

type DesignCardOption = Omit<DesignOption, 'tier'> & { tier: DesignTier };

function DesignCard({ option, menu, look, selected, onPick, budget, missing, mine = false }: { option: DesignCardOption; menu: PublicMenu; look: Draft['look']; selected: boolean; onPick: () => void; budget: number | null; missing: string[]; mine?: boolean }) {
  const tx = useTx();
  const prefs = usePrefs();
  const v = toVisual(menu, option.selection, look);
  const label = { simple: tx('Simple', 'Simple'), classic: tx('Classic', 'Classic'), showstopper: tx('Showstopper', 'Showstopper'), custom: tx('Your design', 'Sarili mong design') }[option.tier];
  // One line on what each design is, so a plain Simple cake doesn't look like a mistake.
  const what = {
    simple: tx('Plain, lowest price', 'Simple lang, pinakamura'),
    classic: budget != null ? tx('Most of what you want, within budget', 'Halos lahat ng gusto mo, pasok sa budget') : tx('What you asked for', 'Ang hiniling mo'),
    showstopper: tx('The fullest version', 'Pinakakumpleto'),
    custom: tx('As you made it in Customize', 'Gaya ng ginawa mo sa I-customize'),
  }[option.tier];
  const whatShown = mine ? tx('Same as the cake you made', 'Kapareho ng cake na ginawa mo') : what;
  const shownMissing = missing.length > 3 ? `${missing.slice(0, 3).join(', ')} +${missing.length - 3}` : missing.join(', ');
  const base = menu.baseCakes.find((b) => b.id === option.selection.baseCakeId);
  const parts = option.selection.componentIds.map((id) => menu.components.find((c) => c.id === id)).filter((c) => !!c && c.category !== 'flavor');
  return (
    <button type="button" role="radio" aria-checked={selected} data-design={option.tier} onClick={onPick} className={`card text-left transition ${selected ? '!border-ink ring-1 ring-ink' : 'hover:border-[#cdbdb0]'}`}>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg">{label}</span>
        {selected && (
          <span className="tag bg-ink text-white">
            <IconCheck size={13} /> {tx('Picked', 'Napili')}
          </span>
        )}
      </div>
      <p className={`text-sm ${mine ? 'font-semibold text-berry' : 'text-ink-soft'}`}>{whatShown}</p>
      <Cake2D visual={v} title={describeCake(v, prefs.lang)} crop className="my-3 h-36 w-full rounded-xl bg-[#faf6f1]" />
      <p className="text-sm text-ink-soft">
        {base?.sizeLabel} · {tx('feeds', 'pang')} {option.servings}
      </p>
      <p className="text-sm">{parts.map((p) => p!.name).join(', ')}</p>
      {missing.length > 0 && (
        <p className="mt-1 text-sm text-ink-soft" data-card-missing>
          {tx('Leaves out', 'Wala rito')}: {shownMissing}
        </p>
      )}
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
        {/* A second color is rarely needed: folded so the list stays short. */}
        <details className="mt-3" open={!!look.colors[1] || undefined}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-soft">{tx('Add an accent color (optional)', 'Magdagdag ng pangalawang kulay (optional)')}</summary>
          <div className="mt-1">{swatch(1)}</div>
        </details>
      </section>
      <section>
        <h2 className="label">{tx('Decorations', 'Dekorasyon')}</h2>
        <div className="flex flex-wrap gap-2">
          {extras.map((c) => (
            <Chip key={c.id} pressed={has(c.id)} onClick={() => toggle(c.id)}>
              {tx(c.name, c.nameTl ?? c.name)}
              {prices && <span className="whitespace-nowrap text-sm text-ink-soft">+{formatPeso(delta(c.id))}</span>}
            </Chip>
          ))}
        </div>
      </section>
      <Placement menu={menu} selection={selection} look={look} onChange={onChange} />
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
                {prices && <span className="whitespace-nowrap text-sm text-ink-soft">+{formatPeso(delta(c!.id))}</span>}
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
            {prices && <span className="whitespace-nowrap text-sm text-ink-soft">+{formatPeso(delta(candlePart.id))}</span>}
          </div>
        </section>
      )}
      <StandAndOwn menu={menu} selection={selection} look={look} onChange={onChange} prices={prices} delta={delta} />
    </div>
  );
}

/** One-tap placement presets: shown only for parts that are on the cake. */
function Placement({ menu, selection, look, onChange }: { menu: PublicMenu; selection: Selection; look: Draft['look']; onChange: (s: Selection, l: Draft['look']) => void }) {
  const tx = useTx();
  const visuals = selection.componentIds.map((id) => menu.components.find((c) => c.id === id)?.visual);
  const flowers = visuals.includes('flowers');
  const topper = visuals.includes('motif') || visuals.includes('figure') || visuals.includes('acrylic');
  if (!flowers && !topper) return null;
  return (
    <section className="space-y-3" aria-labelledby="place-h" data-placement>
      <h2 className="label" id="place-h">{tx('Placement', 'Pagkakaayos')}</h2>
      {flowers && (
        <div role="group" aria-label={tx('Flowers', 'Bulaklak')}>
          <p className="hint mb-2">{tx('Flowers', 'Bulaklak')}</p>
          <div className="flex flex-wrap gap-2">
            {FLOWER_STYLES.map((f) => (
              <Chip key={f} pressed={(look.flowerStyle ?? 'side') === f} onClick={() => onChange(selection, { ...look, flowerStyle: f })}>
                {tx(FLOWER_LABELS[f][0], FLOWER_LABELS[f][1])}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {topper && (
        <div role="group" aria-label={tx('Topper', 'Topper')}>
          <p className="hint mb-2">{tx('Topper', 'Topper')}</p>
          <div className="flex flex-wrap gap-2">
            {TOPPER_SPOTS.map((t) => (
              <Chip key={t} pressed={(look.topperSpot ?? 'center') === t} onClick={() => onChange(selection, { ...look, topperSpot: t })}>
                {t === 'center' ? tx('In the middle', 'Sa gitna') : tx('To one side', 'Sa gilid')}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-ink-soft">{tx('The baker follows this as a guide; exact spots may differ a little.', 'Gabay ito sa baker; puwedeng bahagyang mag-iba ang eksaktong puwesto.')}</p>
    </section>
  );
}

/** Cake stand (priced by the baker, or the customer's own) and other things the customer brings. */
function StandAndOwn({ menu, selection, look, onChange, prices, delta }: { menu: PublicMenu; selection: Selection; look: Draft['look']; onChange: (s: Selection, l: Draft['look']) => void; prices: boolean; delta: (id: string) => number }) {
  const tx = useTx();
  const stands = menu.components.filter((c) => c.category === 'display');
  const own = look.own ?? [];
  const noStands = selection.componentIds.filter((id) => menu.components.find((c) => c.id === id)?.category !== 'display');
  const pickedStand = selection.componentIds.find((id) => stands.some((s) => s.id === id));
  const ownStand = own.includes('stand');
  const setOwn = (item: OwnItem, on: boolean) => {
    const next = on ? [...own.filter((x) => x !== item), item] : own.filter((x) => x !== item);
    return { ...look, own: next.length ? next : undefined };
  };
  return (
    <>
      <section aria-labelledby="stand-h" data-stand>
        <h2 className="label" id="stand-h">{tx('Cake stand', 'Cake stand')}</h2>
        <div className="flex flex-wrap gap-2">
          <Chip pressed={!pickedStand && !ownStand} onClick={() => onChange({ ...selection, componentIds: noStands }, setOwn('stand', false))}>
            {tx('Standard stand', 'Karaniwang stand')}
          </Chip>
          {stands.map((c) => (
            <Chip key={c.id} pressed={pickedStand === c.id} onClick={() => onChange({ ...selection, componentIds: [...noStands, c.id] }, setOwn('stand', false))}>
              {tx(c.name, c.nameTl ?? c.name)}
              {prices && <span className="whitespace-nowrap text-sm text-ink-soft">+{formatPeso(delta(c.id))}</span>}
            </Chip>
          ))}
          <Chip pressed={ownStand} onClick={() => onChange({ ...selection, componentIds: noStands }, setOwn('stand', !ownStand))}>
            {tx(OWN_LABELS.stand[0], OWN_LABELS.stand[1])} <span className="text-sm text-ink-soft">₱0</span>
          </Chip>
        </div>
      </section>
      <section aria-labelledby="own-h" data-own>
        <h2 className="label" id="own-h">{tx('Bringing your own?', 'May dadalhin kang sarili?')}</h2>
        <div className="flex flex-wrap gap-2">
          {(['topper', 'figurine'] as const).map((k) => (
            <Chip key={k} pressed={own.includes(k)} onClick={() => onChange(selection, setOwn(k, !own.includes(k)))}>
              {tx(OWN_LABELS[k][0], OWN_LABELS[k][1])} <span className="text-sm text-ink-soft">₱0</span>
            </Chip>
          ))}
        </div>
        {own.length > 0 && (
          <p className="mt-2 text-sm text-ink-soft" data-own-note>
            {tx('Free: the baker places what you bring. Add a photo of it in the inspo photo box at the top, so the baker knows its size.', 'Libre: ilalagay ng baker ang dadalhin mo. Idagdag ang picture nito sa inspo photo sa itaas para alam ng baker ang laki.')}
          </p>
        )}
      </section>
    </>
  );
}


/** What the inspo photo turned into: shown right under the photo, so the customer can check it. */
function PhotoMatch({ hints, menu, hasPhoto, onSee, onRemove }: { hints: PhotoHints; menu: PublicMenu; hasPhoto: boolean; onSee: () => void; onRemove: () => void }) {
  const tx = useTx();
  const names = [hints.flavorId, hints.coveringId, ...hints.componentIds]
    .map((id) => menu.components.find((c) => c.id === id)?.name)
    .filter((n): n is string => !!n);
  const bits = [
    hints.tiers ? tx(`${hints.tiers} tier${hints.tiers > 1 ? 's' : ''}`, `${hints.tiers} tier`) : '',
    ...names,
    hints.flowerStyle ? tx(`flowers: ${FLOWER_LABELS[hints.flowerStyle][0].toLowerCase()}`, `bulaklak: ${FLOWER_LABELS[hints.flowerStyle][1].toLowerCase()}`) : '',
  ].filter(Boolean);
  const featured = showcaseByKey(hints.showcase);
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-white p-3" data-photo-match data-showcase={featured?.key}>
      {featured && <p className="eyebrow">{tx('Featured design', 'Featured design')}</p>}
      <p className="font-semibold">
        {featured ? tx(featured.name[0], featured.name[1]) : hasPhoto ? tx('Your cake, made from the photo', 'Ang cake mo, mula sa photo') : tx('Using the details from your photo', 'Gamit ang detalye mula sa photo mo')}
      </p>
      {hints.colors.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">{tx('Colors', 'Kulay')}:</span>
          {hints.colors.map((c) => (
            <span key={c.hex} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-4 w-4 rounded-full border border-line" style={{ background: c.hex }} aria-hidden="true" />
              {c.name}
            </span>
          ))}
        </p>
      )}
      {bits.length > 0 && <p className="text-sm">{bits.join(' · ')}</p>}
      {hints.unavailable.length > 0 && (
        <p className="text-sm text-amber-ink">
          {tx(`Not on ${menu.name}'s menu, so not on the cake`, `Wala sa menu ng ${menu.name}, kaya wala sa cake`)}: {hints.unavailable.join(', ')}
        </p>
      )}
      {featured ? (
        <p className="text-sm text-ink-soft">
          {tx('Make it theirs: type the name, age and colors above, e.g. "for Migo\'s 7th birthday, green".', 'Gawing kanya: i-type sa itaas ang pangalan, edad at kulay, hal. "para kay Migo, 7th birthday, green".')}{' '}
          {tx('The logo and characters become generic blocky ones.', 'Generic na blocky ang logo at mga character.')}
        </p>
      ) : (
        !hints.usedAi && <p className="text-sm text-ink-soft">{tx('Colors matched. Type the tiers and decorations above.', 'Kinuha ang kulay. I-type sa itaas ang tier at dekorasyon.')}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="link min-h-11 text-sm" onClick={onSee} data-see-photo-cake>
          {tx('See the cake', 'Tingnan ang cake')}
        </button>
        {!hasPhoto && (
          <button type="button" className="min-h-11 text-sm text-ink-soft underline underline-offset-4" onClick={onRemove}>
            {tx('Stop using it', 'Huwag nang gamitin')}
          </button>
        )}
      </div>
    </div>
  );
}

/** While a photo is read: the photo with a light sweeping over it and the steps ticking along. */
function PhotoBuilding({ photo, ai }: { photo: string | null; ai: boolean }) {
  const tx = useTx();
  const steps = [
    photo ? tx('Reading the colors', 'Binabasa ang mga kulay') : tx('Reading your request', 'Binabasa ang request mo'),
    ai ? tx('Finding the decorations', 'Hinahanap ang mga dekorasyon') : tx('Matching the frosting', 'Itinutugma ang frosting'),
    tx('Pricing the parts', 'Pinepresyuhan ang mga part'),
    tx('Building your 3D cake', 'Binubuo ang 3D cake mo'),
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => Math.min(steps.length - 1, s + 1)), ai ? 1100 : 450);
    return () => window.clearInterval(t);
  }, [steps.length, ai]);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3" data-photo-building role="status" aria-live="polite">
      <div className="photo-scan grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-berry-soft text-berry">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <IconSparkle size={30} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{photo ? tx('Building your cake from the photo…', 'Ginagawa ang cake mula sa photo…') : tx('Building your cake…', 'Ginagawa ang cake mo…')}</p>
        <ol className="mt-1 space-y-0.5 text-sm">
          {steps.map((label, i) => (
            <li key={label} className={`flex items-center gap-2 ${i > step ? 'text-ink-soft' : i === step ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
              {i < step ? (
                <IconCheck size={14} className="shrink-0 text-ok-ink" />
              ) : (
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${i === step ? 'build-dot bg-berry' : 'bg-line'}`} aria-hidden="true" />
              )}
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
