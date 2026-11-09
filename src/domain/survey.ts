/**
 * The pilot survey: short, tap-only questions about the real problem (before trying Cakeita),
 * then a few questions after trying it. Pure data + helpers, no React or I/O.
 * Kept short on purpose: busy bakers and customers answer in about a minute per part.
 */
export type Role = 'baker' | 'customer';
export type Part = 1 | 2;

export interface Choice {
  id: string;
  en: string;
  tl: string;
}
export interface Question {
  id: string;
  en: string;
  tl: string;
  /** one = tap one answer and move on; many = pick up to `max`; text = optional one line. */
  kind: 'one' | 'many' | 'text';
  max?: number;
  choices?: Choice[];
  optional?: boolean;
}

const c = (id: string, en: string, tl: string): Choice => ({ id, en, tl });

export const QUESTIONS: Record<Role, Record<Part, Question[]>> = {
  baker: {
    1: [
      {
        id: 'inquiries',
        en: 'In a busy week, how many “how much po?” messages do you get for custom cakes?',
        tl: 'Sa busy na linggo, ilang “hm po?” na message ang natatanggap mo para sa custom cake?',
        kind: 'one',
        choices: [c('0-2', '0 to 2', '0 hanggang 2'), c('3-5', '3 to 5', '3 hanggang 5'), c('6-10', '6 to 10', '6 hanggang 10'), c('11+', '11 or more', '11 pataas')],
      },
      {
        id: 'quoteTime',
        en: 'How long does it take you to reply with a price for one custom cake?',
        tl: 'Gaano katagal bago ka makapagbigay ng presyo para sa isang custom cake?',
        kind: 'one',
        choices: [c('<5', 'Under 5 minutes', 'Wala pang 5 minuto'), c('5-15', '5 to 15 minutes', '5 hanggang 15 minuto'), c('15-60', '15 to 60 minutes', '15 hanggang 60 minuto'), c('hours', 'Hours, or the next day', 'Ilang oras, o kinabukasan')],
      },
      {
        id: 'ghosted',
        en: 'Out of 10 people you send a price to, how many go quiet?',
        tl: 'Sa 10 taong binigyan mo ng presyo, ilan ang hindi na nagre-reply?',
        kind: 'one',
        choices: [c('0-2', '0 to 2', '0 hanggang 2'), c('3-5', '3 to 5', '3 hanggang 5'), c('6+', '6 or more', '6 pataas'), c('unsure', 'Not sure', 'Hindi sigurado')],
      },
      {
        id: 'method',
        en: 'How do you usually set the price?',
        tl: 'Paano mo kadalasang sine-set ang presyo?',
        kind: 'one',
        choices: [c('gut', 'Gut feel or what others charge', 'Tantya o gaya sa iba'), c('list', 'A fixed price list', 'May fixed na price list'), c('costs', 'I list my costs (notebook or sheet)', 'Inililista ko ang gastos (notebook o sheet)'), c('app', 'An app', 'May app')],
      },
      {
        id: 'lugi',
        en: 'In the last 3 months, did a cake earn you almost nothing, or a loss?',
        tl: 'Sa nakaraang 3 buwan, may cake ka bang halos walang kinita, o lugi?',
        kind: 'one',
        choices: [c('often', 'Yes, more than twice', 'Oo, higit dalawang beses'), c('once', 'Once or twice', 'Isa o dalawang beses'), c('no', 'No', 'Wala'), c('unsure', 'I don’t compute it', 'Hindi ko kinukwenta')],
      },
      {
        id: 'hardest',
        en: 'Hardest part of custom orders? (optional)',
        tl: 'Pinakamahirap sa custom orders? (optional)',
        kind: 'text',
        optional: true,
      },
    ],
    2: [
      {
        id: 'saves',
        en: 'Would Cakeita save you time on quotes?',
        tl: 'Makakatipid ba ng oras sa pag-quote ang Cakeita?',
        kind: 'one',
        choices: [c('lot', 'Yes, a lot', 'Oo, malaki'), c('bit', 'A little', 'Kaunti'), c('no', 'No', 'Hindi')],
      },
      {
        id: 'use',
        en: 'Would you use it for your real orders?',
        tl: 'Gagamitin mo ba ito sa totoong orders mo?',
        kind: 'one',
        choices: [c('yes', 'Yes', 'Oo'), c('maybe', 'Maybe', 'Siguro'), c('no', 'No', 'Hindi')],
      },
      {
        id: 'pay',
        en: 'If it keeps working for you, which would you pick?',
        tl: 'Kung tuloy-tuloy itong makakatulong, alin ang pipiliin mo?',
        kind: 'one',
        choices: [
          c('free', 'Free only, or I stop using it', 'Libre lang, o hindi ko na gagamitin'),
          c('monthly', 'Small monthly fee (around ₱99)', 'Maliit na buwanang bayad (mga ₱99)'),
          c('once', 'One-time payment', 'Isang bayad lang'),
          c('percent', 'A small % only when a cake is confirmed', 'Maliit na % kapag may confirmed na cake'),
        ],
      },
      {
        id: 'missing',
        en: 'What is missing or confusing? (optional)',
        tl: 'Ano ang kulang o nakakalito? (optional)',
        kind: 'text',
        optional: true,
      },
      {
        id: 'contact',
        en: 'Can we message you for a 1-week trial? Leave your FB name or number (optional)',
        tl: 'Pwede ka ba naming i-message para sa 1-week trial? FB name o number (optional)',
        kind: 'text',
        optional: true,
      },
    ],
  },
  customer: {
    1: [
      {
        id: 'count',
        en: 'How many custom or personalized cakes did you order in the last 12 months?',
        tl: 'Ilang custom o personalized na cake ang inorder mo sa nakaraang 12 buwan?',
        kind: 'one',
        choices: [c('0', 'None', 'Wala'), c('1', '1', '1'), c('2-3', '2 to 3', '2 hanggang 3'), c('4+', '4 or more', '4 pataas')],
      },
      {
        id: 'where',
        en: 'Where do you order them? (pick up to 2)',
        tl: 'Saan ka umoorder? (pumili ng hanggang 2)',
        kind: 'many',
        max: 2,
        choices: [c('homebaker', 'Home baker on Facebook or IG', 'Home baker sa Facebook o IG'), c('shop', 'Bakeshop or mall', 'Bakeshop o mall'), c('delivery', 'Food delivery app', 'Food delivery app'), c('family', 'Family or friend who bakes', 'Kamag-anak o kaibigan na nagbe-bake')],
      },
      {
        id: 'pain',
        en: 'What annoyed you most? (pick up to 2)',
        tl: 'Ano ang pinaka-nakakainis? (pumili ng hanggang 2)',
        kind: 'many',
        max: 2,
        choices: [
          c('wait', 'Waiting for the price', 'Matagal maghintay ng presyo'),
          c('budget', 'Price way over my budget', 'Sobrang lampas sa budget ko'),
          c('explain', 'Hard to explain the design', 'Mahirap ipaliwanag ang design'),
          c('looks', 'The cake looked different', 'Iba ang itsura ng cake'),
          c('noreply', 'The baker never replied', 'Hindi na nag-reply ang baker'),
          c('none', 'Nothing, it was fine', 'Wala, okay naman'),
        ],
      },
      {
        id: 'wait',
        en: 'How long did you wait for a price?',
        tl: 'Gaano katagal ka naghintay ng presyo?',
        kind: 'one',
        choices: [c('minutes', 'Minutes', 'Ilang minuto'), c('hour', 'Within an hour', 'Sa loob ng isang oras'), c('day', 'Same day', 'Sa parehong araw'), c('days', 'The next day or longer', 'Kinabukasan o mas matagal')],
      },
      {
        id: 'gaveUp',
        en: 'Have you ever given up on a baker because of a slow reply or the price?',
        tl: 'Nag-give up ka na ba sa isang baker dahil sa bagal ng reply o sa presyo?',
        kind: 'one',
        choices: [c('yes', 'Yes', 'Oo'), c('no', 'No', 'Hindi')],
      },
    ],
    2: [
      {
        id: 'see3d',
        en: 'Did seeing the cake in 3D before ordering help?',
        tl: 'Nakatulong ba na makita ang cake sa 3D bago umorder?',
        kind: 'one',
        choices: [c('lot', 'Yes, a lot', 'Oo, malaki'), c('bit', 'A little', 'Kaunti'), c('no', 'No', 'Hindi')],
      },
      {
        id: 'budgetFirst',
        en: 'Was it useful that every design fit your budget?',
        tl: 'Nakatulong ba na pasok sa budget mo ang bawat design?',
        kind: 'one',
        choices: [c('lot', 'Yes, a lot', 'Oo, malaki'), c('bit', 'A little', 'Kaunti'), c('no', 'No', 'Hindi')],
      },
      {
        id: 'use',
        en: 'Would you order your next cake this way?',
        tl: 'Ganito ka na ba oorder ng susunod mong cake?',
        kind: 'one',
        choices: [c('yes', 'Yes', 'Oo'), c('maybe', 'Maybe', 'Siguro'), c('no', 'No', 'Hindi')],
      },
      {
        id: 'missing',
        en: 'What is missing or confusing? (optional)',
        tl: 'Ano ang kulang o nakakalito? (optional)',
        kind: 'text',
        optional: true,
      },
    ],
  },
};

export type Answers = Record<string, string | string[]>;

export const MAX_TEXT = 300;

/** Keep only known questions and known choices, trim text. Never trusts what comes in. */
export function cleanAnswers(role: Role, part: Part, raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const q of QUESTIONS[role][part]) {
    const v = r[q.id];
    if (q.kind === 'text') {
      if (typeof v === 'string' && v.trim()) out[q.id] = v.trim().slice(0, MAX_TEXT);
    } else if (q.kind === 'one') {
      if (typeof v === 'string' && q.choices?.some((ch) => ch.id === v)) out[q.id] = v;
    } else {
      const ids = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!q.choices?.some((ch) => ch.id === x)) : [];
      const uniq = [...new Set(ids)].slice(0, q.max ?? 99);
      if (uniq.length) out[q.id] = uniq;
    }
  }
  return out;
}

/** Every required question answered? */
export function isComplete(role: Role, part: Part, a: Answers): boolean {
  return QUESTIONS[role][part].every((q) => q.optional || (a[q.id] !== undefined && (!Array.isArray(a[q.id]) || (a[q.id] as string[]).length > 0)));
}

/** One stored response (survey part or general feedback). */
export interface Entry {
  kind: Role | 'feedback';
  part: 0 | 1 | 2;
  /** Links part 1 and part 2 of the same person, without knowing who they are. */
  ref: string;
  answers: Answers;
  page: string;
  lang: string;
  createdAt: string;
}

/**
 * One answer set per person and part: keeps the newest when the same phone sent the same part
 * more than once (repeat taps before v1.20). General feedback is kept as is.
 */
export function dedupeEntries(entries: Entry[]): Entry[] {
  const latest = new Map<string, Entry>();
  const other: Entry[] = [];
  for (const e of entries) {
    if (e.kind === 'feedback' || !e.ref) {
      other.push(e);
      continue;
    }
    const k = `${e.kind}|${e.part}|${e.ref}`;
    const cur = latest.get(k);
    if (!cur || e.createdAt >= cur.createdAt) latest.set(k, e);
  }
  return [...latest.values(), ...other];
}

export interface Tally {
  question: Question;
  total: number;
  counts: Array<{ choice: Choice; n: number }>;
  texts: string[];
}

/** Count answers per question for the results page. */
export function tally(role: Role, part: Part, entries: Entry[]): Tally[] {
  const mine = entries.filter((e) => e.kind === role && e.part === part);
  return QUESTIONS[role][part].map((q) => {
    const counts = (q.choices ?? []).map((choice) => ({ choice, n: 0 }));
    const texts: string[] = [];
    let total = 0;
    for (const e of mine) {
      const a = cleanAnswers(role, part, e.answers)[q.id];
      if (a === undefined) continue;
      total += 1;
      if (q.kind === 'text') texts.push(String(a));
      else for (const id of Array.isArray(a) ? a : [a]) {
        const row = counts.find((x) => x.choice.id === id);
        if (row) row.n += 1;
      }
    }
    return { question: q, total, counts, texts };
  });
}

function csvCell(v: string): string {
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** All entries as CSV (one row per entry, one column per question). */
export function toCsv(entries: Entry[]): string {
  const cols: Array<{ key: string; get: (e: Entry) => string }> = [
    { key: 'createdAt', get: (e) => e.createdAt },
    { key: 'kind', get: (e) => e.kind },
    { key: 'part', get: (e) => String(e.part) },
    { key: 'ref', get: (e) => e.ref },
    { key: 'page', get: (e) => e.page },
  ];
  const ids = new Set<string>();
  for (const role of ['baker', 'customer'] as const) for (const part of [1, 2] as const) for (const q of QUESTIONS[role][part]) ids.add(q.id);
  for (const k of ['type', 'message', 'contact']) ids.add(k);
  for (const id of ids) cols.push({ key: id, get: (e) => { const v = e.answers[id]; return v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v); } });
  const rows = [cols.map((c2) => csvCell(c2.key)).join(',')];
  for (const e of [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) rows.push(cols.map((c2) => csvCell(c2.get(e))).join(','));
  return rows.join('\n');
}

/** General feedback (any page). */
export const FEEDBACK_TYPES: Choice[] = [c('bug', 'Something is broken', 'May sira'), c('idea', 'An idea', 'May idea ako'), c('praise', 'I like something', 'May nagustuhan ako'), c('help', 'I need help', 'Kailangan ko ng tulong')];

export function cleanFeedback(raw: unknown): Answers | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = typeof r.type === 'string' && FEEDBACK_TYPES.some((t) => t.id === r.type) ? r.type : null;
  const message = typeof r.message === 'string' ? r.message.trim().slice(0, 1000) : '';
  const contact = typeof r.contact === 'string' ? r.contact.trim().slice(0, 120) : '';
  if (!type || !message) return null;
  return contact ? { type, message, contact } : { type, message };
}
