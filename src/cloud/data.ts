import type { ListedBakery } from '../domain/matching';
import { toPublicMenu } from '../domain/pricing';
import { cakeRequestSchema, confirmLinkSchema, offerLinkSchema, publicMenuSchema, quoteLinkSchema, type ConfirmLink, type OfferLink, type QuoteLink } from '../domain/schemas';
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
 *   offers/{id}         customer -> baker: one counter-offer per quote. Same rules as confirmations.
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

/** Returns whether the photo went too (it is skipped if the database rules are older than this app). */
export async function sendRequest(req: CakeRequest, ownerUid: string, photo?: string | null, notify?: string | null): Promise<boolean> {
  const c = await loadCloud();
  const ref = c.m.fs.doc(c.db, 'requests', req.id);
  const base = { bakerUid: ownerUid, slug: req.bakerySlug, req: JSON.stringify(req), createdAt: now() };
  const data = notify && notify.length <= 2000 ? { ...base, notify } : base;
  if (photo && photo.length <= 400000) {
    try {
      await c.m.fs.setDoc(ref, { ...data, photo });
      return true;
    } catch (e) {
      if (!String((e as { code?: string })?.code ?? '').includes('permission')) throw e;
    }
  }
  try {
    await c.m.fs.setDoc(ref, data);
  } catch (e) {
    // Database rules older than this app: send the plain request.
    if (data === base || !String((e as { code?: string })?.code ?? '').includes('permission')) throw e;
    await c.m.fs.setDoc(ref, base);
  }
  return false;
}

/** The inspo photo sent with a cloud request (baker only), or null. */
export async function loadRequestPhoto(id: string): Promise<string | null> {
  const c = await loadCloud();
  const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'requests', id));
  const p = snap.exists() ? snap.data().photo : null;
  return typeof p === 'string' && p.startsWith('data:image/jpeg;base64,') ? p : null;
}

/** The baker's cloud inbox, live. */
export async function listenRequests(uid: string, onReq: (r: CakeRequest, notify: string | null) => void): Promise<() => void> {
  const c = await loadCloud();
  const { collection, onSnapshot, query, where } = c.m.fs;
  return onSnapshot(
    query(collection(c.db, 'requests'), where('bakerUid', '==', uid)),
    (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        try {
          const r = cakeRequestSchema.safeParse(JSON.parse(String(ch.doc.data().req)));
          const n = ch.doc.data().notify;
          if (r.success && r.data.id === ch.doc.id) onReq(r.data as CakeRequest, typeof n === 'string' ? n : null);
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

/** The customer's one counter-offer (create-only, so a second one is refused). */
export async function sendOffer(offer: OfferLink, bakerUid: string): Promise<void> {
  const c = await loadCloud();
  await c.m.fs.setDoc(c.m.fs.doc(c.db, 'offers', offer.orderId), { bakerUid, offer: JSON.stringify(offer), createdAt: now() });
}

export async function listenOffers(uid: string, onOffer: (o: OfferLink) => void): Promise<() => void> {
  const c = await loadCloud();
  const { collection, onSnapshot, query, where } = c.m.fs;
  return onSnapshot(
    query(collection(c.db, 'offers'), where('bakerUid', '==', uid)),
    (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        try {
          const r = offerLinkSchema.safeParse(JSON.parse(String(ch.doc.data().offer)));
          if (r.success && r.data.orderId === ch.doc.id) onOffer(r.data);
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
 * inbox requests, confirmations and offers, published quotes, and the customer's "My cakes" list.
 * Data on this phone is left alone (the person can clear it from About).
 */
export async function deleteCloudData(uid: string, slug: string | null, quoteIds: string[]): Promise<void> {
  const c = await loadCloud();
  const { doc, deleteDoc, getDoc, getDocs, collection, query, where } = c.m.fs;
  const jobs: Promise<unknown>[] = [];
  for (const col of ['requests', 'confirmations', 'offers'] as const) {
    // A rules version without "offers" refuses this query; delete the rest anyway.
    const snap = await getDocs(query(collection(c.db, col), where('bakerUid', '==', uid))).catch((e) => {
      if (col === 'offers') return null;
      throw e;
    });
    snap?.forEach((d) => jobs.push(deleteDoc(d.ref)));
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
  jobs.push(deleteDoc(doc(c.db, 'bakeries', uid)), deleteDoc(doc(c.db, 'users', uid)), deleteDoc(doc(c.db, 'push', uid)));
  await Promise.all(jobs);
}

/** Turn on "new request" notifications for this phone (a baker can have up to 5 phones). */
export async function savePushSub(uid: string, sub: import('../push/core').PushSub): Promise<void> {
  const { mergeSubs, parseSubs } = await import('../push/core');
  const c = await loadCloud();
  const ref = c.m.fs.doc(c.db, 'push', uid);
  const snap = await c.m.fs.getDoc(ref);
  const list = mergeSubs(parseSubs(snap.exists() ? String(snap.data().subs ?? '[]') : '[]'), sub);
  await c.m.fs.setDoc(ref, { subs: JSON.stringify(list), updatedAt: now() });
}
