import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { QR } from '../components/ShareBox';
import { Chip, Notice } from '../components/ui';
import { cleanAnswers, isComplete, MAX_TEXT, QUESTIONS, type Answers, type Part, type Question, type Role } from '../domain/survey';
import { flushOutbox, sendEntry } from '../cloud/feedback';
import { newId } from '../data/store';
import { usePrefs, useTx } from '../lib/prefs';
import { readSurvey, saveSurvey, surveyUrl, TRY_LINK, type SurveyState } from './surveyState';

/**
 * Pilot survey. Part 1 asks about the real problem (before trying Cakeita), then sends people
 * to try it, then part 2 asks a few questions about what they just tried.
 * Progress is remembered on this phone so people can come back after trying.
 */
export default function Survey() {
  const tx = useTx();
  const { lang } = usePrefs();
  const [params] = useSearchParams();
  const asked = params.get('role');
  const [st, setSt] = useState<SurveyState>(() => {
    const saved = readSurvey();
    const fromLink = asked === 'baker' || asked === 'customer' ? asked : null;
    if (saved && (!fromLink || saved.role === fromLink || !saved.role)) return { ...saved, role: saved.role ?? fromLink };
    return { ref: newId('sv'), role: fromLink, done1: false, done2: false };
  });
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [started2, setStarted2] = useState(() => params.get('step') === '2');

  useEffect(() => {
    flushOutbox().catch(() => {});
  }, []);
  useEffect(() => {
    saveSurvey(st);
  }, [st]);

  const part: Part | null = !st.role ? null : !st.done1 ? 1 : !st.done2 ? 2 : null;
  const qs = useMemo(() => (st.role && part ? QUESTIONS[st.role][part] : []), [st.role, part]);
  const q = part === 2 && !started2 ? undefined : qs[step];
  const L = (o: { en: string; tl: string }) => (lang === 'en' ? o.en : o.tl);

  const submit = async (final: Answers) => {
    if (!st.role || !part) return;
    setSending(true);
    const clean = cleanAnswers(st.role, part, final);
    const r = await sendEntry({ kind: st.role, part, ref: st.ref, answers: clean, page: '/survey', lang, createdAt: new Date().toISOString() });
    setSending(false);
    setSendNote(r === 'saved' ? tx('Saved on this phone. It will be sent when you are online.', 'Naka-save sa phone na ito. Ipapadala pag may internet na.') : '');
    setAnswers({});
    setStep(0);
    setSt((s) => (part === 1 ? { ...s, done1: true } : { ...s, done2: true }));
    window.scrollTo({ top: 0 });
  };

  const next = (a: Answers) => {
    if (step + 1 < qs.length) setStep(step + 1);
    else if (st.role && part && isComplete(st.role, part, a)) void submit(a);
  };
  const pickOne = (id: string) => {
    if (!q) return;
    const a = { ...answers, [q.id]: id };
    setAnswers(a);
    window.setTimeout(() => next(a), 180);
  };
  const toggleMany = (id: string) => {
    if (!q) return;
    const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
    const has = cur.includes(id);
    const max = q.max ?? 99;
    const list = has ? cur.filter((x) => x !== id) : cur.length >= max ? [...cur.slice(1), id] : [...cur, id];
    setAnswers({ ...answers, [q.id]: list });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-xl space-y-5" data-survey>
        {!st.role && (
          <>
            <p className="eyebrow">{tx('Cakeita pilot · about 2 minutes', 'Cakeita pilot · mga 2 minuto')}</p>
            <h1 className="text-3xl leading-tight">{tx('Help us fix custom cake orders', 'Tulungan kaming ayusin ang custom cake orders')}</h1>
            <p className="text-ink-soft">
              {tx(
                'A few taps about how ordering cakes works for you today, then try Cakeita and tell us what you think. No name needed.',
                'Ilang tap tungkol sa pag-order ng cake ngayon, tapos subukan ang Cakeita at sabihin kung ano ang tingin mo. Hindi kailangan ng pangalan.',
              )}
            </p>
            <h2 className="font-display text-xl font-semibold">{tx('Which one are you?', 'Alin ka dito?')}</h2>
            <div className="grid gap-3">
              <button type="button" className="card text-left hover:border-[#cdbdb0]" onClick={() => setSt((s) => ({ ...s, role: 'baker' }))} data-role="baker">
                <span className="font-display text-xl font-semibold">{tx('I bake and sell cakes', 'Nagbe-bake at nagbebenta ako ng cake')}</span>
                <span className="block text-sm text-ink-soft">{tx('Home baker or small cake shop', 'Home baker o maliit na cake shop')}</span>
              </button>
              <button type="button" className="card text-left hover:border-[#cdbdb0]" onClick={() => setSt((s) => ({ ...s, role: 'customer' }))} data-role="customer">
                <span className="font-display text-xl font-semibold">{tx('I order cakes', 'Umoorder ako ng cake')}</span>
                <span className="block text-sm text-ink-soft">{tx('Birthdays, parties, gifts', 'Birthday, party, regalo')}</span>
              </button>
            </div>
          </>
        )}

        {st.role && part && q && (
          <>
            <div className="flex items-center justify-between text-sm font-semibold text-ink-soft">
              <span>{part === 1 ? tx('Part 1 of 2 · how it is today', 'Part 1 ng 2 · paano ngayon') : tx('Part 2 of 2 · after trying', 'Part 2 ng 2 · pagkatapos subukan')}</span>
              <span>
                {step + 1}/{qs.length}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-berry-soft" role="progressbar" aria-label={tx('Survey progress', 'Progress ng survey')} aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={step + 1}>
              <div className="h-full rounded-full bg-berry transition-all" style={{ width: `${((step + 1) / qs.length) * 100}%` }} />
            </div>
            <QuestionView q={q} answers={answers} L={L} onPick={pickOne} onToggle={toggleMany} onText={(v) => setAnswers({ ...answers, [q.id]: v })} />
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn-ghost" onClick={() => (step > 0 ? setStep(step - 1) : part === 1 ? setSt((s) => ({ ...s, role: null })) : setStarted2(false))}>
                {tx('Back', 'Bumalik')}
              </button>
              {q.kind !== 'one' && (
                <button
                  type="button"
                  className="btn"
                  disabled={sending || (q.kind === 'many' && !(Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length))}
                  onClick={() => next(answers)}
                  data-next
                >
                  {sending ? tx('Sending…', 'Ipinapadala…') : step + 1 === qs.length ? tx('Send', 'Ipadala') : q.kind === 'text' && !answers[q.id] ? tx('Skip', 'Laktawan') : tx('Next', 'Susunod')}
                </button>
              )}
            </div>
          </>
        )}

        {st.role && st.done1 && !st.done2 && !started2 && <TryIt role={st.role} note={sendNote} onDone={() => { setStarted2(true); window.scrollTo({ top: 0 }); }} />}

        {st.role && st.done1 && st.done2 && (
          <div className="space-y-4" data-survey-done>
            <p className="eyebrow">{tx('All done', 'Tapos na')}</p>
            <h1 className="text-3xl leading-tight">{tx('Salamat! That really helps.', 'Salamat! Malaking tulong ito.')}</h1>
            {sendNote && <Notice tone="info">{sendNote}</Notice>}
            <p className="text-ink-soft">{tx('Know a baker or a friend who orders cakes? Let them scan this.', 'May kilala kang baker o kaibigang umoorder ng cake? Ipa-scan ito.')}</p>
            <QR value={surveyUrl()} label={tx('QR code for this survey', 'QR code ng survey na ito')} size={200} />
            <p className="break-all text-center text-sm text-ink-soft">{surveyUrl()}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/" className="btn-secondary">
                {tx('Back to Cakeita', 'Bumalik sa Cakeita')}
              </Link>
              <Link to="/feedback" className="btn-ghost">
                {tx('Send more feedback', 'Magpadala pa ng feedback')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function QuestionView({ q, answers, L, onPick, onToggle, onText }: { q: Question; answers: Answers; L: (o: { en: string; tl: string }) => string; onPick: (id: string) => void; onToggle: (id: string) => void; onText: (v: string) => void }) {
  const tx = useTx();
  const v = answers[q.id];
  const id = `q-${q.id}`;
  return (
    <fieldset className="space-y-3" key={q.id}>
      <legend className="mb-3 font-display text-2xl font-semibold leading-snug" id={`${id}-l`}>
        {L(q)}
      </legend>
      {q.kind === 'one' && (
        <div className="grid gap-2">
          {q.choices!.map((ch) => (
            <button key={ch.id} type="button" className="chip !justify-start !rounded-xl !px-4 !py-3 text-left text-base" aria-pressed={v === ch.id} onClick={() => onPick(ch.id)}>
              {L(ch)}
            </button>
          ))}
        </div>
      )}
      {q.kind === 'many' && (
        <>
          <div className="flex flex-wrap gap-2">
            {q.choices!.map((ch) => (
              <Chip key={ch.id} pressed={Array.isArray(v) && v.includes(ch.id)} onClick={() => onToggle(ch.id)}>
                {L(ch)}
              </Chip>
            ))}
          </div>
        </>
      )}
      {q.kind === 'text' && (
        <>
          <label htmlFor={id} className="sr-only">
            {L(q)}
          </label>
          <input id={id} className="input" maxLength={MAX_TEXT} value={typeof v === 'string' ? v : ''} onChange={(e) => onText(e.target.value)} placeholder={tx('Type here, or skip', 'I-type dito, o laktawan')} />
        </>
      )}
    </fieldset>
  );
}

function TryIt({ role, note, onDone }: { role: Role; note: string; onDone: () => void }) {
  const tx = useTx();
  return (
    <div className="space-y-4" data-try-it>
      <p className="eyebrow">{tx('Part 1 done · salamat!', 'Tapos ang Part 1 · salamat!')}</p>
      <h1 className="text-3xl leading-tight">{role === 'baker' ? tx('Now try it as a baker', 'Subukan mo bilang baker') : tx('Now order a sample cake', 'Subukang umorder ng sample cake')}</h1>
      {note && <Notice tone="info">{note}</Notice>}
      <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
        {role === 'baker' ? (
          <>
            <li>{tx('Open the demo and tap “Run the sample bakery”.', 'Buksan ang demo at i-tap ang “Patakbuhin ang sample bakery”.')}</li>
            <li>{tx('Open a request, look at the price breakdown, and approve a quote.', 'Buksan ang isang request, tingnan ang breakdown ng presyo, at mag-approve ng quote.')}</li>
          </>
        ) : (
          <>
            <li>{tx('Describe a cake the way you would message a baker, with your budget.', 'Ilarawan ang cake na parang nagme-message sa baker, kasama ang budget mo.')}</li>
            <li>{tx('Pick one of the 3 designs and spin it in 3D.', 'Pumili sa 3 design at paikutin sa 3D.')}</li>
          </>
        )}
        <li>{tx('Come back here for a few more taps. We will remind you at the bottom of the screen.', 'Bumalik dito para sa ilang tap pa. Ipapaalala namin sa baba ng screen.')}</li>
      </ol>
      <Link to={TRY_LINK[role]} className="btn w-full" data-try-link>
        {role === 'baker' ? tx('Try the baker side (2 min)', 'Subukan ang baker side (2 min)') : tx('Order a sample cake (2 min)', 'Umorder ng sample cake (2 min)')}
      </Link>
      <button type="button" className="btn-secondary w-full" onClick={onDone} data-part2>
        {tx('I already tried it: answer part 2', 'Nasubukan ko na: sagutin ang part 2')}
      </button>
      <details className="card">
        <summary className="cursor-pointer font-semibold">{tx('Trying on another phone or laptop? Scan this', 'Sa ibang phone o laptop susubukan? I-scan ito')}</summary>
        <div className="mt-3 space-y-2">
          <QR value={`${window.location.origin}${window.location.pathname}#${TRY_LINK[role]}`} label={tx('QR code to try Cakeita', 'QR code para subukan ang Cakeita')} size={180} />
        </div>
      </details>
    </div>
  );
}
