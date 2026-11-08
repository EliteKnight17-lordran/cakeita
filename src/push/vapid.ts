/**
 * Make a Web Push (VAPID) key pair on this device, for the owner to paste into Vercel.
 * P-256 ECDSA: public key = raw point (65 bytes), private key = the 32-byte "d", both base64url,
 * which is the format the web-push library expects. Nothing leaves the device.
 */
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function makeVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64url(raw), privateKey: jwk.d ?? '' };
}
