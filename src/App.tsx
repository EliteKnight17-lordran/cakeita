import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CloudSync } from './cloud/CloudSync';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { Layout } from './components/Layout';
import { setPrefs } from './lib/prefs';
import Home from './pages/Home';

const CustomerFlow = lazy(() => import('./pages/CustomerFlow'));
const QuotePage = lazy(() => import('./pages/QuotePage'));
const About = lazy(() => import('./pages/About'));
const NearBakers = lazy(() => import('./pages/NearBakers'));
const Inbox = lazy(() => import('./pages/baker/Inbox'));
const Board = lazy(() => import('./pages/baker/Board'));
const MenuEditor = lazy(() => import('./pages/baker/MenuEditor'));
const Insights = lazy(() => import('./pages/baker/Insights'));
const ShareMenu = lazy(() => import('./pages/baker/ShareMenu'));
const OrderDetail = lazy(() => import('./pages/baker/OrderDetail'));
const Import = lazy(() => import('./pages/baker/Import'));
const Account = lazy(() => import('./pages/Account'));
const Demo = lazy(() => import('./pages/Demo'));
const MyCakes = lazy(() => import('./pages/MyCakes'));

function DevFlag() {
  const loc = useLocation();
  useEffect(() => {
    const q = new URLSearchParams(loc.search);
    if (q.get('dev') === '1') setPrefs({ dev: true });
    if (q.get('dev') === '0') setPrefs({ dev: false });
  }, [loc.search]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return null;
}

function Guarded({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return <AppErrorBoundary resetKey={loc.pathname}>{children}</AppErrorBoundary>;
}

function NotFound() {
  return (
    <Layout>
      <p className="py-16 text-center text-lg">Page not found. / Walang ganitong page.</p>
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <DevFlag />
      <CloudSync />
      <Guarded>
      <Suspense fallback={<div className="p-10 text-center text-ink-soft">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/account" element={<Account />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/me" element={<MyCakes />} />
          <Route path="/b/:slug" element={<CustomerFlow />} />
          <Route path="/near" element={<NearBakers />} />
          <Route path="/o/:id" element={<QuotePage />} />
          <Route path="/baker" element={<Inbox />} />
          <Route path="/baker/board" element={<Board />} />
          <Route path="/baker/menu" element={<MenuEditor />} />
          <Route path="/baker/insights" element={<Insights />} />
          <Route path="/baker/share" element={<ShareMenu />} />
          <Route path="/baker/order/:id" element={<OrderDetail />} />
          <Route path="/baker/import" element={<Import />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </Guarded>
    </HashRouter>
  );
}
