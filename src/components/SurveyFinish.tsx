import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTx } from '../lib/prefs';
import { readSurvey } from '../pages/surveyState';

/** True while this phone finished survey part 1 but not part 2. */
export function useSurveyPending(): boolean {
  const loc = useLocation();
  const [s, setS] = useState(() => readSurvey());
  useEffect(() => {
    const on = () => setS(readSurvey());
    window.addEventListener('cakeita-survey', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('cakeita-survey', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  useEffect(() => setS(readSurvey()), [loc.pathname]);
  return !!s && s.done1 && !s.done2 && !loc.pathname.startsWith('/survey');
}

/** A thin bar under the header (it stays on screen while scrolling) until part 2 is done. */
export function SurveyStrip() {
  const tx = useTx();
  if (!useSurveyPending()) return null;
  return (
    <div className="no-print border-t border-berry-dark bg-berry text-white" data-survey-nudge>
      <Link to="/survey?step=2" className="mx-auto flex min-h-11 max-w-3xl items-center justify-between gap-3 px-4 text-sm font-semibold">
        <span>{tx('Survey: 1 more minute after trying', 'Survey: 1 minuto pa pagkatapos subukan')}</span>
        <span className="shrink-0 underline underline-offset-4">{tx('Finish', 'Tapusin')} →</span>
      </Link>
    </div>
  );
}

/** Shown at the natural end of trying (a quote arrived, a request was sent, a quote approved). */
export function SurveyFinishCard() {
  const tx = useTx();
  if (!useSurveyPending()) return null;
  return (
    <div className="rounded-2xl border-2 border-berry bg-berry-soft p-4" data-survey-finish>
      <p className="eyebrow">{tx('Thanks for trying', 'Salamat sa pagsubok')}</p>
      <p className="mt-1 font-display text-xl font-semibold">{tx('One last step: a few quick taps about what you just tried', 'Huling hakbang: ilang mabilis na tap tungkol sa sinubukan mo')}</p>
      <Link to="/survey?step=2" className="btn mt-3 w-full">
        {tx('Finish the survey (1 min)', 'Tapusin ang survey (1 min)')}
      </Link>
    </div>
  );
}

const TRY_START = 'cakeita.survey.tryStart';
const PROMPTED = 'cakeita.survey.prompted';
/** How long someone tries the app before we ask for part 2 (tests can shorten it). */
function promptDelay(): number {
  try {
    const n = Number(localStorage.getItem('cakeita.survey.promptMs'));
    return n > 0 ? n : 90_000;
  } catch {
    return 90_000;
  }
}
const session = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
};

/** True while the person is typing in a box (the pop-up must not cover what they type). */
function typing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/**
 * After about 90 seconds of trying the app, ask once (per visit) for the last survey taps.
 * Never while they are typing, and never on the feedback page (it popped up over people
 * writing feedback, which felt glitchy).
 */
export function SurveyTimedPrompt() {
  const tx = useTx();
  const pending = useSurveyPending();
  const calm = useLocation().pathname.startsWith('/feedback');
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!pending || calm || session.get(PROMPTED)) return;
    let start = Number(session.get(TRY_START) || 0);
    if (!start) {
      start = Date.now();
      session.set(TRY_START, String(start));
    }
    let wait: number | undefined;
    const fire = () => {
      if (typing()) return false;
      session.set(PROMPTED, '1');
      setShow(true);
      return true;
    };
    const t = window.setTimeout(() => {
      if (!fire()) wait = window.setInterval(() => fire() && window.clearInterval(wait), 2000);
    }, Math.max(0, promptDelay() - (Date.now() - start)));
    return () => {
      window.clearTimeout(t);
      window.clearInterval(wait);
    };
  }, [pending, calm]);
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShow(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);
  if (!show || !pending || calm) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center" data-survey-prompt>
      <div role="dialog" aria-modal="true" aria-labelledby="survey-prompt-title" className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-xl">
        <p className="eyebrow">{tx('Survey', 'Survey')}</p>
        <h2 id="survey-prompt-title" className="text-xl leading-snug">
          {tx('Done trying? 3 quick taps to finish', 'Tapos na? 3 mabilis na tap para matapos')}
        </h2>
        <Link to="/survey?step=2" className="btn w-full" autoFocus onClick={() => setShow(false)}>
          {tx('Answer now (1 min)', 'Sagutin na (1 min)')}
        </Link>
        <button type="button" className="btn-ghost w-full" onClick={() => setShow(false)}>
          {tx('Later', 'Mamaya')}
        </button>
      </div>
    </div>
  );
}
