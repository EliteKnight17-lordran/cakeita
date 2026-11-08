import { describe, expect, it } from 'vitest';
import { handleNotify, mergeSubs, notifyBodySchema, parseSubs, restFields, type PushSub } from './core';

const sub = (n: number): PushSub => ({ endpoint: `https://push.example.com/${n}`, expirationTime: null, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } });
const now = new Date('2026-11-09T02:00:00Z');

describe('push subscriptions', () => {
  it('keeps the newest 5 phones, one entry per phone', () => {
    let list: PushSub[] = [];
    for (const n of [1, 2, 3, 2, 4, 5, 6]) list = mergeSubs(list, sub(n));
    expect(list.map((s) => s.endpoint.slice(-1))).toEqual(['6', '5', '4', '2', '3']);
  });

  it('drops malformed saved data', () => {
    expect(parseSubs('nope')).toEqual([]);
    expect(parseSubs(JSON.stringify([sub(1), { endpoint: 'http://insecure', keys: {} }]))).toHaveLength(1);
  });

  it('only accepts well-formed notify calls', () => {
    expect(notifyBodySchema.safeParse({ kind: 'request', bakerUid: 'anaUid0000001', id: 'rq-abc123' }).success).toBe(true);
    expect(notifyBodySchema.safeParse({ kind: 'request', bakerUid: '../x', id: 'rq-abc123' }).success).toBe(false);
    expect(notifyBodySchema.safeParse({ kind: 'quote', orderId: 'rq-abc123', sub: { endpoint: 'ftp://x' } }).success).toBe(false);
  });

  it('reads Firestore REST string fields', () => {
    expect(restFields({ fields: { subs: { stringValue: '[]' }, n: { integerValue: '3' } } })).toEqual({ subs: '[]' });
  });
});

describe('handleNotify', () => {
  const docs: Record<string, Record<string, string>> = {
    'push/anaUid0000001': { subs: JSON.stringify([sub(1), sub(2)]) },
    'quotes/rq-fresh1': { updatedAt: '2026-11-09T01:50:00Z' },
    'quotes/rq-old111': { updatedAt: '2026-11-08T01:00:00Z' },
  };
  const deps = (sent: string[], fail = '') => ({
    now,
    getDoc: async (p: string) => docs[p] ?? null,
    send: async (s: PushSub, payload: { url: string }) => {
      if (fail && s.endpoint.endsWith(fail)) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push(`${s.endpoint.slice(-1)} ${payload.url}`);
    },
  });

  it('pings every phone of the baker, skipping dead ones', async () => {
    const sent: string[] = [];
    expect(await handleNotify({ kind: 'request', bakerUid: 'anaUid0000001', id: 'rq-1234' }, deps(sent, '/2'))).toEqual({ status: 200, sent: 1 });
    expect(sent).toEqual(['1 ./#/baker']);
  });

  it('does nothing for a baker without alerts', async () => {
    expect(await handleNotify({ kind: 'request', bakerUid: 'benUid0000001', id: 'rq-1234' }, deps([]))).toEqual({ status: 200, sent: 0 });
  });

  it('tells the customer only about a real, fresh quote', async () => {
    const sent: string[] = [];
    expect((await handleNotify({ kind: 'quote', orderId: 'rq-fresh1', sub: sub(9) }, deps(sent))).sent).toBe(1);
    expect(sent).toEqual(['9 ./#/o/rq-fresh1']);
    expect((await handleNotify({ kind: 'quote', orderId: 'rq-old111', sub: sub(9) }, deps([]))).status).toBe(409);
    expect((await handleNotify({ kind: 'quote', orderId: 'rq-none11', sub: sub(9) }, deps([]))).status).toBe(404);
  });
});
