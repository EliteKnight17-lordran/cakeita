import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { IconArrow, IconPin } from '../components/icons';
import { useAccount } from '../cloud/account';
import { useDb } from '../data/store';
import { useTx } from '../lib/prefs';

/** A customer's requests on this phone (and their account), with live status. */
export default function MyCakes() {
  const tx = useTx();
  const db = useDb();
  const account = useAccount();
  const label = (s: string) =>
    s === 'quoted' ? tx('Quote ready', 'May quote na') : s === 'confirmed' ? tx('Confirmed', 'Confirmed') : tx('Waiting for the baker', 'Hinihintay ang baker');
  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <p className="eyebrow">{tx('My cakes', 'Mga cake ko')}</p>
          <h1 className="mt-1 text-3xl">{tx('Your cake requests', 'Mga cake request mo')}</h1>
        </div>
        {db.myRequests.length === 0 ? (
          <div className="card space-y-3 text-center">
            <p>{tx('No requests yet. Find a baker and design your cake.', 'Wala pang request. Maghanap ng baker at i-design ang cake mo.')}</p>
            <Link to="/near" className="btn mx-auto"><IconPin /> {tx('Find bakers near me', 'Maghanap ng baker')}</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {db.myRequests.map((r) => (
              <li key={r.id}>
                <Link to={`/o/${r.id}`} className="card flex items-center justify-between gap-3 transition hover:border-[#cdbdb0]">
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-semibold">{r.bakeryName}</span>
                    <span className="block truncate text-sm text-ink-soft">{r.summary}</span>
                    <span className={`tag mt-1 ${r.status === 'sent' ? 'bg-amber-bg text-amber-ink' : 'bg-ok-bg text-ok-ink'}`}>{label(r.status)}</span>
                  </span>
                  <IconArrow className="shrink-0 text-ink-soft" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {account.status !== 'signed-in' && account.status !== 'off' && (
          <p className="text-sm text-ink-soft">
            {tx('These live on this phone. ', 'Nasa phone na ito ang mga ito. ')}
            <Link to="/account" className="font-semibold text-berry underline underline-offset-4">{tx('Sign in to keep them on any phone.', 'Mag-sign in para dala mo sa kahit anong phone.')}</Link>
          </p>
        )}
      </div>
    </Layout>
  );
}
