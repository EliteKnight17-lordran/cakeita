import type { ListedBakery } from '../domain/matching';
import { toPublicMenu } from '../domain/pricing';
import { cakeRequestSchema, confirmLinkSchema, publicMenuSchema, quoteLinkSchema, type ConfirmLink, type QuoteLink } from '../domain/schemas';
import type { Bakery, CakeRequest, PublicMenu } from '../domain/types';
import type { MyRequest } from '../data/store';
import { loadCloud } from './fb';

/**
 * Firestore layout (rules in firestore.rules):
 *   bakeries/{uid}      private: the baker's full bakery (costs, margins). Owner only.
 *   menus/{slug}        public: customer-safe menu + map pin. Anyone reads, owner writes.
 *   requests/{id}       customer -> baker. Anyone creates for a listed owner; only that baker reads.
 *   quotes/{orderId}    baker -> customer. Anyone with the (unguessable) order id reads.
 *   confirmations/{id}  customer -> baker. Anyone creates for an existing quote; only the baker reads.
 *   users/{uid}         a customer's own list of requests, so "My cakes" follows them to a new phone.
 * Payloads are stored as JSON text and checked with the same zod schemas as share links,
 * so cloud data is never trusted more than a link.
 */

const now = () => new Date().toISOString();

export async function saveBakery(uid: string, bakery: Bakery): Promise<void> {
  const c = await loadCloud();
  const { doc, setDoc } = c.m.fs;
  const b: Bakery = { ...bakery, cloudUid: uid };
  await setDoc(doc(c.db, 'bakeries', uid), { data: JSON.stringify(b), slug: b.slug, updatedAt: now() });
  const menu = toPublicMenu(b);
  const loc = b.location;
  await setDoc(doc(c.db, 'menus', b.slug), {
    ownerUid: uid,
    slug: b.slug,
    name: b.name,
    listed: !!loc?.listed && !b.isSample,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    area: loc?.area ?? b.city,
    deliveryKm: loc?.deliveryKm ?? 0,
    menu: JSON.stringify(menu),
    updatedAt: now(),
  });
}

export async function loadBakery(uid: string): Promise<Bakery | null> {
  const c = await loadCloud();
  const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'bakeries', uid));
  if (!snap.exists()) return null;
  try {
    const b = JSON.parse(String(snap.data().data)) as Bakery;
    return b && Array.isArray(b.components) ? b : null;
  } catch {
    return null;
  }
}

/** Is this link name free (or already mine)? */
export async function slugOwner(slug: string): Promise<string | null> {
  const c = await loadCloud();
  const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'menus', slug));
  return snap.exists() ? String(snap.data().ownerUid ?? '') : null;
}

function parseMenu(raw: unknown): PublicMenu | null {
  try {
    const r = publicMenuSchema.safeParse(JSON.parse(String(raw)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function fetchMenu(slug: string): Promise<PublicMenu | null> {
  const c = await loadCloud();
  const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'menus', slug));
  if (!snap.exists()) return null;
  const d = snap.data();
  const menu = parseMenu(d.menu);
  return menu && menu.slug === slug ? { ...menu, owner: String(d.ownerUid) } : null;
}

/** Real bakers who chose to be on the map. */
export async function fetchListings(): Promise<ListedBakery[]> {
  const c = await loadCloud();
  const { collection, getDocs, query, where, limit } = c.m.fs;
  const snap = await getDocs(query(collection(c.db, 'menus'), where('listed', '==', true), limit(200)));
  const out: ListedBakery[] = [];
  snap.forEach((d) => {
    const x = d.data();
    const menu = parseMenu(x.menu);
    if (!menu || typeof x.lat !== 'number' || typeof x.lng !== 'number') return;
    out.push({ menu: { ...menu, owner: String(x.ownerUid) }, lat: x.lat, lng: x.lng, area: String(x.area ?? menu.city).slice(0, 80), deliveryKm: Number(x.deliveryKm) || 0, tags: [] });
  });
  return out;
}

export async function sendRequest(req: CakeRequest, ownerUid: string): Promise<void> {
  const c = await loadCloud();
  await c.m.fs.setDoc(c.m.fs.doc(c.db, 'requests', req.id), { bakerUid: ownerUid, slug: req.bakerySlug, req: JSON.stringify(req), createdAt: now() });
}

/** The baker's cloud inbox, live. */
export async function listenRequests(uid: string, onReq: (r: CakeRequest) => void): Promise<() => void> {
  const c = await loadCloud();
  const { collection, onSnapshot, query, where } = c.m.fs;
  return onSnapshot(
    query(collection(c.db, 'requests'), where('bakerUid', '==', uid)),
    (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        try {
          const r = cakeRequestSchema.safeParse(JSON.parse(String(ch.doc.data().req)));
          if (r.success && r.data.id === ch.doc.id) onReq(r.data as CakeRequest);
        } catch {
          /* ignore bad data */
        }
      });
    },
    () => {},
  );
}

export async function publishQuote(uid: string, q: QuoteLink): Promise<void> {
  const c = await loadCloud();
  await c.m.fs.setDoc(c.m.fs.doc(c.db, 'quotes', q.orderId), { bakerUid: uid, quote: JSON.stringify(q), updatedAt: now() });
}

/** Watch for the baker's quote on a request (customer side). */
export async function listenQuote(orderId: string, onQuote: (q: QuoteLink) => void): Promise<() => void> {
  const c = await loadCloud();
  const { doc, onSnapshot } = c.m.fs;
  return onSnapshot(
    doc(c.db, 'quotes', orderId),
    (snap) => {
      if (!snap.exists()) return;
      try {
        const r = quoteLinkSchema.safeParse(JSON.parse(String(snap.data().quote)));
        if (r.success && r.data.orderId === orderId) onQuote(r.data);
      } catch {
        /* ignore */
      }
    },
    () => {},
  );
}

export async function sendConfirmation(conf: ConfirmLink, bakerUid: string): Promise<void> {
  const c = await loadCloud();
  await c.m.fs.setDoc(c.m.fs.doc(c.db, 'confirmations', conf.orderId), { bakerUid, conf: JSON.stringify(conf), createdAt: now() });
}

export async function quoteOwner(orderId: string): Promise<string | null> {
  const c = await loadCloud();
  const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'quotes', orderId));
  return snap.exists() ? String(snap.data().bakerUid) : null;
}

export async function listenConfirmations(uid: string, onConf: (c: ConfirmLink) => void): Promise<() => void> {
  const c = await loadCloud();
  const { collection, onSnapshot, query, where } = c.m.fs;
  return onSnapshot(
    query(collection(c.db, 'confirmations'), where('bakerUid', '==', uid)),
    (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        try {
          const r = confirmLinkSchema.safeParse(JSON.parse(String(ch.doc.data().conf)));
          if (r.success && r.data.orderId === ch.doc.id) onConf(r.data);
        } catch {
          /* ignore */
        }
      });
    },
    () => {},
  );
}

export async function saveMyRequests(uid: string, list: MyRequest[]): Promise<void> {
  const c = await loadCloud();
  await c.m.fs.setDoc(c.m.fs.doc(c.db, 'users', uid), { myRequests: JSON.stringify(list.slice(0, 50)), updatedAt: now() });
}

export async function loadMyRequests(uid: string): Promise<MyRequest[]> {
  const c = await loadCloud();
  const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'users', uid));
  if (!snap.exists()) return [];
  try {
    const list = JSON.parse(String(snap.data().myRequests)) as MyRequest[];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string' && typeof r.requestLink === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}

/**
 * Deletes everything this account put in the cloud: private bakery, public menu and map pin,
 * inbox requests and confirmations, published quotes, and the customer's "My cakes" list.
 * Data on this phone is left alone (the person can clear it from About).
 */
export async function deleteCloudData(uid: string, slug: string | null, quoteIds: string[]): Promise<void> {
  const c = await loadCloud();
  const { doc, deleteDoc, getDoc, getDocs, collection, query, where } = c.m.fs;
  const jobs: Promise<unknown>[] = [];
  for (const col of ['requests', 'confirmations'] as const) {
    const snap = await getDocs(query(collection(c.db, col), where('bakerUid', '==', uid)));
    snap.forEach((d) => jobs.push(deleteDoc(d.ref)));
  }
  for (const id of quoteIds) {
    jobs.push(
      getDoc(doc(c.db, 'quotes', id))
        .then((s) => (s.exists() && s.data().bakerUid === uid ? deleteDoc(s.ref) : undefined))
        .catch(() => undefined),
    );
  }
  if (slug) {
    const m = await getDoc(doc(c.db, 'menus', slug));
    if (m.exists() && m.data().ownerUid === uid) jobs.push(deleteDoc(m.ref));
  }
  jobs.push(deleteDoc(doc(c.db, 'bakeries', uid)), deleteDoc(doc(c.db, 'users', uid)));
  await Promise.all(jobs);
}
