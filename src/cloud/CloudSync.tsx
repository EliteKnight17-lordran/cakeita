import { sendNotify } from '../push/client';
import { useEffect, useSyncExternalStore } from 'react';
import { applyConfirmation, applyOffer, quoteLinkPayload, requestToOrder } from '../domain/orders';
import type { Bakery } from '../domain/types';
import { repo, useDb, type MyRequest } from '../data/store';
import { quoteLink } from '../lib/links';
import { startAccountIfKnown, useAccount } from './account';
import { cloudEnabled } from './config';
import {
  listenConfirmations,
  listenOffers,
  listenQuote,
  listenRequests,
  loadBakery,
  loadMyRequests,
  publishQuote,
  publishReadyPhoto,
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

/** Customers' phones to notify when their quote is published, by order id (this phone only). */
const NOTIFY = 'cakeita.cloud.notifySubs';
function notifyMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
function setNotify(id: string, sub: string | null) {
  const m = notifyMap();
  if (sub) m[id] = sub;
  else delete m[id];
  try {
    localStorage.setItem(NOTIFY, JSON.stringify(Object.fromEntries(Object.entries(m).slice(-200))));
  } catch {
    /* ignore */
  }
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
    listenRequests(uid, (req, notify) => {
      if (repo.get().orders.some((o) => o.id === req.id)) return;
      if (notify) setNotify(req.id, notify);
      repo.upsertOrder(requestToOrder(req, 'cloud'));
    }).then((off) => (alive ? offs.push(off) : off()), () => {});
    listenConfirmations(uid, (c) => {
      const order = repo.get().orders.find((o) => o.id === c.orderId);
      if (!order || order.status !== 'quoted') return;
      const res = applyConfirmation(order, c);
      if (res.ok) repo.upsertOrder(res.order);
    }).then((off) => (alive ? offs.push(off) : off()), () => {});
    listenOffers(uid, (x) => {
      const res = applyOffer(repo.get().orders.find((o) => o.id === x.orderId), x);
      if (res.ok) repo.upsertOrder(res.order);
    }).then((off) => (alive ? offs.push(off) : off()), () => {});
    return () => {
      alive = false;
      offs.forEach((f) => f());
    };
  }, [mineBakery, uid]);

  // Quotes up: every approved quote (and every "sorry, we can't") also goes to the cloud,
  // so the customer sees it live. A new answer to their counter-offer goes up again.
  useEffect(() => {
    if (!mineBakery || !uid || !bakery) return;
    const done = pushedSet();
    for (const o of db.orders) {
      const declined = o.status === 'declined' && o.source === 'cloud';
      if (!declined && (!o.quote || !['quoted', 'confirmed', 'baking', 'ready', 'done'].includes(o.status))) continue;
      const key = declined ? `${o.id}@declined` : `${o.id}@${o.quote!.approvedAt}${o.offer ? `@offer-${o.offer.answer}` : ''}${o.ready ? `@ready-${o.ready.at}` : ''}`;
      if (done.has(key)) continue;
      const q = quoteLinkPayload(bakery, o);
      if (!q) continue;
      const photo = o.ready?.photo;
      // The photo goes up before the notice, so the customer's phone finds it when the notice arrives.
      // (Rules from before 1.25 refuse the photo; the notice still goes.)
      (photo ? publishReadyPhoto(uid, o.id, photo).catch(() => undefined).then(() => publishQuote(uid, q)) : publishQuote(uid, q)).then(
        () => {
          markPushed(key);
          // Tell the customer's phone, if they asked to be told.
          const sub = notifyMap()[o.id];
          if (sub) {
            try {
              sendNotify({ kind: 'quote', orderId: o.id, sub: JSON.parse(sub) });
            } catch {
              /* bad saved value */
            }
            setNotify(o.id, null);
          }
        },
        (e) => setStatus({ error: errText(e) }),
      );
    }
  }, [mineBakery, uid, bakery, db.orders]);

  // A customer's "My cakes" follows their account.
  const myRequests = db.myRequests;
  useEffect(() => {
    if (!uid || !myRequests.length) return;
    const t = window.setTimeout(() => saveMyRequests(uid, myRequests).catch(() => {}), 1500);
    return () => window.clearTimeout(t);
  }, [uid, myRequests]);

  // Anyone: live answers for requests sent to cloud bakeries (the quote, a "no", or the answer to an offer).
  const waiting = myRequests.filter((r: MyRequest) => r.cloud && (r.status === 'sent' || r.status === 'quoted')).slice(0, 10);
  const waitingKey = waiting.map((r) => r.id).join(',');
  useEffect(() => {
    if (!waitingKey || !cloudEnabled()) return;
    const offs: Array<() => void> = [];
    let alive = true;
    for (const id of waitingKey.split(',')) {
      listenQuote(id, async (q) => {
        const link = await quoteLink(q);
        const now = repo.get().myRequests.find((r) => r.id === id);
        if (!now || now.status === 'confirmed' || now.quoteLink === link) return;
        repo.updateMyRequest(id, { status: q.kind === 'declined' ? 'declined' : 'quoted', quoteLink: link });
      }).then((off) => (alive ? offs.push(off) : off()), () => {});
    }
    return () => {
      alive = false;
      offs.forEach((f) => f());
    };
  }, [waitingKey]);

  return null;
}
