import { useEffect, useState } from 'react';
import { toPublicMenu } from '../domain/pricing';
import { publicMenuSchema } from '../domain/schemas';
import type { PublicMenu } from '../domain/types';
import { localBakeryFor, useDb } from '../data/store';
import { decodePayload, type LinkError } from '../lib/codec';

export type MenuState = { status: 'loading' } | { status: 'ok'; menu: PublicMenu } | { status: 'error'; error: LinkError | 'missing' | 'mismatch' };

/** Load the bakery menu from the link (?m=...), this device, or the built-in sample. */
export function useMenu(slug: string, code: string | null): MenuState {
  const db = useDb();
  const [state, setState] = useState<MenuState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = localBakeryFor(slug);
      if (local && (!code || local === db.bakery)) {
        if (alive) setState({ status: 'ok', menu: toPublicMenu(local) });
        return;
      }
      if (code) {
        const r = await decodePayload(code, publicMenuSchema);
        if (!alive) return;
        if (r.ok && r.value.slug === slug) setState({ status: 'ok', menu: r.value });
        else setState({ status: 'error', error: r.ok ? 'mismatch' : r.error });
        return;
      }
      if (alive) setState({ status: 'error', error: 'missing' });
    })();
    return () => {
      alive = false;
    };
  }, [slug, code, db.bakery]);

  return state;
}
