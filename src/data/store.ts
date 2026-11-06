import { useSyncExternalStore } from 'react';
import { createSampleBakery } from '../domain/starterMenus';
import type { Bakery, Order, OrderEvent } from '../domain/types';

/**
 * Local-first data store. Everything lives on the device (localStorage) and is
 * shared live between tabs (BroadcastChannel + storage events).
 *
 * Why local-first: zero hosting cost, works on weak signal, no customer data on
 * our servers (Data Privacy Act friendly). Devices exchange requests and quotes
 * through share links. A cloud adapter (e.g. Firebase) can implement the same
 * `Repo` interface later without touching the screens.
 */

export interface MyRequest {
  id: string;
  bakerySlug: string;
  bakeryName: string;
  createdAt: string;
  summary: string;
  requestLink: string;
  quoteLink?: string;
  status: 'sent' | 'quoted' | 'confirmed';
}

export interface DbState {
  v: 1;
  bakery: Bakery | null;
  orders: Order[];
  myRequests: MyRequest[];
}

export interface Repo {
  get(): DbState;
  setBakery(b: Bakery | null): void;
  upsertOrder(o: Order): void;
  updateOrder(id: string, patch: Partial<Order>, event?: Omit<OrderEvent, 'at'>): Order | null;
  removeOrder(id: string): void;
  addMyRequest(r: MyRequest): void;
  updateMyRequest(id: string, patch: Partial<MyRequest>): void;
  replaceAll(s: DbState): void;
  reset(): void;
  subscribe(cb: () => void): () => void;
}

const KEY = 'cakeita.db.v1';
const EMPTY: DbState = { v: 1, bakery: null, orders: [], myRequests: [] };

function read(): DbState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as DbState;
    if (parsed?.v !== 1 || !Array.isArray(parsed.orders)) throw new Error('bad shape');
    return { ...EMPTY, ...parsed, myRequests: parsed.myRequests ?? [] };
  } catch {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}.corrupt.${Date.now()}`, raw);
    } catch {
      /* ignore */
    }
    return EMPTY;
  }
}

class LocalRepo implements Repo {
  private state: DbState = typeof window === 'undefined' ? EMPTY : read();
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  lastError: string | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.channel = new BroadcastChannel('cakeita');
      this.channel.onmessage = () => this.reload();
    } catch {
      this.channel = null;
    }
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) this.reload();
    });
  }

  private reload() {
    this.state = read();
    this.listeners.forEach((l) => l());
  }

  private commit(next: DbState) {
    this.state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      this.lastError = null;
    } catch {
      this.lastError = 'Storage is full or blocked. Changes are kept until you close this tab.';
    }
    this.channel?.postMessage('changed');
    this.listeners.forEach((l) => l());
  }

  get() {
    return this.state;
  }
  setBakery(b: Bakery | null) {
    this.commit({ ...this.state, bakery: b ? { ...b, updatedAt: new Date().toISOString() } : null });
  }
  upsertOrder(o: Order) {
    const others = this.state.orders.filter((x) => x.id !== o.id);
    this.commit({ ...this.state, orders: [o, ...others] });
  }
  updateOrder(id: string, patch: Partial<Order>, event?: Omit<OrderEvent, 'at'>) {
    const cur = this.state.orders.find((o) => o.id === id);
    if (!cur) return null;
    const next: Order = { ...cur, ...patch, history: event ? [...cur.history, { at: new Date().toISOString(), ...event }] : cur.history };
    this.commit({ ...this.state, orders: this.state.orders.map((o) => (o.id === id ? next : o)) });
    return next;
  }
  removeOrder(id: string) {
    this.commit({ ...this.state, orders: this.state.orders.filter((o) => o.id !== id) });
  }
  addMyRequest(r: MyRequest) {
    this.commit({ ...this.state, myRequests: [r, ...this.state.myRequests.filter((x) => x.id !== r.id)].slice(0, 50) });
  }
  updateMyRequest(id: string, patch: Partial<MyRequest>) {
    this.commit({ ...this.state, myRequests: this.state.myRequests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  replaceAll(s: DbState) {
    this.commit({ ...EMPTY, ...s, v: 1 });
  }
  reset() {
    this.commit(EMPTY);
  }
  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const repo: Repo = new LocalRepo();

export function useDb(): DbState {
  return useSyncExternalStore(
    (cb) => repo.subscribe(cb),
    () => repo.get(),
    () => EMPTY,
  );
}

/** The bakery a customer link points to on THIS device (own bakery, or the built-in sample). */
export function localBakeryFor(slug: string): Bakery | null {
  const own = repo.get().bakery;
  if (own && own.slug === slug) return own;
  if (slug === 'sample') return createSampleBakery();
  return null;
}

export function newId(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${rnd}`;
}
