import { describe, expect, it } from 'vitest';
import { cakeRequestSchema, quoteLinkSchema } from '../domain/schemas';
import { handoffText, niceTime } from './dates';

const en = (e: string) => e;
const tl = (_e: string, t: string) => t;

describe('pickup or delivery', () => {
  it('writes times the way people say them', () => {
    expect(niceTime('15:30')).toBe('3:30 PM');
    expect(niceTime('00:15')).toBe('12:15 AM');
    expect(niceTime('12:00')).toBe('12:00 PM');
    expect(niceTime('')).toBe('');
  });
  it('says who pays the delivery fee, for whoever reads it', () => {
    const d = { handoff: 'delivery' as const, handoffTime: '15:30', address: 'Cubao' };
    expect(handoffText(d, en, 'me')).toBe('Delivery to Cubao at 3:30 PM (I pay the delivery fee)');
    expect(handoffText(d, tl, 'baker')).toBe('Delivery sa Cubao nang 3:30 PM (customer ang magbabayad ng delivery fee)');
    expect(handoffText({ handoff: 'pickup', handoffTime: '' }, en, 'you')).toBe('Pickup');
  });
  it('older links without it still open', () => {
    const q = quoteLinkSchema.shape.handoff.parse(undefined);
    expect(q).toBeNull();
    expect(cakeRequestSchema.shape.handoff.parse(undefined)).toBe('pickup');
    expect(cakeRequestSchema.shape.handoffTime.parse('25 o clock')).toBe('');
  });
});
