import { z } from 'zod';

/**
 * Star reviews. Only a customer whose order the baker quoted and who confirmed it can post
 * one (checked by the database rules), and only one per customer per bakery. Nothing here is
 * ever made up: sample shops have no reviews.
 */

export interface Review {
  slug: string;
  stars: number;
  text: string;
  /** First name and last initial ("Ana T."), never the full name. */
  name: string;
  createdAt: string;
}

export const reviewSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  stars: z.number().int().min(1).max(5),
  text: z.string().max(300),
  name: z.string().max(40),
  createdAt: z.string().max(40),
});

/** "Ana Marie Torres" -> "Ana T."; one word stays as it is. */
export function publicName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  const first = parts[0]!.slice(0, 20);
  const last = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : '';
  return `${first}${last}`;
}

/** One review per customer per bakery: the document id says who and where. */
export function reviewId(uid: string, slug: string): string {
  return `${uid}_${slug}`;
}

export interface RatingSummary {
  /** Average stars, one decimal. */
  avg: number;
  count: number;
  /** Newest first. */
  latest: Review[];
}

export function summarize(reviews: Review[]): RatingSummary | null {
  if (!reviews.length) return null;
  const sum = reviews.reduce((s, r) => s + r.stars, 0);
  return { avg: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length, latest: [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5) };
}

export function bySlug(reviews: Review[]): Map<string, RatingSummary> {
  const groups = new Map<string, Review[]>();
  for (const r of reviews) groups.set(r.slug, [...(groups.get(r.slug) ?? []), r]);
  const out = new Map<string, RatingSummary>();
  for (const [slug, list] of groups) out.set(slug, summarize(list)!);
  return out;
}
