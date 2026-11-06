import { useEffect, useState } from 'react';
import { QR, ShareBox } from '../../components/ShareBox';
import { Notice } from '../../components/ui';
import { useDb } from '../../data/store';
import { menuLink } from '../../lib/links';
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
        <Notice tone="info" title={tx('When you change prices', 'Kapag binago mo ang presyo')}>
          {tx('Your menu travels inside the link, so share the new link after big price changes. You always check and approve the final price anyway.', 'Nasa loob ng link ang menu mo, kaya i-share ang bagong link kapag malaki ang binago sa presyo. Ikaw pa rin ang nag-a-approve ng final na presyo.')}
        </Notice>
      </div>
    </BakerShell>
  );
}
