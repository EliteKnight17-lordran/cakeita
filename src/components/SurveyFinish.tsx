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
