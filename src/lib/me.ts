/**
 * The customer's own name and contact, remembered on this phone after they send a request,
 * so the next request is one tap. Never sent anywhere except inside a request they send.
 */
const KEY = 'cakeita.me.v1';
const DEMO = 'cakeita.demoSeen';

export interface Me {
  name: string;
  contact: string;
}

export function readMe(): Me {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Me>;
    return { name: typeof v.name === 'string' ? v.name.slice(0, 80) : '', contact: typeof v.contact === 'string' ? v.contact.slice(0, 120) : '' };
  } catch {
    return { name: '', contact: '' };
  }
}

export function saveMe(me: Me): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: me.name.trim().slice(0, 80), contact: me.contact.trim().slice(0, 120) }));
  } catch {
    /* storage blocked: they just type it again next time */
  }
}

/** The guided demo was opened on this phone, so demo-only shortcuts can show. */
export function markDemoSeen(): void {
  try {
    localStorage.setItem(DEMO, '1');
  } catch {
    /* ignore */
  }
}

export function demoSeen(): boolean {
  try {
    return localStorage.getItem(DEMO) === '1';
  } catch {
    return false;
  }
}
