import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { cloudEnabled } from '../cloud/config';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Cake2D } from '../cake/Cake2D';
import { describeCake } from '../cake/describe';
import { Layout } from '../components/Layout';
import { IconAlert, IconArrow, IconCheck, IconChevron, IconPin, IconStore, IconTruck } from '../components/icons';
import { Chip, Notice } from '../components/ui';
import { DEFAULT_SPOT, formatKm, type LatLng } from '../domain/geo';
import { matchBakeries, sortMatches, type BakeryMatch, type ListedBakery, type MatchSort } from '../domain/matching';
import { formatPeso } from '../domain/money';
import { toPublicMenu } from '../domain/pricing';
import { createSampleBakery, SAMPLE_BASE_CAKES, SAMPLE_COMPONENTS } from '../domain/starterMenus';
import { toVisual } from '../domain/visual';
import { listedBakeries } from '../data/directory';
import { useDraft, writeDraft } from '../data/draft';
import { localBakeryFor, useDb, type MyRequest } from '../data/store';
import { celebrate } from '../lib/celebrate';
import { usePrefs, useTx } from '../lib/prefs';
import { currentCake } from './customerCake';
import { carriedPhoto, sendCakeRequest } from './sendRequest';

const BakeryMap = lazy(() => import('./near/BakeryMap'));

type Spot = LatLng & { label: string };
const SPOT_KEY = 'cakeita.spot.v1';

function loadSpot(): Spot | null {
  try {
    const raw = sessionStorage.getItem(SPOT_KEY);
    const v = raw ? (JSON.parse(raw) as Spot) : null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    return null;
  }
}

export default function NearBakers() {
  const tx = useTx();
  const prefs = usePrefs();
  const nav = useNavigate();
  const loc = useLocation();
  const from = new URLSearchParams(loc.search).get('from') || 'sample';
  const origin = useMemo(() => toPublicMenu(localBakeryFor(from) ?? createSampleBakery()), [from]);
  const [draft] = useDraft(origin.slug);
  const today = useMemo(() => new Date(), []);
  const cake = currentCake(origin, draft, today);
  const hasCake = cake.hasText || draft.servings != null || draft.budget != null || !!draft.selection;
  const db = useDb();
  // Details already filled in on the design page: the customer picks a baker here and it is sent from here.
  const ready = !!cake.selection && !!cake.eventDate && !!draft.name.trim() && draft.contact.trim().length >= 5 && draft.consent;
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');

  const defaultSpot: Spot = { lat: DEFAULT_SPOT.lat, lng: DEFAULT_SPOT.lng, label: tx(DEFAULT_SPOT.label, DEFAULT_SPOT.labelTl) };
  const [spot, setSpotState] = useState<Spot>(() => loadSpot() ?? defaultSpot);
  const [radius, setRadius] = useState<number | null>(10);
  const [onlyCan, setOnlyCan] = useState(true);
  const [sort, setSort] = useState<MatchSort>('best');
  const [selected, setSelected] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  const setSpot = (s: Spot) => {
    setSpotState(s);
    try {
      sessionStorage.setItem(SPOT_KEY, JSON.stringify(s));
    } catch {
      /* fine */
    }
  };

  const nameOf = (id: string) =>
    origin.components.find((c) => c.id === id)?.name ??
    origin.baseCakes.find((b) => b.id === id)?.name ??
    SAMPLE_COMPONENTS.find((c) => c.id === id)?.name ??
    SAMPLE_BASE_CAKES.find((b) => b.id === id)?.name ??
    id;

  // Real bakers (accounts that chose to be listed) first, then the labeled sample shops.
  const [real, setReal] = useState<ListedBakery[]>([]);
  useEffect(() => {
    if (!cloudEnabled()) return;
    let alive = true;
    import('../cloud/data')
      .then((m) => m.fetchListings())
      .then((l) => alive && setReal(l))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // The demo baker running on this phone shows up too, so one laptop can play customer and baker.
  const demoBaker = db.bakery?.isSample && db.bakery.slug === 'sample' ? db.bakery : null;
  const listed = useMemo(() => {
    const own: ListedBakery[] = demoBaker
      ? [{ menu: toPublicMenu(demoBaker), lat: spot.lat + 0.004, lng: spot.lng + 0.004, area: tx('On this phone (demo baker)', 'Nasa phone na ito (demo baker)'), deliveryKm: 5, tags: [tx('Demo: you answer as the baker', 'Demo: ikaw ang sasagot bilang baker')] }]
      : [];
    return [...own, ...real, ...listedBakeries()];
  }, [real, demoBaker, spot.lat, spot.lng, tx]);
  const all = useMemo(() => {
    if (!cake.selection) return [];
    const want = { selection: cake.selection, servings: cake.wants.servings, budget: cake.wants.budget, eventDate: cake.eventDate };
    return sortMatches(matchBakeries(want, listed, spot, nameOf, today), sort);
  }, [JSON.stringify(cake.selection), cake.wants.servings, cake.wants.budget, cake.eventDate, spot, sort, listed]); // eslint-disable-line react-hooks/exhaustive-deps
  // Requests for this same cake date already sent from this phone, by baker.
  const asked = new Map<string, MyRequest>();
  for (const r of db.myRequests) if (r.eventDate && r.eventDate === cake.eventDate && r.fromSlug === origin.slug && !asked.has(r.bakerySlug)) asked.set(r.bakerySlug, r);
  const inRange = all.filter((m) => radius == null || m.distanceKm <= radius);
  const shown = inRange.filter((m) => !onlyCan || m.suitable);
  const hidden = inRange.length - shown.length;

  const visual = cake.selection ? toVisual(origin, cake.selection, cake.look) : null;
  const cakeText = visual ? describeCake(visual, prefs.lang) : '';

  const useMyLocation = () => {
    setLocError('');
    if (!('geolocation' in navigator)) {
      setLocError(tx('This phone can’t share its location. Tap the map instead.', 'Hindi maibahagi ng phone ang location. I-tap na lang ang mapa.'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setSpot({ lat: p.coords.latitude, lng: p.coords.longitude, label: tx('You are here', 'Nandito ka') });
      },
      () => {
        setLocating(false);
        setLocError(tx('Location is off or blocked. Tap the map to place your pin instead.', 'Naka-off o naka-block ang location. I-tap ang mapa para ilagay ang pin mo.'));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const orderFrom = (m: BakeryMatch) => {
    writeDraft(m.slug, {
      ...draft,
      step: 'order',
      occasion: cake.occasion,
      eventDate: cake.eventDate,
      servings: cake.wants.servings,
      budget: cake.wants.budget,
      noBudget: cake.wants.budget == null && draft.noBudget,
      reading: null,
      readingFor: '',
      selection: m.selection,
      look: cake.look,
      lookTouched: true,
      sentId: null,
      sentLink: null,
      sentMessage: null,
    });
    nav(`/b/${m.slug}`);
  };

  /** Send this cake to one baker, from here. Each baker gets the cake in their own menu's parts and price. */
  const sendTo = async (m: BakeryMatch) => {
    const to = listed.find((l) => l.menu.slug === m.slug)?.menu;
    if (!to || sending) return;
    setSending(m.slug);
    setSendError('');
    try {
      const sel = m.selection;
      const res = await sendCakeRequest(
        {
          menu: to,
          fromSlug: origin.slug,
          name: draft.name,
          contact: draft.contact,
          note: draft.note,
          description: draft.description,
          occasion: cake.occasion,
          eventDate: cake.eventDate,
          servings: cake.wants.servings ?? to.baseCakes.find((b) => b.id === sel.baseCakeId)?.servings ?? 1,
          budget: cake.wants.budget,
          tier: draft.selection ? 'custom' : draft.tier,
          selection: sel,
          look: cake.look,
          theme: cake.reading.theme ?? '',
          licensedNote: cake.reading.licensedNote ?? '',
          unavailable: [...new Set([...(cake.reading.unavailable ?? []), ...m.missing])],
          estimate: m.estimate,
          summary: describeCake(toVisual(to, sel, cake.look), prefs.lang),
          photo: carriedPhoto(),
          notifySub: null,
          lang: prefs.lang,
        },
        tx,
      );
      if (!res.ok) {
        setSendError(tx('Something is missing. Go back to your cake and check your answers.', 'May kulang pa. Bumalik sa cake mo at i-check ang mga sagot.'));
        return;
      }
      celebrate();
      nav(`/o/${res.id}`);
    } finally {
      setSending(null);
    }
  };

  const pick = (slug: string) => {
    setSelected(slug);
    document.getElementById(`bk-${slug}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="space-y-1">
          {ready ? (
            <>
              <p className="eyebrow">{tx('Step 2 of 2', 'Hakbang 2 sa 2')}</p>
              <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{tx('Choose who bakes your cake', 'Piliin kung sino ang magbe-bake ng cake mo')}</h1>
              <p className="text-ink-soft" data-choose-intro>
                {tx('Best match first. Send to one baker; if they say no, pick another.', 'Nauuna ang pinakaangkop. Ipadala sa isa; kung tumanggi, pumili ng iba.')}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{tx('Bakers near you who can make your cake', 'Mga baker na malapit sa iyo na kayang gawin ang cake mo')}</h1>
              <p className="text-ink-soft">{tx('Same cake, each baker’s own price.', 'Parehong cake, sariling presyo ng bawat baker.')}</p>
            </>
          )}
        </div>

        {/* The cake being compared */}
        <section className="card flex items-center gap-3" aria-label={tx('Your cake', 'Ang cake mo')}>
          {visual && <Cake2D visual={visual} title={cakeText} className="h-20 w-24 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="font-bold">{hasCake ? tx('Your cake', 'Ang cake mo') : tx('Example cake', 'Halimbawang cake')}</p>
            <p className="text-sm">{cakeText}</p>
            <p className="text-sm text-ink-soft">
              {[cake.wants.servings ? `${cake.wants.servings} ${tx('people', 'tao')}` : '', cake.wants.budget != null ? `budget ${formatPeso(cake.wants.budget)}` : '', cake.eventDate].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Link to={`/b/${origin.slug}`} className="btn-ghost shrink-0">
            {hasCake ? tx('Edit', 'I-edit') : tx('Design mine', 'I-design ko')}
          </Link>
        </section>

        {/* Where + filters: one line, the rest folded away */}
        <details className="group rounded-2xl border border-line bg-white" data-filters aria-label={tx('Location and filters', 'Lokasyon at filter')}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm">
            <IconPin className="shrink-0 text-berry" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {radius == null ? tx('Any distance', 'Kahit gaano kalayo') : `${radius} km`} · {spot.label}
            </span>
            <span className="shrink-0 font-semibold text-berry">{tx('Filters', 'Filter')}</span>
            <IconChevron size={16} className="shrink-0 text-berry transition group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-line px-4 py-3">
            <button type="button" className="btn-ghost" onClick={useMyLocation} disabled={locating}>
              {locating ? tx('Finding you…', 'Hinahanap ka…') : tx('Use my location', 'Gamitin ang location ko')}
            </button>
            <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Distance', 'Layo')}>
              {[3, 5, 10, 20].map((km) => (
                <Chip key={km} pressed={radius === km} onClick={() => setRadius(km)}>
                  {km} km
                </Chip>
              ))}
              <Chip pressed={radius == null} onClick={() => setRadius(null)}>
                {tx('Any distance', 'Kahit gaano kalayo')}
              </Chip>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-[#8c2246]" checked={onlyCan} onChange={(e) => setOnlyCan(e.target.checked)} />
                {tx('Only bakers who can make it', 'Yung kaya lang gawin')}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                {tx('Sort', 'Ayusin')}
                <select className="input min-h-11 w-auto py-1" value={sort} onChange={(e) => setSort(e.target.value as MatchSort)}>
                  <option value="best">{tx('Best match', 'Pinakaangkop')}</option>
                  <option value="nearest">{tx('Nearest', 'Pinakamalapit')}</option>
                  <option value="cheapest">{tx('Cheapest', 'Pinakamura')}</option>
                </select>
              </label>
            </div>
          </div>
        </details>
        {locError && <Notice tone="warn">{locError}</Notice>}

        <Suspense fallback={<div className="cakeita-map grid place-items-center text-ink-soft">{tx('Loading map…', 'Nilo-load ang mapa…')}</div>}>
          <BakeryMap
            spot={spot}
            matches={shown}
            selected={selected}
            radiusKm={radius}
            onSelect={pick}
            onMoveSpot={(p) => setSpot({ ...p, label: tx('your pin', 'pin mo') })}
            labels={{
              you: tx('You', 'Ikaw'),
              tapHint: tx('Tap the map to move your pin', 'I-tap ang mapa para ilipat ang pin'),
              offline: tx('Map pictures could not load on this network or browser (an ad blocker can do this). Prices and the list below still work.', 'Hindi ma-load ang mapa sa network o browser na ito (puwedeng dahil sa ad blocker). Gumagana pa rin ang presyo at listahan sa baba.'),
            }}
          />
        </Suspense>
        <p className="flex flex-wrap gap-3 text-xs text-ink-soft" aria-hidden="true">
          <span><span className="pin-dot bg-ok-bg" /> {tx('Fits budget', 'Pasok sa budget')}</span>
          <span><span className="pin-dot bg-amber-bg" /> {tx('Over budget', 'Lampas sa budget')}</span>
          {!onlyCan && <span><span className="pin-dot bg-[#ece7e4]" /> {tx("Can't make all of it", 'Hindi kaya lahat')}</span>}
        </p>

        {/* Results */}
        <section className="space-y-3" aria-labelledby="results-h">
          <h2 id="results-h" className="font-display text-xl font-semibold" aria-live="polite">
            {shown.length === 0
              ? tx('No bakers match yet', 'Wala pang tugmang baker')
              : tx(`${shown.length} ${shown.length === 1 ? 'baker' : 'bakers'} can make it`, `${shown.length} baker ang kaya itong gawin`)}
          </h2>
          {sendError && <Notice tone="danger">{sendError}</Notice>}
          {shown.length === 0 && (
            <Notice tone="info">
              {hidden > 0
                ? tx(`${hidden} baker(s) nearby can’t make all of it or can’t make your date. Untick “Only bakers who can make it” to see them, or try a bigger distance.`, `May ${hidden} baker na malapit pero hindi kaya lahat o hindi abot sa petsa. Alisin ang check sa “Yung kaya lang gawin”, o lakihan ang layo.`)
                : tx('Try a bigger distance.', 'Subukan ang mas malayong distansya.')}
            </Notice>
          )}
          <ul className="space-y-3">
            {shown.map((m) => (
              <li key={m.slug} id={`bk-${m.slug}`}>
                <BakerCard
                  m={m}
                  best={ready && sort === 'best' && m.suitable && m === shown[0]}
                  selected={selected === m.slug}
                  onSelect={() => setSelected(m.slug)}
                  onOrder={() => orderFrom(m)}
                  onSend={ready ? () => sendTo(m) : null}
                  sending={sending === m.slug}
                  asked={asked.get(m.slug) ?? null}
                />
              </li>
            ))}
          </ul>
          {hidden > 0 && shown.length > 0 && (
            <p className="text-sm text-ink-soft">
              {tx(`${hidden} more nearby can’t make all of it or can’t make your date.`, `May ${hidden} pang malapit na hindi kaya lahat o hindi abot sa petsa.`)}{' '}
              <button type="button" className="text-berry underline" onClick={() => setOnlyCan(false)}>
                {tx('Show them', 'Ipakita')}
              </button>
            </p>
          )}
        </section>

        <p className="text-center text-xs text-ink-soft" data-sample-note>
          {tx('“(sample)” shops are fictional and answer by themselves so you can try it. Real bakers answer by hand.', 'Ang may “(sample)” ay hindi totoong shop at kusang sumasagot para masubukan mo. Ang totoong baker ay sumasagot mismo.')}
        </p>
      </div>
    </Layout>
  );
}

function BakerCard({ m, best, selected, onSelect, onOrder, onSend, sending, asked }: { m: BakeryMatch; best: boolean; selected: boolean; onSelect: () => void; onOrder: () => void; onSend: (() => void) | null; sending: boolean; asked: MyRequest | null }) {
  const tx = useTx();
  const short = m.name.replace(' (sample)', '').replace(' (demo data)', '');
  const askedLabel = asked
    ? asked.status === 'declined'
      ? tx('Said no to this cake', 'Tumanggi sa cake na ito')
      : asked.status === 'quoted'
        ? tx('Answered you', 'Sumagot na')
        : asked.status === 'confirmed'
          ? tx('Confirmed', 'Confirmed')
          : tx('Request sent', 'Naipadala na')
    : '';
  return (
    <article className={`card space-y-3 ${selected ? '!border-ink ring-1 ring-ink' : ''}`} aria-label={m.name} onClick={onSelect} data-baker-card={m.slug}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {best && <span className="tag mb-1 bg-ink text-white" data-best-match>{tx('Best match', 'Pinakaangkop')}</span>}
          <h3 className="font-display text-lg font-semibold leading-tight">{m.name}</h3>
          <p className="text-sm text-ink-soft">
            {m.area} · {formatKm(m.distanceKm)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-soft">{tx('About', 'Mga')}</p>
          <p className="price text-2xl">{m.estimate != null ? formatPeso(m.estimate) : '—'}</p>
          {m.fitsBudget != null && (
            <span className={`tag ${m.fitsBudget ? 'bg-ok-bg text-ok-ink' : 'bg-amber-bg text-amber-ink'}`}>{m.fitsBudget ? tx('Fits budget', 'Pasok sa budget') : tx('Over budget', 'Lampas sa budget')}</span>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 border-t border-line pt-3 text-sm">
        {m.canMakeAll && m.leadOk && !m.booked && m.servesOk ? (
          <Fact ok>{tx('Can make it all, in time for your date', 'Kaya lahat, abot sa petsa mo')}</Fact>
        ) : (
          <>
            {!m.canMakeAll && <Fact ok={false}>{`${tx('Doesn’t make', 'Hindi gumagawa ng')}: ${m.missing.join(', ')}`}</Fact>}
            {!m.leadOk && <Fact ok={false}>{tx(`Needs ${m.leadTimeDays} days' notice, too soon for your date`, `Kailangan ng ${m.leadTimeDays} araw na abiso, masyadong maaga ang petsa mo`)}</Fact>}
            {m.booked && <Fact ok={false}>{tx('Fully booked on your date', 'Puno na ang schedule sa petsa mo')}</Fact>}
            {!m.servesOk && <Fact ok={false}>{tx('Their biggest cake may not feed everyone', 'Baka kulang ang pinakamalaki nilang cake')}</Fact>}
          </>
        )}
      </ul>
      {!onSend && m.tags.length > 0 && (
        <p className="flex flex-wrap gap-1">
          {m.tags.map((t) => (
            <span key={t} className="tag border border-line bg-[#faf6f1] text-ink-soft">
              {t}
            </span>
          ))}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
          {m.delivers ? <IconTruck className="shrink-0" /> : <IconStore className="shrink-0" />}
          <span>{m.delivers ? tx(`Delivers, ${m.deliveryKm} km`, `Deliver, ${m.deliveryKm} km`) : tx('Pickup', 'Pickup')}</span>
        </p>
        {asked ? (
          <Link to={`/o/${asked.id}`} className="btn-secondary shrink-0 !px-4" onClick={(e) => e.stopPropagation()} data-asked aria-label={`${askedLabel}: ${tx('see their answer', 'tingnan ang sagot')}`}>
            {askedLabel} <IconArrow />
          </Link>
        ) : onSend ? (
          <button type="button" className="btn shrink-0" disabled={sending} onClick={(e) => { e.stopPropagation(); onSend(); }} data-send-to={m.slug} aria-label={sending ? undefined : tx(`Send my cake to ${short}`, `Ipadala kay ${short}`)}>
            {sending ? tx('Sending…', 'Ipinapadala…') : tx('Send', 'Ipadala')} <IconArrow />
          </button>
        ) : (
          <button type="button" className="btn shrink-0" onClick={(e) => { e.stopPropagation(); onOrder(); }} aria-label={tx(`Request from ${short}`, `Mag-request kay ${short}`)}>
            {tx('Request', 'Mag-request')} <IconArrow />
          </button>
        )}
      </div>
    </article>
  );
}

/** One line of a baker's fit: a green check when it's fine, an amber warning when it isn't. */
function Fact({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      {ok ? <IconCheck className="mt-0.5 shrink-0 text-ok-ink" /> : <IconAlert className="mt-0.5 shrink-0 text-amber-ink" />}
      <span className={ok ? '' : 'text-amber-ink'}>{children}</span>
    </li>
  );
}
