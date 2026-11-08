import type { PushSub } from './core';

/**
 * Browser side of phone notifications. Everything here fails soft: if the browser, the phone
 * or the server can't do push, the app works exactly as before (Messenger links, live inbox).
 */

let status: Promise<{ enabled: boolean; publicKey: string }> | null = null;

/** Can this browser do push at all? iPhones need the app installed to the home screen first. */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !navigator.webdriver;
}

export function needsInstallFirst(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Is the notify server set up (VAPID key in Vercel)? Cached for the page's life. */
export function pushServerReady(): Promise<{ enabled: boolean; publicKey: string }> {
  status ??= fetch('./api/notify', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { enabled: false, publicKey: '' }))
    .then((d: { enabled?: boolean; publicKey?: string }) => ({ enabled: !!d.enabled && !!d.publicKey, publicKey: d.publicKey ?? '' }))
    .catch(() => ({ enabled: false, publicKey: '' }));
  return status;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission (call from a tap) and subscribe this phone. Returns null if not possible or refused. */
export async function subscribeThisPhone(): Promise<PushSub | null> {
  if (!pushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const { enabled, publicKey } = await pushServerReady();
  if (!enabled) return null;
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('./sw.js'));
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return null;
  return { endpoint: j.endpoint, expirationTime: j.expirationTime ?? null, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
}

/** Already subscribed on this phone (and allowed)? */
export async function phoneIsSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

/** Fire and forget: tell the server to notify. Never throws. */
export function sendNotify(body: unknown): void {
  fetch('./api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}
