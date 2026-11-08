import { useEffect, useState } from 'react';
import { QR, ShareBox } from '../../components/ShareBox';
import { Field, Notice } from '../../components/ui';
import { useDb } from '../../data/store';
import { copyText, menuLink } from '../../lib/links';
import { useTx } from '../../lib/prefs';
import { BakerShell } from './BakerShell';

export default function ShareMenu() {
  const db = useDb();
  const tx = useTx();
  const [link, setLink] = useState('');
  useEffect(() => {
    if (db.bakery) menuLink(db.bakery).then(setLink);
  }, [db.bakery]);
  if (!db.bakery) return null;
  return (
    <BakerShell>
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">{tx('Your customer link', 'Ang link mo para sa customer')}</h1>
        <p>{tx('Put this in your page bio, pinned post or auto-reply. Customers build their cake, see 3 designs in their budget, and send you a ready request.', 'Ilagay sa page bio, pinned post o auto-reply. Gagawa ng cake ang customer, makikita ang 3 design sa budget nila, at magpapadala ng kumpletong request.')}</p>
        {link && (
          <>
            <div className="card text-center">
              <QR value={link} label={tx('QR code of your bakery link', 'QR code ng bakery link mo')} size={240} />
              <p className="mt-2 font-bold">{db.bakery.name}</p>
              <p className="text-sm text-ink-soft">{tx('Scan to order a cake', 'I-scan para mag-order ng cake')}</p>
              <button type="button" className="btn-ghost no-print mt-2" onClick={() => window.print()}>
                🖨 {tx('Print QR poster', 'I-print ang QR poster')}
              </button>
            </div>
            <ShareBox url={link} title={db.bakery.name} showQr={false} qrLabel="QR" message={tx(`Order a custom cake from ${db.bakery.name}. Pick your budget and see your cake in 3D:`, `Mag-order ng custom cake sa ${db.bakery.name}. Piliin ang budget mo at makita ang cake mo sa 3D:`)} />
            <a className="btn-secondary w-full" href={link} target="_blank" rel="noreferrer">
              {tx('Open it like a customer', 'Buksan na parang customer')}
            </a>
          </>
        )}
        {link && <GetOnMap link={link} name={db.bakery.name} city={db.bakery.city} />}
        <Notice tone="info" title={tx('When you change prices', 'Kapag binago mo ang presyo')}>
          {tx('Your menu travels inside the link, so share the new link after big price changes. You always check and approve the final price anyway.', 'Nasa loob ng link ang menu mo, kaya i-share ang bagong link kapag malaki ang binago sa presyo. Ikaw pa rin ang nag-a-approve ng final na presyo.')}
        </Notice>
      </div>
    </BakerShell>
  );
}

/** Ask to be listed on the customers' "bakers near me" map. No database: the baker sends a listing to the Cakeita team. */
function GetOnMap({ link, name, city }: { link: string; name: string; city: string }) {
  const tx = useTx();
  const [area, setArea] = useState(city);
  const [km, setKm] = useState(5);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState('');
  const locate = () => {
    setStatus('');
    navigator.geolocation?.getCurrentPosition(
      (p) => setPin({ lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 }),
      () => setStatus(tx('Location is off. Typing your area is enough.', 'Naka-off ang location. Sapat na ang area mo.')),
      { timeout: 10_000 },
    );
  };
  const copy = async () => {
    const text = [
      'Cakeita map listing request',
      `Bakery: ${name}`,
      `Area: ${area.trim() || '(not given)'}`,
      pin ? `Pin (about 100 m): ${pin.lat}, ${pin.lng}` : '',
      `Delivery: ${km > 0 ? `within ${km} km` : 'pickup only'}`,
      `Menu link: ${link}`,
    ].filter(Boolean).join('\n');
    setStatus((await copyText(text)) ? tx('Copied. Send it to the Cakeita team and we will add you after a quick check.', 'Na-copy. Ipadala sa Cakeita team at idadagdag ka namin pagkatapos ng mabilis na check.') : tx('Copy failed. Long-press to copy.', 'Hindi na-copy. I-long press para i-copy.'));
  };
  return (
    <section className="card space-y-3" aria-labelledby="map-h">
      <h2 id="map-h" className="font-display text-xl font-bold">
        <span aria-hidden="true">📍</span> {tx('Get on the map', 'Mapasama sa mapa')}
      </h2>
      <p>{tx('Customers nearby compare bakers on a map, and see your price for their cake, worked out from your own costs.', 'Ikinukumpara ng mga customer sa malapit ang mga baker sa mapa, at makikita nila ang presyo mo para sa cake nila, mula sa sarili mong gastos.')}</p>
      <Field id="map-area" label={tx('Area customers see', 'Area na makikita ng customer')} hint={tx('Baking from home? Use your barangay or a landmark, not your house address.', 'Sa bahay nagbe-bake? Barangay o landmark ang ilagay, hindi ang address ng bahay.')}>
        <input id="map-area" className="input" maxLength={80} value={area} onChange={(e) => setArea(e.target.value)} aria-describedby="map-area-hint" />
      </Field>
      <Field id="map-km" label={tx('Delivery distance (km, 0 = pickup only)', 'Layo ng delivery (km, 0 = pickup lang)')}>
        <input id="map-km" type="number" inputMode="numeric" min={0} max={50} className="input" value={km} onChange={(e) => setKm(Math.max(0, Math.min(50, Number(e.target.value) || 0)))} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={locate}>
          {pin ? tx('Pin set ✓ (update)', 'Naka-pin ✓ (i-update)') : tx('Add my pin (optional)', 'Idagdag ang pin ko (optional)')}
        </button>
        <button type="button" className="btn-secondary" onClick={copy}>
          {tx('Copy my map listing', 'I-copy ang listing ko')}
        </button>
      </div>
      {status && <p className="text-sm font-semibold" aria-live="polite">{status}</p>}
    </section>
  );
}
