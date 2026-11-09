import { useEffect } from 'react';
import { answerOffer, applyOffer, approveOrder, declineOrder, quoteLinkPayload, requestToOrder } from '../domain/orders';
import { sampleBakerReply, sampleOfferAnswer } from '../domain/sampleReply';
import { cakeRequestSchema } from '../domain/schemas';
import type { Bakery, CakeRequest, Order } from '../domain/types';
import { decodePayload } from '../lib/codec';
import { quoteLink } from '../lib/links';
import { DIRECTORY_SLUGS, directoryBakery } from './directory';
import { repo, useDb, type MyRequest } from './store';

/**
 * DEMO ONLY. The sample bakeries on the map (all labeled "(sample)") answer requests by
 * themselves after a few seconds, so a customer can try choose → quote → counter-offer →
 * confirm without a real baker. Their "orders" live in their own key on this phone and
 * never mix with a real baker's inbox. Real bakers always answer by hand.
 */

const KEY = 'cakeita.sampleReplies.v1';
/** How long a sample baker "thinks" before answering. */
export const SAMPLE_DELAY_MS = 2500;

/** Is this slug a sample bakery that should answer by itself on this phone? */
export function isAutoBaker(slug: string): boolean {
  // Only the map's sample shops. The built-in "Sample Bakery" is the demo baker that a person
  // answers by hand (on this phone or another one), so it never answers by itself.
  return DIRECTORY_SLUGS.includes(slug);
}

function autoBakery(slug: string): Bakery | null {
  return directoryBakery(slug);
}

function readAll(): Record<string, Order> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Order>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function save(o: Order) {
  const all = readAll();
  all[o.id] = o;
  const keep = Object.values(all)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep.map((x) => [x.id, x]))));
  } catch {
    /* storage full or blocked: the demo still shows the answer for this visit */
  }
}

async function requestOf(r: MyRequest): Promise<CakeRequest | null> {
  const i = r.requestLink.indexOf('?', r.requestLink.indexOf('#'));
  const code = i < 0 ? null : new URLSearchParams(r.requestLink.slice(i + 1)).get('r');
  if (!code) return null;
  const res = await decodePayload(code, cakeRequestSchema);
  return res.ok && res.value.id === r.id ? (res.value as CakeRequest) : null;
}

async function publish(bakery: Bakery, o: Order, status: MyRequest['status']) {
  save(o);
  const q = quoteLinkPayload(bakery, o);
  if (q) repo.updateMyRequest(o.id, { status, quoteLink: await quoteLink(q) });
}

/** The sample baker's first answer: a quote (maybe a counter-offer) or a polite no. */
export async function answerRequest(r: MyRequest, now = new Date()): Promise<void> {
  const bakery = autoBakery(r.bakerySlug);
  const req = await requestOf(r);
  if (!bakery || !req || readAll()[r.id]) return;
  const order = requestToOrder(req, 'link', now);
  const reply = sampleBakerReply(bakery, req);
  if (reply.kind === 'declined') {
    await publish(bakery, declineOrder(order, reply.reason, now), 'declined');
    return;
  }
  const approved = approveOrder(bakery, order, { selection: req.selection, look: req.look, price: reply.price, note: reply.note, validDays: 3 }, now);
  await publish(bakery, approved, 'quoted');
}

/** The sample baker's answer to the customer's one counter-offer. */
export async function answerCustomerOffer(r: MyRequest, now = new Date()): Promise<void> {
  const bakery = autoBakery(r.bakerySlug);
  const order = readAll()[r.id];
  if (!bakery || !order || !r.offer) return;
  const applied = applyOffer(order, { v: 1, orderId: r.id, price: r.offer.price, note: r.offer.note, customerName: order.customer.name, at: r.offer.at }, now);
  if (!applied.ok) return;
  const next = answerOffer(bakery, applied.order, sampleOfferAnswer(bakery, order, r.offer.price), now);
  await publish(bakery, next, 'quoted');
}

const busy = new Set<string>();

/** Runs the sample bakers' answers in the background, on any page. */
export function SampleBakerSync() {
  const db = useDb();
  const jobs = db.myRequests
    .filter((r) => r.auto)
    .map((r) => {
      const order = readAll()[r.id];
      if (r.status === 'sent' && !order) return { r, step: 'quote' as const };
      if (r.status === 'quoted' && r.offer && order && !order.offer) return { r, step: 'offer' as const };
      return null;
    })
    .filter((j) => !!j);
  const key = jobs.map((j) => `${j.r.id}:${j.step}`).join(',');
  useEffect(() => {
    const waiting = new Map<string, number>();
    for (const j of jobs) {
      const id = `${j.r.id}:${j.step}`;
      if (busy.has(id)) continue;
      busy.add(id);
      waiting.set(
        id,
        window.setTimeout(() => {
          waiting.delete(id);
          const fresh = repo.get().myRequests.find((x) => x.id === j.r.id);
          const run = fresh ? (j.step === 'quote' ? answerRequest(fresh) : answerCustomerOffer(fresh)) : Promise.resolve();
          run.catch(() => {}).finally(() => busy.delete(id));
        }, SAMPLE_DELAY_MS),
      );
    }
    return () => {
      // Timers that never ran can be scheduled again on the next render.
      for (const [id, t] of waiting) {
        window.clearTimeout(t);
        busy.delete(id);
      }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** For the customer's confirmation to a sample bakery: nothing to send, just mark it. */
export function confirmSample(id: string, note: string, now = new Date()): void {
  const o = readAll()[id];
  if (o) save({ ...o, status: 'confirmed', confirmedAt: now.toISOString(), customerNote: note, history: [...o.history, { at: now.toISOString(), type: 'confirmed' }] });
}
