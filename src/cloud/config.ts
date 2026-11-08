/**
 * Firebase web config for the Cakeita project. These values are public by design: they only
 * name the project. What protects data is firestore.rules (see the repo root) and the list of
 * authorized domains in Firebase Authentication.
 * https://firebase.google.com/docs/projects/api-keys
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyA1SrLDLyIcDn_1TZOGnSQopnaYwo5QAAc',
  authDomain: 'cakeita-646e6.firebaseapp.com',
  projectId: 'cakeita-646e6',
  storageBucket: 'cakeita-646e6.firebasestorage.app',
  messagingSenderId: '653077611493',
  appId: '1:653077611493:web:dd131e3983dd68fa5ea50c',
};

function flag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Cloud features (accounts, cloud inbox, live quotes, real bakers on the map) are on unless:
 * - turned off on this device (Demo tab, or localStorage cakeita.cloud = "off"), or
 * - a test robot is driving the browser (keeps automated tests offline and repeatable),
 *   unless it opts in with cakeita.cloud = "on".
 * Everything still works without the cloud through Messenger links.
 */
export function cloudEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const f = flag('cakeita.cloud');
  if (f === 'off') return false;
  if (f === 'on') return true;
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}

/** Use the local Firebase emulators (developers only): localStorage cakeita.emulator = "1". */
export function emulatorOn(): boolean {
  return flag('cakeita.emulator') === '1';
}
