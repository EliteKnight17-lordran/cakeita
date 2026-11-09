import { describe, expect, it } from 'vitest';
import { cleanAnswers, cleanFeedback, dedupeEntries, isComplete, QUESTIONS, tally, toCsv, type Entry } from './survey';

const entry = (over: Partial<Entry>): Entry => ({ kind: 'baker', part: 1, ref: 'r1', answers: {}, page: '/survey', lang: 'tl', createdAt: '2026-11-09T01:00:00Z', ...over });

describe('survey', () => {
  it('stays short for busy people', () => {
    for (const role of ['baker', 'customer'] as const) {
      for (const part of [1, 2] as const) {
        const qs = QUESTIONS[role][part];
        expect(qs.filter((q) => !q.optional).length).toBeLessThanOrEqual(5);
        for (const q of qs) expect(q.en.length).toBeLessThan(110);
      }
    }
  });

  it('keeps only known questions and choices', () => {
    const a = cleanAnswers('baker', 1, { inquiries: '3-5', quoteTime: 'forever', hack: 'x', hardest: '  pricing  ', method: ['gut'] });
    expect(a).toEqual({ inquiries: '3-5', hardest: 'pricing' });
  });

  it('caps multi-pick answers and drops duplicates', () => {
    const a = cleanAnswers('customer', 1, { pain: ['wait', 'wait', 'budget', 'looks', 'nope'] });
    expect(a.pain).toEqual(['wait', 'budget']);
  });

  it('knows when a part is complete (optional text can be skipped)', () => {
    const full = { inquiries: '0-2', quoteTime: '<5', ghosted: 'unsure', method: 'gut', lugi: 'no' };
    expect(isComplete('baker', 1, full)).toBe(true);
    expect(isComplete('baker', 1, { ...full, lugi: undefined } as never)).toBe(false);
    expect(isComplete('customer', 1, { count: '1', where: [], pain: ['wait'], wait: 'day', gaveUp: 'yes' })).toBe(false);
  });

  it('tallies answers per question and ignores other roles and parts', () => {
    const t = tally('customer', 1, [
      entry({ kind: 'customer', answers: { pain: ['wait', 'budget'], gaveUp: 'yes' } }),
      entry({ kind: 'customer', answers: { pain: ['wait'], gaveUp: 'no' } }),
      entry({ kind: 'baker', answers: { pain: ['wait'] } }),
      entry({ kind: 'customer', part: 2, answers: { use: 'yes' } }),
    ]);
    const pain = t.find((x) => x.question.id === 'pain')!;
    expect(pain.total).toBe(2);
    expect(pain.counts.find((x) => x.choice.id === 'wait')!.n).toBe(2);
    expect(t.find((x) => x.question.id === 'gaveUp')!.counts.map((x) => x.n)).toEqual([1, 1]);
  });

  it('writes CSV that spreadsheets cannot run as formulas', () => {
    const csv = toCsv([entry({ answers: { hardest: '=HYPERLINK("x")', inquiries: '3-5' } })]);
    const [head, row] = csv.split('\n');
    expect(head).toContain('"inquiries"');
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('cleans general feedback', () => {
    expect(cleanFeedback({ type: 'bug', message: '  map is blank ', contact: '' })).toEqual({ type: 'bug', message: 'map is blank' });
    expect(cleanFeedback({ type: 'bug', message: '   ' })).toBeNull();
    expect(cleanFeedback({ type: 'hack', message: 'x' })).toBeNull();
  });
});

describe('dedupeEntries', () => {
  const e = (ref: string, part: 1 | 2, at: string, gaveUp = 'yes', kind: 'customer' | 'feedback' = 'customer') => ({ kind, part: kind === 'feedback' ? (0 as const) : part, ref, answers: { gaveUp }, page: '/survey', lang: 'tl', createdAt: at });
  it('keeps one answer set per person and part, the newest', () => {
    const out = dedupeEntries([e('a', 1, '1', 'yes'), e('a', 1, '3', 'no'), e('a', 1, '2', 'yes'), e('a', 2, '4'), e('b', 1, '5')]);
    expect(out).toHaveLength(3);
    expect(out.find((x) => x.ref === 'a' && x.part === 1)?.answers.gaveUp).toBe('no');
  });
  it('never merges general feedback', () => {
    expect(dedupeEntries([e('', 1, '1', 'x', 'feedback'), e('', 1, '2', 'y', 'feedback')])).toHaveLength(2);
  });
});
