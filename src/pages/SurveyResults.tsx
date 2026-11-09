import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { QR } from '../components/ShareBox';
import { Notice } from '../components/ui';
import { startAccount, useAccount } from '../cloud/account';
import { isAdmin, loadEntries } from '../cloud/feedback';
import { dedupeEntries, FEEDBACK_TYPES, tally, toCsv, type Entry, type Part, type Role } from '../domain/survey';
import { useTx } from '../lib/prefs';
import { surveyUrl } from './surveyState';

/** Cakeita team only: survey results, feedback, CSV export, and booth QR codes. */
export default function SurveyResults() {
  const tx = useTx();
  const account = useAccount();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [dupes, setDupes] = useState(0);
  const [error, setError] = useState('');
  const uid = account.status === 'signed-in' ? account.user.uid : null;

  useEffect(() => startAccount(), []);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    isAdmin(uid).then((ok) => {
      if (!alive) return;
      setAdmin(ok);
      if (ok)
        loadEntries()
          .then((all) => {
            if (!alive) return;
            // Repeat taps saved the same person's answers more than once; count each person once.
            const one = dedupeEntries(all);
            setDupes(all.length - one.length);
            setEntries(one);
          })
          .catch((e: unknown) => alive && setError(String((e as Error)?.message || e)));
    });
    return () => {
      alive = false;
    };
  }, [uid]);

  const download = () => {
    if (!entries) return;
    const blob = new Blob(['﻿' + toCsv(entries)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cakeita-survey-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <p className="eyebrow">{tx('Cakeita team', 'Cakeita team')}</p>
          <h1 className="mt-1 text-3xl">{tx('Survey results', 'Resulta ng survey')}</h1>
        </div>

        <section className="card space-y-3" aria-labelledby="qr-h">
          <h2 id="qr-h" className="text-xl">{tx('Booth QR codes', 'QR codes para sa booth')}</h2>
          <p className="text-sm text-ink-soft">{tx('Print or show these. Each one opens the survey for that group.', 'I-print o ipakita. Bawat isa ay bubukas sa survey para sa grupong iyon.')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['baker', 'customer'] as const).map((r) => (
              <div key={r} className="space-y-2 text-center">
                <p className="font-semibold">{r === 'baker' ? tx('For bakers', 'Para sa baker') : tx('For customers', 'Para sa customer')}</p>
                <QR value={surveyUrl(r)} label={`QR: ${surveyUrl(r)}`} size={170} />
                <p className="break-all text-xs text-ink-soft">{surveyUrl(r)}</p>
              </div>
            ))}
          </div>
        </section>

        {account.status === 'off' && <Notice tone="info">{tx('Cloud is off on this device (Demo tab). Turn it on to see results.', 'Naka-off ang cloud sa device na ito.')}</Notice>}
        {(account.status === 'signed-out' || account.status === 'idle') && (
          <Notice tone="info">
            {tx('Sign in with the Cakeita team account to see answers.', 'Mag-sign in gamit ang team account para makita ang sagot.')}{' '}
            <Link to="/account" className="underline">
              {tx('Sign in', 'Mag-sign in')}
            </Link>
          </Notice>
        )}
        {uid && admin === false && (
          <Notice tone="warn" title={tx('This account is not on the team list yet', 'Wala pa sa team list ang account na ito')}>
            <p>{tx('In the Firebase console, open Firestore, start a collection named “admins”, and add a document whose ID is:', 'Sa Firebase console, buksan ang Firestore, gumawa ng collection na “admins”, at magdagdag ng document na ang ID ay:')}</p>
            <p className="my-2 select-all break-all rounded-lg bg-white p-2 font-mono text-sm" data-uid>
              {uid}
            </p>
            <p>{tx('Give it one field: ok = true. Then reload this page.', 'Lagyan ng isang field: ok = true. Tapos i-reload ang page.')}</p>
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        {admin && !entries && !error && <p className="text-ink-soft">{tx('Loading…', 'Naglo-load…')}</p>}
        {entries && dupes > 0 && <p className="text-sm text-ink-soft" data-dupes>{tx(`${dupes} repeated sends from the same phone are counted once.`, `${dupes} na paulit-ulit na padala mula sa iisang phone ang binilang nang isa lang.`)}</p>}
        {entries && <Results entries={entries} onCsv={download} />}
      </div>
    </Layout>
  );
}

function Results({ entries, onCsv }: { entries: Entry[]; onCsv: () => void }) {
  const tx = useTx();
  const people = (role: Role, part: Part) => entries.filter((e) => e.kind === role && e.part === part).length;
  const fb = entries.filter((e) => e.kind === 'feedback');
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [tx('Bakers, part 1', 'Bakers, part 1'), people('baker', 1)],
          [tx('Bakers, part 2', 'Bakers, part 2'), people('baker', 2)],
          [tx('Customers, part 1', 'Customers, part 1'), people('customer', 1)],
          [tx('Customers, part 2', 'Customers, part 2'), people('customer', 2)],
        ].map(([l, n]) => (
          <div key={String(l)} className="card">
            <p className="text-sm font-semibold text-ink-soft">{l}</p>
            <p className="font-display text-3xl font-semibold">{n}</p>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary" onClick={onCsv}>
        {tx('Download all answers (CSV)', 'I-download lahat ng sagot (CSV)')}
      </button>
      {(['baker', 'customer'] as const).map((role) =>
        ([1, 2] as const).map((part) => (
          <section key={`${role}${part}`} className="card space-y-4" aria-label={`${role} part ${part}`}>
            <h2 className="text-xl">
              {role === 'baker' ? 'Bakers' : 'Customers'} · {part === 1 ? tx('the problem today', 'ang problema ngayon') : tx('after trying Cakeita', 'pagkatapos subukan')} ({people(role, part)})
            </h2>
            {tally(role, part, entries).map((t) => (
              <div key={t.question.id} className="space-y-1">
                <p className="font-semibold">{t.question.en}</p>
                {t.counts.map((row) => (
                  <div key={row.choice.id} className="flex items-center gap-2 text-sm">
                    <span className="w-40 shrink-0 sm:w-56">{row.choice.en}</span>
                    <span className="h-3 rounded-full bg-berry" style={{ width: `${t.total ? Math.max(2, (row.n / t.total) * 100) * 0.5 : 0}%` }} aria-hidden="true" />
                    <span>
                      {row.n}
                      {t.total ? ` (${Math.round((row.n / t.total) * 100)}%)` : ''}
                    </span>
                  </div>
                ))}
                {t.texts.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                    {t.texts.slice(0, 50).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )),
      )}
      <section className="card space-y-2" aria-labelledby="fb-h">
        <h2 id="fb-h" className="text-xl">
          {tx('Feedback', 'Feedback')} ({fb.length})
        </h2>
        <ul className="space-y-2 text-sm">
          {fb.slice(0, 200).map((e, i) => (
            <li key={i} className="rounded-lg border border-line p-2">
              <span className="font-semibold">{FEEDBACK_TYPES.find((t) => t.id === e.answers.type)?.en ?? 'Feedback'}</span> · {e.createdAt.slice(0, 16).replace('T', ' ')} · {e.page}
              <p>{String(e.answers.message ?? '')}</p>
              {e.answers.contact && <p className="text-ink-soft">{tx('Contact', 'Contact')}: {String(e.answers.contact)}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
