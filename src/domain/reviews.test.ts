import { describe, expect, it } from 'vitest';
import { bySlug, publicName, reviewId, reviewSchema, summarize, type Review } from './reviews';

const r = (slug: string, stars: number, createdAt: string, text = ''): Review => ({ slug, stars, text, name: 'Ana T.', createdAt });

describe('reviews', () => {
  it('shows only a first name and last initial', () => {
    expect(publicName('Ana Marie Torres')).toBe('Ana T.');
    expect(publicName('  migo ')).toBe('migo');
    expect(publicName('')).toBe('Customer');
  });

  it('gives one id per customer per bakery', () => {
    expect(reviewId('uid123', 'ana-bakes')).toBe('uid123_ana-bakes');
  });

  it('averages to one decimal, newest first', () => {
    const s = summarize([r('a', 5, '2026-11-01'), r('a', 4, '2026-11-03'), r('a', 4, '2026-11-02')])!;
    expect(s).toMatchObject({ avg: 4.3, count: 3 });
    expect(s.latest.map((x) => x.createdAt)).toEqual(['2026-11-03', '2026-11-02', '2026-11-01']);
    expect(summarize([])).toBeNull();
  });

  it('groups by bakery', () => {
    const m = bySlug([r('a', 5, '1'), r('b', 3, '2'), r('a', 3, '3')]);
    expect(m.get('a')).toMatchObject({ avg: 4, count: 2 });
    expect(m.get('b')).toMatchObject({ avg: 3, count: 1 });
  });

  it('rejects broken review data', () => {
    expect(reviewSchema.safeParse({ slug: 'a', stars: 6, text: '', name: 'x', createdAt: 'now' }).success).toBe(false);
    expect(reviewSchema.safeParse({ slug: 'a', stars: 4.5, text: '', name: 'x', createdAt: 'now' }).success).toBe(false);
    expect(reviewSchema.safeParse({ slug: 'a', stars: 4, text: 'Sarap!', name: 'Ana T.', createdAt: 'now' }).success).toBe(true);
  });
});
