import { z } from 'zod';

/**
 * Phone notifications (Web Push), shared by the browser and the /api/notify function.
 * Pure code: the server passes in how to read Firestore and how to send a push.
 *
 *   New request  customer's phone -> /api/notify {kind:'request'} -> every phone the baker turned on
 *   Quote ready  baker's phone    -> /api/notify {kind:'quote'}   -> the phone the customer turned on
 *
 * Nothing secret travels: a subscription can only be used with the server's private VAPID key.
 */

export const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});
export type PushSub = z.infer<typeof subscriptionSchema>;

const idRe = /^[A-Za-z0-9-]{4,64}$/;
const uidRe = /^[A-Za-z0-9]{10,128}$/;

export const notifyBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('request'), bakerUid: z.string().regex(uidRe), id: z.string().regex(idRe) }),
  z.object({ kind: z.literal('quote'), orderId: z.string().regex(idRe), sub: subscriptionSchema }),
]);
export type NotifyBody = z.infer<typeof notifyBodySchema>;

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface NotifyDeps {
  /** Read a Firestore document's fields (strings only) as the public would, or null. */
  getDoc: (path: string) => Promise<Record<string, string> | null>;
  /** Send one push. Should throw with statusCode 404/410 when the subscription is gone. */
  send: (sub: PushSub, payload: PushPayload) => Promise<void>;
  now: Date;
}

/** Parse the JSON list of subscriptions a baker saved, dropping anything malformed. */
export function parseSubs(text: string | undefined): PushSub[] {
  try {
    const arr = JSON.parse(text ?? '[]') as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => subscriptionSchema.safeParse(s)).filter((r) => r.success).map((r) => r.data!).slice(0, 5);
  } catch {
    return [];
  }
}

/** Add (or refresh) one phone in a baker's list; newest first, at most 5 phones. */
export function mergeSubs(list: PushSub[], sub: PushSub): PushSub[] {
  return [sub, ...list.filter((s) => s.endpoint !== sub.endpoint)].slice(0, 5);
}

/** A quote counts as "just published" for 30 minutes, so old ids can't be replayed for spam. */
const QUOTE_FRESH_MS = 30 * 60 * 1000;

export async function handleNotify(body: NotifyBody, deps: NotifyDeps): Promise<{ status: number; sent: number }> {
  if (body.kind === 'request') {
    const doc = await deps.getDoc(`push/${body.bakerUid}`);
    const subs = parseSubs(doc?.subs);
    if (!subs.length) return { status: 200, sent: 0 };
    const payload: PushPayload = { title: 'New cake request / Bagong cake request', body: 'Open Cakeita to see it and send your quote.', url: './#/baker', tag: `rq-${body.id}` };
    let sent = 0;
    for (const s of subs) {
      try {
        await deps.send(s, payload);
        sent++;
      } catch {
        /* a phone that turned notifications off; skip it */
      }
    }
    return { status: 200, sent };
  }
  const q = await deps.getDoc(`quotes/${body.orderId}`);
  if (!q) return { status: 404, sent: 0 };
  const at = Date.parse(q.updatedAt ?? '');
  if (!Number.isFinite(at) || deps.now.getTime() - at > QUOTE_FRESH_MS) return { status: 409, sent: 0 };
  try {
    await deps.send(body.sub, { title: 'Your cake quote is ready / May quote na', body: 'Tap to see the price and confirm.', url: `./#/o/${body.orderId}`, tag: `q-${body.orderId}` });
    return { status: 200, sent: 1 };
  } catch {
    return { status: 200, sent: 0 };
  }
}

/** Firestore REST document -> plain string fields. */
export function restFields(doc: unknown): Record<string, string> {
  const fields = (doc as { fields?: Record<string, { stringValue?: string }> })?.fields ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) if (typeof v?.stringValue === 'string') out[k] = v.stringValue;
  return out;
}
