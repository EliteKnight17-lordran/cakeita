import { firebaseConfig, emulatorOn } from './config';

/**
 * Firebase is loaded only when a cloud feature is used (sign-in, a cloud bakery link, a live
 * quote), so the first visit stays small and fast on prepaid data.
 */
type Mods = {
  app: typeof import('firebase/app');
  auth: typeof import('firebase/auth');
  fs: typeof import('firebase/firestore');
};
export interface Cloud {
  m: Mods;
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
}

let loading: Promise<Cloud> | null = null;

export function loadCloud(): Promise<Cloud> {
  loading ??= (async () => {
    const [app, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const a = app.initializeApp(firebaseConfig);
    const au = auth.initializeAuth(a, {
      persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence],
      popupRedirectResolver: auth.browserPopupRedirectResolver,
    });
    const db = fs.getFirestore(a);
    if (emulatorOn()) {
      auth.connectAuthEmulator(au, 'http://127.0.0.1:9099', { disableWarnings: true });
      fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    return { m: { app, auth, fs }, auth: au, db };
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
