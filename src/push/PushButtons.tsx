import { useEffect, useState } from 'react';
import { useAccount } from '../cloud/account';
import { cloudEnabled } from '../cloud/config';
import { IconCheck } from '../components/icons';
import { useTx } from '../lib/prefs';
import { needsInstallFirst, phoneIsSubscribed, pushServerReady, pushSupported, subscribeThisPhone } from './client';

/** Shown only when this phone and the server can really do it. */
function usePushAvailable(extra = true): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!extra || !cloudEnabled() || (!pushSupported() && !needsInstallFirst())) return;
    let alive = true;
    pushServerReady().then((s) => alive && setOk(s.enabled));
    return () => {
      alive = false;
    };
  }, [extra]);
  return ok;
}

/** Baker inbox: "tell me on this phone when a request comes in". */
export function BakerAlerts() {
  const tx = useTx();
  const account = useAccount();
  const uid = account.status === 'signed-in' ? account.user.uid : null;
  const available = usePushAvailable(!!uid);
  const [state, setState] = useState<'idle' | 'busy' | 'on' | 'blocked' | 'error'>('idle');
  useEffect(() => {
    if (available) phoneIsSubscribed().then((on) => on && setState('on'));
  }, [available]);
  if (!uid || !available) return null;
  if (needsInstallFirst()) {
    return <p className="rounded-xl border border-line bg-[#faf6f1] p-3 text-sm">{tx('Want an alert for each new request? On iPhone, tap Share → Add to Home Screen, open Cakeita from there, then turn alerts on.', 'Gusto ng alert sa bawat bagong request? Sa iPhone, i-tap ang Share → Add to Home Screen, buksan doon ang Cakeita, saka i-on ang alerts.')}</p>;
  }
  if (state === 'on') return <p className="flex items-center gap-2 text-sm text-ok-ink"><IconCheck /> {tx('Alerts are on for this phone.', 'Naka-on ang alerts sa phone na ito.')}</p>;
  const turnOn = async () => {
    setState('busy');
    try {
      const sub = await subscribeThisPhone();
      if (!sub) return setState('blocked');
      const { savePushSub } = await import('../cloud/data');
      await savePushSub(uid, sub);
      setState('on');
    } catch {
      setState('error');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-[#faf6f1] p-3">
      <p className="min-w-0 flex-1 text-sm">{tx('Get a phone alert when a new request comes in.', 'Makatanggap ng alert sa phone kapag may bagong request.')}</p>
      <button type="button" className="btn-secondary" disabled={state === 'busy'} onClick={turnOn} data-push-baker>
        {state === 'busy' ? tx('Turning on…', 'Ino-on…') : tx('Turn on alerts', 'I-on ang alerts')}
      </button>
      {state === 'blocked' && <p className="w-full text-sm text-amber-ink">{tx('Alerts are blocked. Allow notifications for this site in your browser settings.', 'Naka-block ang alerts. Payagan ang notifications sa browser settings.')}</p>}
      {state === 'error' && <p className="w-full text-sm text-amber-ink">{tx('Could not turn alerts on. Try again with signal.', 'Hindi na-on. Subukan ulit kapag may signal.')}</p>}
    </div>
  );
}

/** Customer order form: "tell me when the quote is ready". Returns the subscription to send with the request. */
export function QuoteAlertToggle({ show, value, onChange }: { show: boolean; value: string | null; onChange: (sub: string | null) => void }) {
  const tx = useTx();
  const available = usePushAvailable(show);
  const [msg, setMsg] = useState('');
  if (!show || !available || needsInstallFirst()) return null;
  const toggle = async () => {
    setMsg('');
    if (value) return onChange(null);
    const sub = await subscribeThisPhone().catch(() => null);
    if (sub) onChange(JSON.stringify(sub));
    else setMsg(tx('Alerts are blocked on this phone. You can still check My cakes.', 'Naka-block ang alerts. Puwede pa ring tingnan ang Mga cake ko.'));
  };
  return (
    <div>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-6 w-6 accent-[#8c2246]" checked={!!value} onChange={toggle} data-push-customer />
        <span>
          <strong>{tx('Tell me on this phone when the quote is ready', 'Sabihan ako sa phone na ito kapag may quote na')}</strong>
          <br />
          <span className="text-sm text-ink-soft">{tx('One notification. No account needed.', 'Isang notification lang. Hindi kailangan ng account.')}</span>
        </span>
      </label>
      {msg && <p className="mt-1 text-sm text-amber-ink">{msg}</p>}
    </div>
  );
}
