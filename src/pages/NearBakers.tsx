import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Cake2D } from '../cake/Cake2D';
import { describeCake } from '../cake/describe';
import { Layout } from '../components/Layout';
import { Chip, Notice } from '../components/ui';
import { DEFAULT_SPOT, formatKm, type LatLng } from '../domain/geo';
import { matchBakeries, sortMatches, type BakeryMatch, type MatchSort } from '../domain/matching';
import { formatPeso } from '../domain/money';
import { toPublicMenu } from '../domain/pricing';
import { createSampleBakery, SAMPLE_BASE_CAKES, SAMPLE_COMPONENTS } from '../domain/starterMenus';
import { toVisual } from '../domain/visual';
import { listedBakeries } from '../data/directory';
import { useDraft, writeDraft } from '../data/draft';
import { localBakeryFor } from '../data/store';
import { usePrefs, useTx } from '../lib/prefs';
import { currentCake } from './customerCake';

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

  const listed = useMemo(() => listedBakeries(), []);
  const all = useMemo(() => {
    if (!cake.selection) return [];
    const want = { selection: cake.selection, servings: cake.wants.servings, budget: cake.wants.budget, eventDate: cake.eventDate };
    return sortMatches(matchBakeries(want, listed, spot, nameOf, today), sort);
  }, [JSON.stringify(cake.selection), cake.wants.servings, cake.wants.budget, cake.eventDate, spot, sort, listed]); // eslint-disable-line react-hooks/exhaustive-deps
  const inRange = all.filter((m) => radius == null || m.distanceKm <= radius);
  const shown = inRange.filter((m) => !onlyCan || m.suitable);
  const hidden = inRange.length - shown.length;
  const cheapest = shown.reduce<BakeryMatch | null>((a, m) => (m.estimate != null && (a == null || m.estimate < (a.estimate ?? Infinity)) ? m : a), null);

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

  const pick = (slug: string) => {
    setSelected(slug);
    document.getElementById(`bk-${slug}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{tx('Bakers near you who can make your cake', 'Mga baker na malapit sa iyo na kayang gawin ang cake mo')}</h1>
          <p className="text-ink-soft">{tx('Same cake, priced from each baker’s own costs. Each baker still confirms the final price.', 'Parehong cake, presyo mula sa sariling gastos ng bawat baker. Ang baker pa rin ang magko-confirm ng final na presyo.')}</p>
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

        {/* Where + filters */}
        <section className="space-y-3" aria-label={tx('Location and filters', 'Lokasyon at filter')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              <span aria-hidden="true">📍</span> {tx('Near', 'Malapit sa')} {spot.label}
            </span>
            <button type="button" className="btn-ghost" onClick={useMyLocation} disabled={locating}>
              {locating ? tx('Finding you…', 'Hinahanap ka…') : tx('Use my location', 'Gamitin ang location ko')}
            </button>
          </div>
          {locError && <Notice tone="warn">{locError}</Notice>}
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
              <input type="checkbox" className="h-5 w-5 accent-[#b3164f]" checked={onlyCan} onChange={(e) => setOnlyCan(e.target.checked)} />
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
        </section>

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
              offline: tx('Map pictures need internet. Prices and the list below still work.', 'Kailangan ng internet para sa mapa. Gumagana pa rin ang presyo at listahan sa baba.'),
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
          <h2 id="results-h" className="font-display text-xl font-bold" aria-live="polite">
            {shown.length === 0
              ? tx('No bakers match yet', 'Wala pang tugmang baker')
              : tx(`${shown.length} ${shown.length === 1 ? 'baker' : 'bakers'} can make it`, `${shown.length} baker ang kaya itong gawin`)}
          </h2>
          {cheapest && shown.length > 1 && (
            <p className="text-sm">
              {tx('Lowest estimate', 'Pinakamababang tantya')}: <strong>{formatPeso(cheapest.estimate!)}</strong> {tx('at', 'sa')} {cheapest.name}
            </p>
          )}
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
                <BakerCard m={m} selected={selected === m.slug} onSelect={() => setSelected(m.slug)} onOrder={() => orderFrom(m)} />
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

        <Notice tone="info" title={tx('About these bakeries', 'Tungkol sa mga bakery na ito')}>
          {tx(
            'For this demo, every shop on the map is a fictional sample with its own sample prices. Real home bakers can join from Baker → My link → “Get on the map”.',
            'Para sa demo, lahat ng shop sa mapa ay sample lang (hindi totoo) at may sariling sample na presyo. Puwedeng sumali ang totoong home baker sa Baker → My link → “Get on the map”.',
          )}
        </Notice>
      </div>
    </Layout>
  );
}

function BakerCard({ m, selected, onSelect, onOrder }: { m: BakeryMatch; selected: boolean; onSelect: () => void; onOrder: () => void }) {
  const tx = useTx();
  return (
    <article className={`card space-y-2 ${selected ? 'border-2 border-berry ring-4 ring-berry-soft' : ''}`} aria-label={m.name} onClick={onSelect}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight">{m.name}</h3>
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
      <ul className="space-y-1 text-sm">
        <li>{m.canMakeAll ? <>✅ {tx('Can make everything you picked', 'Kaya lahat ng pinili mo')}</> : <>⚠️ {tx('Doesn’t make', 'Hindi gumagawa ng')}: {m.missing.join(', ')}</>}</li>
        <li>{m.leadOk ? <>✅ {tx(`Needs ${m.leadTimeDays} day(s) notice, OK for your date`, `Kailangan ng ${m.leadTimeDays} araw na abiso, abot sa petsa mo`)}</> : <>⚠️ {tx(`Needs ${m.leadTimeDays} days' notice, too soon for your date`, `Kailangan ng ${m.leadTimeDays} araw na abiso, masyadong maaga ang petsa mo`)}</>}</li>
        {!m.servesOk && <li>⚠️ {tx('Their biggest cake may not feed everyone', 'Baka kulang ang pinakamalaki nilang cake')}</li>}
        <li>{m.delivers ? <>🚗 {tx(`Delivers to you (within ${m.deliveryKm} km)`, `Nagde-deliver sa iyo (hanggang ${m.deliveryKm} km)`)}</> : m.deliveryKm === 0 ? <>🏠 {tx('Pickup only', 'Pickup lang')}</> : <>🏠 {tx(`Pickup (delivers only within ${m.deliveryKm} km)`, `Pickup (nagde-deliver lang hanggang ${m.deliveryKm} km)`)}</>}</li>
      </ul>
      {m.tags.length > 0 && (
        <p className="flex flex-wrap gap-1">
          {m.tags.map((t) => (
            <span key={t} className="tag bg-ube text-ink">
              {t}
            </span>
          ))}
        </p>
      )}
      <button type="button" className="btn w-full" onClick={(e) => { e.stopPropagation(); onOrder(); }}>
        {tx(`Request from ${m.name.replace(' (sample)', '')}`, `Mag-request kay ${m.name.replace(' (sample)', '')}`)} →
      </button>
    </article>
  );
}
