import type { Entry } from '../domain/survey';
import { cloudEnabled } from './config';
import { loadCloud } from './fb';

/**
 * Survey answers and feedback go to Firestore `feedback/{id}` (create only, nobody can read
 * except Cakeita admins listed in `admins/{uid}`). If the cloud is off or the phone is offline,
 * they wait in this phone's outbox and are sent the next time the survey or feedback page opens.
 */
const OUTBOX = 'cakeita.outbox.v1';

interface Pending {
  id: string;
  entry: Entry;
}

function readOutbox(): Pending[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(OUTBOX) || '[]');
    return Array.isArray(v) ? (v as Pending[]).slice(-50) : [];
  } catch {
    return [];
  }
}
function writeOutbox(list: Pending[]) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-50)));
  } catch {
    /* storage blocked: nothing else we can do */
  }
}

export function newEntryId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `fb-${rnd.slice(0, 24)}`;
}

async function put(id: string, e: Entry): Promise<void> {
  const c = await loadCloud();
  await c.m.fs.setDoc(c.m.fs.doc(c.db, 'feedback', id), {
    kind: e.kind,
    part: e.part,
    ref: e.ref.slice(0, 40),
    answers: JSON.stringify(e.answers).slice(0, 4000),
    page: e.page.slice(0, 120),
    lang: e.lang.slice(0, 4),
    createdAt: e.createdAt,
  });
}

/**
 * One id per survey person and part: a second send of the same answers (a repeat tap, or a slow
 * send that also went to the outbox) is refused by the create-only rule instead of adding a row.
 */
export function surveyEntryId(ref: string, part: number): string {
  return `fb-${ref.replace(/[^A-Za-z0-9]/g, '').slice(0, 30)}p${part}`;
}

/** 'sent' when it reached the cloud, 'saved' when it waits on this phone. */
export async function sendEntry(e: Entry, fixedId?: string): Promise<'sent' | 'saved'> {
  const id = fixedId ?? newEntryId();
  if (cloudEnabled()) {
    try {
      await Promise.race([put(id, e), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))]);
      return 'sent';
    } catch (err) {
      // Same person and part already arrived (create-only): nothing more to send.
      if (fixedId && (err as { code?: string })?.code === 'permission-denied') return 'sent';
    }
  }
  writeOutbox([...readOutbox().filter((p) => p.id !== id), { id, entry: e }]);
  return 'saved';
}

export function outboxCount(): number {
  return readOutbox().length;
}

/** Try to send what waits on this phone. Returns how many are still waiting. */
export async function flushOutbox(): Promise<number> {
  const list = readOutbox();
  if (!list.length || !cloudEnabled()) return list.length;
  const left: Pending[] = [];
  for (const p of list) {
    try {
      await put(p.id, p.entry);
    } catch (err) {
      // Already sent before (create-only rule refuses a second write): drop it. Otherwise keep.
      const code = (err as { code?: string })?.code;
      if (code !== 'permission-denied') left.push(p);
    }
  }
  writeOutbox(left);
  return left.length;
}

export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const c = await loadCloud();
    const snap = await c.m.fs.getDoc(c.m.fs.doc(c.db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/** Admins only (the rules refuse everyone else). */
export async function loadEntries(): Promise<Entry[]> {
  const c = await loadCloud();
  const { collection, getDocs, query, orderBy, limit } = c.m.fs;
  const snap = await getDocs(query(collection(c.db, 'feedback'), orderBy('createdAt', 'desc'), limit(2000)));
  const out: Entry[] = [];
  snap.forEach((d) => {
    const v = d.data();
    let answers: Entry['answers'] = {};
    try {
      const a: unknown = JSON.parse(String(v.answers ?? '{}'));
      if (a && typeof a === 'object') answers = a as Entry['answers'];
    } catch {
      /* skip bad answers */
    }
    const kind = v.kind === 'baker' || v.kind === 'customer' || v.kind === 'feedback' ? v.kind : null;
    const part = v.part === 0 || v.part === 1 || v.part === 2 ? v.part : null;
    if (kind && part !== null) out.push({ kind, part, ref: String(v.ref ?? ''), answers, page: String(v.page ?? ''), lang: String(v.lang ?? ''), createdAt: String(v.createdAt ?? '') });
  });
  return out;
}
