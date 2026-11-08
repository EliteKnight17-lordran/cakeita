import { useEffect, useSyncExternalStore } from 'react';
import { applyConfirmation, quoteLinkPayload, requestToOrder } from '../domain/orders';
import type { Bakery } from '../domain/types';
import { repo, useDb, type MyRequest } from '../data/store';
import { quoteLink } from '../lib/links';
import { startAccountIfKnown, useAccount } from './account';
import { cloudEnabled } from './config';
import {
  listenConfirmations,
  listenQuote,
  listenRequests,
  loadBakery,
  loadMyRequests,
  publishQuote,
  saveBakery,
  saveMyRequests,
  slugOwner,
} from './data';

/** What the Account page shows about syncing. */
export interface SyncStatus {
  savedAt: string | null;
  error: string;
  /** The bakery on this phone belongs to another account. */
  otherOwner: boolean;
}
let status: SyncStatus = { savedAt: null, error: '', otherOwner: false };
const subs = new Set<() => void>();
function setStatus(p: Partial<SyncStatus>) {
  status = { ...status, ...p };
  subs.forEach((s) => s());
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => status,
    () => status,
  );
}

const PUSHED = 'cakeita.cloud.pushedQuotes';
function pushedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PUSHED) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function markPushed(key: string) {
  const s = pushedSet();
  s.add(key);
  try {
    localStorage.setItem(PUSHED, JSON.stringify([...s].slice(-300)));
  } catch {
    /* ignore */
  }
}

function errText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'The cloud said no (permission). Check that the database rules are published.';
  if (code.includes('unavailable')) return 'Offline. Changes will sync when you are back online.';
  return 'Could not reach the cloud. Your data is safe on this phone.';
}

/** Claim the bakery for this account the first time, picking a free link name if needed. */
async function claim(b: Bakery, uid: string): Promise<Bakery> {
  let slug = b.slug;
  const owner = await slugOwner(slug).catch(() => null);
  if (owner && owner !== uid) slug = `${b.slug}-${uid.slice(0, 5).toLowerCase()}`.replace(/[^a-z0-9-]/g, '');
  return { ...b, slug, cloudUid: uid };
}

/**
 * Keeps this phone and the account in step while someone is signed in:
 * bakery up, requests and confirmations down, quotes up, and a customer's "My cakes" both ways.
 * Also, for anyone (no account needed), watches for quotes on requests sent to cloud bakeries.
 */
export function CloudSync() {
  const account = useAccount();
  const db = useDb();
  const uid = account.status === 'signed-in' ? account.user.uid : null;

  useEffect(() => {
    startAccountIfKnown();
  }, []);

  // First sign-in on this phone: bring the cloud bakery down, or claim the local one.
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      try {
        const local = repo.get().bakery;
        if (!local || local.isSample) {
          const cloud = await loadBakery(uid);
          if (alive && cloud) repo.setBakery(cloud);
        } else if (!local.cloudUid) {
          const claimed = await claim(local, uid);
          if (alive) repo.setBakery(claimed);
        }
        const mine = await loadMyRequests(uid);
        if (alive && mine.length) {
          const have = new Set(repo.get().myRequests.map((r) => r.id));
          for (const r of mine.reverse()) if (!have.has(r.id)) repo.addMyRequest(r);
        }
      } catch (e) {
        if (alive) setStatus({ error: errText(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  const bakery = db.bakery;
  const mineBakery = !!uid && !!bakery && !bakery.isSample && bakery.cloudUid === uid;

  useEffect(() => {
    setStatus({ otherOwner: !!uid && !!bakery?.cloudUid && bakery.cloudUid !== uid });
  }, [uid, bakery?.cloudUid]);

  // Bakery up (debounced, so typing prices doesn't spam the network).
  useEffect(() => {
    if (!mineBakery || !uid || !bakery) return;
    const t = window.setTimeout(() => {
      saveBakery(uid, bakery).then(
        () => setStatus({ savedAt: new Date().toISOString(), error: '' }),
        (e) => setStatus({ error: errText(e) }),
      );
    }, 1200);
    return () => window.clearTimeout(t);
  }, [mineBakery, uid, bakery]);

  // Requests and confirmations down, live.
  useEffect(() => {
    if (!mineBakery || !uid) return;
    const offs: Array<() => void> = [];
    let alive = true;
    listenRequests(uid, (req) => {
      if (repo.get().orders.some((o) => o.id === req.id)) return;
      repo.upsertOrder(requestToOrder(req, 'cloud'));
    }).then((off) => (alive ? offs.push(off) : off()), () => {});
    listenConfirmations(uid, (c) => {
      const order = repo.get().orders.find((o) => o.id === c.orderId);
      if (!order || order.status !== 'quoted') return;
      const res = applyConfirmation(order, c);
      if (res.ok) repo.upsertOrder(res.order);
    }).then((off) => (alive ? offs.push(off) : off()), () => {});
    return () => {
      alive = false;
      offs.forEach((f) => f());
    };
  }, [mineBakery, uid]);

  // Quotes up: every approved quote also goes to the cloud, so the customer sees it live.
  useEffect(() => {
    if (!mineBakery || !uid || !bakery) return;
    const done = pushedSet();
    for (const o of db.orders) {
      if (!o.quote || !['quoted', 'confirmed', 'baking', 'ready', 'done'].includes(o.status)) continue;
      const key = `${o.id}@${o.quote.approvedAt}`;
      if (done.has(key)) continue;
      const q = quoteLinkPayload(bakery, o);
      if (!q) continue;
      publishQuote(uid, q).then(() => markPushed(key), (e) => setStatus({ error: errText(e) }));
    }
  }, [mineBakery, uid, bakery, db.orders]);

  // A customer's "My cakes" follows their account.
  const myRequests = db.myRequests;
  useEffect(() => {
    if (!uid || !myRequests.length) return;
    const t = window.setTimeout(() => saveMyRequests(uid, myRequests).catch(() => {}), 1500);
    return () => window.clearTimeout(t);
  }, [uid, myRequests]);

  // Anyone: live quotes for requests sent to cloud bakeries.
  const waiting = myRequests.filter((r: MyRequest) => r.cloud && r.status === 'sent').slice(0, 10);
  const waitingKey = waiting.map((r) => r.id).join(',');
  useEffect(() => {
    if (!waitingKey || !cloudEnabled()) return;
    const offs: Array<() => void> = [];
    let alive = true;
    for (const id of waitingKey.split(',')) {
      listenQuote(id, async (q) => {
        const link = await quoteLink(q);
        repo.updateMyRequest(id, { status: 'quoted', quoteLink: link });
      }).then((off) => (alive ? offs.push(off) : off()), () => {});
    }
    return () => {
      alive = false;
      offs.forEach((f) => f());
    };
  }, [waitingKey]);

  return null;
}
