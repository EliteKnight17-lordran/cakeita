import { useSyncExternalStore } from 'react';

/** True while a CSS media query matches (e.g. a wide screen). False on the server. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(query);
      m?.addEventListener('change', cb);
      return () => m?.removeEventListener('change', cb);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
