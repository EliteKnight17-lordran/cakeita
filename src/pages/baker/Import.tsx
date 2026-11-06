import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Notice } from '../../components/ui';
import { applyConfirmation, requestToOrder } from '../../domain/orders';
import { cakeRequestSchema, confirmLinkSchema } from '../../domain/schemas';
import { repo, useDb } from '../../data/store';
import { decodePayload, linkErrorText } from '../../lib/codec';
import { useTx } from '../../lib/prefs';
import { BakerShell } from './BakerShell';

/** Opens a request or confirmation link a customer sent the baker. */
export default function Import() {
  const loc = useLocation();
  const nav = useNavigate();
  const db = useDb();
  const tx = useTx();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn' | 'danger'; text: string } | null>(null);
  const params = new URLSearchParams(loc.search);
  const r = params.get('r');
  const c = params.get('c');

  useEffect(() => {
    if (!db.bakery) return;
    let alive = true;
    (async () => {
      if (r) {
        const res = await decodePayload(r, cakeRequestSchema);
        if (!alive) return;
        if (!res.ok) return setMsg({ tone: 'danger', text: linkErrorText(res.error, tx) });
        if (res.value.bakerySlug !== db.bakery!.slug) return setMsg({ tone: 'warn', text: tx(`This request is for another bakery (${res.value.bakerySlug}).`, `Para sa ibang bakery ang request (${res.value.bakerySlug}).`) });
        const existing = repo.get().orders.find((o) => o.id === res.value.id);
        if (!existing) repo.upsertOrder(requestToOrder(res.value, 'link'));
        nav(`/baker/order/${res.value.id}`, { replace: true });
      } else if (c) {
        const res = await decodePayload(c, confirmLinkSchema);
        if (!alive) return;
        if (!res.ok) return setMsg({ tone: 'danger', text: linkErrorText(res.error, tx) });
        const order = repo.get().orders.find((o) => o.id === res.value.orderId);
        const out = applyConfirmation(order, res.value);
        if (out.ok) {
          repo.upsertOrder(out.order);
          nav(`/baker/order/${out.order.id}`, { replace: true });
        } else {
          const text = {
            unknown: tx('We could not find this order on this phone. Open it on the phone where you made the quote.', 'Wala ang order sa phone na ito. Buksan sa phone kung saan ka nag-quote.'),
            'not-quoted': tx('This order has no approved quote yet.', 'Wala pang approved na quote ang order.'),
            'price-changed': tx('The price changed after the customer saw it. Send the new quote again.', 'Nagbago ang presyo matapos makita ng customer. Ipadala ulit ang bagong quote.'),
            already: tx('Already confirmed.', 'Confirmed na ito.'),
          }[out.reason];
          setMsg({ tone: out.reason === 'already' ? 'ok' : 'warn', text });
        }
      } else {
        setMsg({ tone: 'warn', text: tx('Nothing to open in this link.', 'Walang mabuksan sa link na ito.') });
      }
    })();
    return () => {
      alive = false;
    };
  }, [r, c, db.bakery, nav, tx]);

  return (
    <BakerShell>
      <div className="space-y-4 py-4">
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : <p aria-live="polite">{tx('Opening…', 'Binubuksan…')}</p>}
        <Link to="/baker" className="btn-secondary">
          {tx('Go to requests', 'Pumunta sa requests')}
        </Link>
      </div>
    </BakerShell>
  );
}
