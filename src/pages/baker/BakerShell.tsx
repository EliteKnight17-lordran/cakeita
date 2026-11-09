import type { ReactNode } from 'react';
import { Layout, TabNav } from '../../components/Layout';
import { useDb } from '../../data/store';
import { useTx } from '../../lib/prefs';
import Setup from './Setup';

export function BakerShell({ children }: { children: ReactNode }) {
  const db = useDb();
  const tx = useTx();
  if (!db.bakery) return <Setup />;
  const fresh = db.orders.filter((o) => o.status === 'new').length;
  return (
    <Layout
      nav={
        <TabNav
          tabs={[
            { to: '/baker', label: tx('Requests', 'Requests'), badge: fresh },
            // No badge here: quotes waiting on the customer are listed under Requests, not Orders.
            { to: '/baker/board', label: tx('Orders', 'Orders') },
            { to: '/baker/menu', label: tx('Menu & prices', 'Menu at presyo') },
            { to: '/baker/insights', label: 'Insights' },
            { to: '/baker/share', label: tx('My link', 'Link ko') },
          ]}
        />
      }
    >
      {db.bakery.isSample && (
        <p className="mb-3 rounded-2xl bg-amber-bg px-3 py-2 text-sm font-semibold text-amber-ink">
          {tx('You are using the sample bakery with demo data. Prices are estimates.', 'Sample bakery ito na may demo data. Tantya lang ang mga presyo.')}
        </p>
      )}
      {children}
    </Layout>
  );
}
