import { markDemoSeen } from '../lib/me';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { IconArrow, IconPlay, IconStore, IconWrench } from '../components/icons';
import { Notice } from '../components/ui';
import { cloudEnabled } from '../cloud/config';
import { createSampleBakery } from '../domain/starterMenus';
import { demoOrders } from '../data/seed';
import { repo, useDb } from '../data/store';
import { setPrefs, useTx } from '../lib/prefs';

/**
 * Everything that is pretend lives here, so the rest of the app behaves like the real product.
 * Sample bakeries and demo orders are fictional and labeled.
 */
export default function Demo() {
  const tx = useTx();
  const nav = useNavigate();
  const db = useDb();
  const [cloud, setCloud] = useState(cloudEnabled());
  const [changed, setChanged] = useState(false);
  useEffect(() => markDemoSeen(), []);
  const ownReal = !!db.bakery && !db.bakery.isSample;

  const openDemoBakery = () => {
    const b = createSampleBakery();
    repo.replaceAll({ ...repo.get(), bakery: b, orders: demoOrders(b) });
    nav('/baker');
  };
  const toggleCloud = () => {
    try {
      localStorage.setItem('cakeita.cloud', cloud ? 'off' : 'on');
    } catch {
      /* ignore */
    }
    setCloud(!cloud);
    setChanged(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <p className="eyebrow">{tx('Demo', 'Demo')}</p>
          <h1 className="mt-1 text-3xl">{tx('Try Cakeita with sample data', 'Subukan ang Cakeita gamit ang sample data')}</h1>
          <p className="mt-2 text-ink-soft">{tx('All shops and orders here are fictional and labeled "sample". Prices are estimates. Nothing is sent to a real baker.', 'Kathang-isip at may label na "sample" ang lahat ng shop at order dito. Tantya ang presyo. Walang naipapadala sa totoong baker.')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/b/sample" className="card group space-y-2 transition hover:border-[#cdbdb0]">
            <IconPlay className="text-berry" size={26} />
            <h2 className="text-xl">{tx('Order as a customer', 'Mag-order bilang customer')}</h2>
            <p className="text-sm text-ink-soft">{tx('Type a request like a Messenger chat, see 3 designs in 3D, send it.', 'Mag-type na parang Messenger, tingnan ang 3 design sa 3D, ipadala.')}</p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-berry">{tx('Start', 'Simulan')} <IconArrow size={16} /></span>
          </Link>
          <button type="button" onClick={openDemoBakery} disabled={ownReal} className="card space-y-2 text-left transition hover:border-[#cdbdb0] disabled:opacity-60">
            <IconStore className="text-berry" size={26} />
            <h2 className="text-xl">{tx('Run the sample bakery', 'Patakbuhin ang sample bakery')}</h2>
            <p className="text-sm text-ink-soft">{tx('A baker dashboard with demo requests, quotes, a shopping list and "lugi" alerts.', 'Baker dashboard na may demo requests, quotes, shopping list at "lugi" alerts.')}</p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-berry">{ownReal ? tx('Your own bakery is on this phone', 'May sarili kang bakery sa phone na ito') : tx('Open', 'Buksan')} <IconArrow size={16} /></span>
          </button>
        </div>
        {ownReal && <Notice tone="info">{tx('To keep your real bakery safe, the sample dashboard opens only on a phone without one. The customer demo works anywhere.', 'Para ligtas ang totoong bakery mo, bubukas lang ang sample dashboard sa phone na wala pang bakery.')}</Notice>}

        {/* Folded: visitors at a public demo don't need these, presenters know where they are. */}
        <details className="card" aria-labelledby="tools-h">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2">
            <h2 id="tools-h" className="flex items-center gap-2 text-lg"><IconWrench className="text-berry" /> {tx('Presenter tools', 'Para sa nagpe-present')}</h2>
          </summary>
          <div className="mt-3 space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-[0.95rem]">
            <li>{tx('Tap the Cakeita logo 5 times (or add ?dev=1) for the developer panel: jump to any step, fill sample customers, force 2D.', 'I-tap ang logo nang 5 beses (o ?dev=1) para sa developer panel.')}</li>
            <li>{tx('Offline mode keeps the demo fully on this device (no internet needed after the page loads).', 'Sa offline mode, nasa device lang ang demo (hindi kailangan ng internet).')}</li>
          </ul>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-[#8c2246]" checked={!cloud} onChange={toggleCloud} />
            <span>{tx('Offline demo mode (no accounts or cloud on this device)', 'Offline demo mode (walang account o cloud sa device na ito)')}</span>
          </label>
          {changed && <p className="text-sm text-ink-soft">{tx('Reload the page to apply.', 'I-reload ang page.')}</p>}
          <button type="button" className="btn-ghost" onClick={() => { setPrefs({ dev: true }); }}>{tx('Open developer panel', 'Buksan ang developer panel')}</button>
          <AlertKeys />
          </div>
        </details>
      </div>
    </Layout>
  );
}

/** Owner setup: make the two keys phone alerts need, to paste into Vercel. Made on this device only. */
function AlertKeys() {
  const tx = useTx();
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const make = async () => {
    const { makeVapidKeys } = await import('../push/vapid');
    setKeys(await makeVapidKeys());
  };
  return (
    <details className="rounded-xl border border-line p-3">
      <summary className="cursor-pointer font-semibold">{tx('Owner setup: phone alert keys', 'Para sa may-ari: keys ng phone alerts')}</summary>
      <div className="mt-2 space-y-2 text-sm">
        <p>{tx('Makes a key pair on this device. Paste both into Vercel → Settings → Environment Variables, then redeploy. Keep the private key secret; do it once.', 'Gagawa ng key pair sa device na ito. I-paste pareho sa Vercel → Settings → Environment Variables, saka i-redeploy. Sikreto ang private key; isang beses lang.')}</p>
        {!keys ? (
          <button type="button" className="btn-secondary" onClick={make}>{tx('Make alert keys', 'Gumawa ng alert keys')}</button>
        ) : (
          <>
            <label className="block" htmlFor="vapid-pub"><span className="label">VAPID_PUBLIC_KEY</span></label>
            <input id="vapid-pub" readOnly className="input font-mono text-xs" value={keys.publicKey} onFocus={(e) => e.currentTarget.select()} />
            <label className="block" htmlFor="vapid-priv"><span className="label">VAPID_PRIVATE_KEY</span></label>
            <input id="vapid-priv" readOnly className="input font-mono text-xs" value={keys.privateKey} onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
      </div>
    </details>
  );
}
