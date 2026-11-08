import webpush from 'web-push';
import { RateLimiter } from '../src/ai/rateLimit.js';
import { handleNotify, notifyBodySchema, restFields } from '../src/push/core.js';

/**
 * POST /api/notify  (Vercel serverless function, optional)
 * Sends a phone notification for a new request (to the baker) or a ready quote (to the customer).
 * Needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel. Without them, GET says {enabled:false} and the app hides the button.
 * Reads Firestore as the public would (security rules apply), so it needs no admin credentials.
 */

const PROJECT = 'cakeita-646e6';
const API_KEY = 'AIzaSyA1SrLDLyIcDn_1TZOGnSQopnaYwo5QAAc';
const limiter = new RateLimiter(20, 60 * 60 * 1000); // per IP
const perBaker = new RateLimiter(30, 60 * 60 * 1000); // per baker, so one baker can't be flooded

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const ip = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'unknown';

export async function GET(): Promise<Response> {
  const pub = process.env.VAPID_PUBLIC_KEY ?? '';
  return json({ enabled: !!pub && !!process.env.VAPID_PRIVATE_KEY, publicKey: pub });
}

export async function POST(req: Request): Promise<Response> {
  const priv = process.env.VAPID_PRIVATE_KEY;
  const pub = process.env.VAPID_PUBLIC_KEY;
  if (!priv || !pub) return json({ ok: false, error: 'Notifications are not set up.' }, 503);
  if (!limiter.check(ip(req)).allowed) return json({ ok: false, error: 'Too many requests.' }, 429);
  let body;
  try {
    body = notifyBodySchema.parse(await req.json());
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }
  if (body.kind === 'request' && !perBaker.check(body.bakerUid).allowed) return json({ ok: false, error: 'Too many requests.' }, 429);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://cakeita.vercel.app', pub, priv);
  const res = await handleNotify(body, {
    now: new Date(),
    getDoc: async (path) => {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}?key=${API_KEY}`);
      return r.ok ? restFields(await r.json()) : null;
    },
    send: async (sub, payload) => {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 24 * 60 * 60, urgency: 'high' });
    },
  });
  return json({ ok: res.status === 200, sent: res.sent }, res.status);
}
