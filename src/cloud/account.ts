import { useSyncExternalStore } from 'react';
import { cloudEnabled } from './config';
import { loadCloud } from './fb';

/**
 * The signed-in account (or none). Firebase is only woken up on this device when someone has
 * signed in here before, or opens the Account page, so customers who never sign in never
 * download it.
 */
export interface AccountUser {
  uid: string;
  name: string;
  email: string;
  photo: string;
  provider: string;
}
export type AccountState =
  | { status: 'off' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string; notice?: string }
  | { status: 'signed-in'; user: AccountUser };

const HINT = 'cakeita.cloud.signedIn';
const EMAIL = 'cakeita.emailForSignIn';

let state: AccountState = { status: 'idle' };
const listeners = new Set<() => void>();
function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let started = false;
/** Start listening to Firebase Auth. Safe to call many times. */
export function startAccount(): void {
  if (started) return;
  if (!cloudEnabled()) {
    set({ status: 'off' });
    return;
  }
  started = true;
  set({ status: 'loading' });
  loadCloud()
    .then(async (c) => {
      const { auth } = c.m;
      // Finish a sign-in that came back from an email link or a redirect.
      if (auth.isSignInWithEmailLink(c.auth, window.location.href)) {
        const email = read(EMAIL) ?? window.prompt('Para matapos, i-type ulit ang email mo / Type your email again to finish signing in') ?? '';
        try {
          if (email) await auth.signInWithEmailLink(c.auth, email, window.location.href);
          store(EMAIL, null);
        } catch (e) {
          set({ status: 'signed-out', error: friendlyError(e) });
        }
        window.history.replaceState(null, '', `${window.location.pathname}#/account`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      try {
        await auth.getRedirectResult(c.auth);
      } catch (e) {
        set({ status: 'signed-out', error: friendlyError(e) });
      }
      auth.onAuthStateChanged(c.auth, (u) => {
        if (u) {
          store(HINT, '1');
          set({
            status: 'signed-in',
            user: { uid: u.uid, name: u.displayName ?? '', email: u.email ?? '', photo: u.photoURL ?? '', provider: u.providerData[0]?.providerId ?? 'password' },
          });
        } else {
          store(HINT, null);
          set(state.status === 'signed-out' ? state : { status: 'signed-out' });
        }
      });
    })
    .catch(() => {
      started = false;
      set({ status: 'signed-out', error: 'No internet right now. Cakeita still works on this phone; sign in later.' });
    });
}

/** Wake Firebase at app start only if this device has an account signed in, or is finishing an email link. */
export function startAccountIfKnown(): void {
  if (read(HINT) === '1' || /[?&]mode=signIn/.test(window.location.search)) startAccount();
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function currentUid(): string | null {
  return state.status === 'signed-in' ? state.user.uid : null;
}

/** In-app browsers (Messenger, Facebook, Instagram) block Google sign-in pop-ups. */
export function inAppBrowser(): boolean {
  return typeof navigator !== 'undefined' && /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\//i.test(navigator.userAgent);
}

export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return '';
  if (code.includes('operation-not-allowed') || code.includes('configuration-not-found'))
    return 'This sign-in option is not switched on yet. Try another one. / Hindi pa naka-on ang paraang ito.';
  if (code.includes('account-exists-with-different-credential'))
    return 'You already have an account with this email through another option. Sign in with that one first. / May account ka na gamit ang ibang paraan.';
  if (code.includes('network')) return 'No internet. Try again when you have signal. / Walang internet.';
  if (code.includes('unauthorized-domain')) return 'This web address is not allowed to sign in yet. / Hindi pa pinapayagan ang address na ito.';
  if (code.includes('invalid-email')) return 'That email does not look right. / Mukhang mali ang email.';
  if (code.includes('invalid-action-code') || code.includes('expired-action-code')) return 'That sign-in link is used or expired. Ask for a new one. / Luma na ang link.';
  return 'Sign-in did not work. Please try again. / Hindi natuloy ang sign-in.';
}

async function popupOrRedirect(kind: 'google' | 'facebook') {
  const c = await loadCloud();
  const { auth } = c.m;
  const provider = kind === 'google' ? new auth.GoogleAuthProvider() : new auth.FacebookAuthProvider();
  if (kind === 'facebook') (provider as import('firebase/auth').FacebookAuthProvider).addScope('email');
  try {
    await auth.signInWithPopup(c.auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
      await auth.signInWithRedirect(c.auth, provider);
      return;
    }
    throw e;
  }
}

export async function signInWith(kind: 'google' | 'facebook'): Promise<string> {
  startAccount();
  try {
    await popupOrRedirect(kind);
    return '';
  } catch (e) {
    return friendlyError(e);
  }
}

/** Passwordless: email a one-tap sign-in link. */
export async function sendEmailLink(email: string): Promise<string> {
  startAccount();
  try {
    const c = await loadCloud();
    await c.m.auth.sendSignInLinkToEmail(c.auth, email, { url: `${window.location.origin}${window.location.pathname}`, handleCodeInApp: true });
    store(EMAIL, email);
    return '';
  } catch (e) {
    return friendlyError(e);
  }
}

export async function signOut(): Promise<void> {
  const c = await loadCloud();
  await c.m.auth.signOut(c.auth);
  store(HINT, null);
}
