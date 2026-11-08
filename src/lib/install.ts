import { useEffect, useState } from 'react';

/** "Add to home screen" when the browser offers it (Chrome/Android). iPhone users use Share → Add to Home Screen. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}
let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    subs.forEach((s) => s());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    subs.forEach((s) => s());
  });
}

export function useInstall(): (() => Promise<void>) | null {
  const [, force] = useState(0);
  useEffect(() => {
    const s = () => force((n) => n + 1);
    subs.add(s);
    return () => {
      subs.delete(s);
    };
  }, []);
  if (!deferred) return null;
  return async () => {
    const d = deferred;
    deferred = null;
    await d?.prompt();
    subs.forEach((s) => s());
  };
}
