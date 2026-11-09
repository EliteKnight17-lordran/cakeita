import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Chip, Notice } from '../components/ui';
import { cleanFeedback, FEEDBACK_TYPES } from '../domain/survey';
import { flushOutbox, sendEntry } from '../cloud/feedback';
import { usePrefs, useTx } from '../lib/prefs';
import { readSurvey } from './surveyState';

/**
 * The survey link at the bottom, matched to where this phone is in the survey. It used to
 * always open the start, which showed a "thank you" or a "try it" screen to people who had
 * already answered, and looked broken.
 */
function SurveyLink() {
  const tx = useTx();
  const [s] = useState(() => readSurvey());
  if (s?.done1 && s.done2) {
    return <p className="text-sm text-ink-soft" data-survey-link="done">{tx('You already answered our pilot survey on this phone. Salamat!', 'Nasagot mo na ang pilot survey sa phone na ito. Salamat!')}</p>;
  }
  if (s?.done1) {
    return (
      <p className="text-sm text-ink-soft" data-survey-link="part2">
        {tx('Our pilot survey has 3 quick taps left. ', 'May 3 mabilis na tap pa sa pilot survey. ')}
        <Link to="/survey?step=2" className="inline-flex min-h-11 items-center text-berry underline">
          {tx('Finish it (1 min)', 'Tapusin (1 min)')}
        </Link>
      </p>
    );
  }
  return (
    <p className="text-sm text-ink-soft" data-survey-link="start">
      {tx('Have 2 minutes? ', 'May 2 minuto ka? ')}
      <Link to="/survey" className="inline-flex min-h-11 items-center text-berry underline">
        {tx('Answer our short pilot survey.', 'Sagutin ang maikling pilot survey.')}
      </Link>
    </p>
  );
}

/** Feedback and support: reachable from every page footer and the menu. */
export default function Feedback() {
  const tx = useTx();
  const { lang } = usePrefs();
  const [params] = useSearchParams();
  const from = (params.get('from') || '').slice(0, 100);
  const [type, setType] = useState<string>('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'saved'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    flushOutbox().catch(() => {});
  }, []);

  const send = async () => {
    const answers = cleanFeedback({ type, message, contact });
    if (!answers) {
      setError(!type ? tx('Pick what this is about.', 'Pumili kung tungkol saan ito.') : tx('Write a short message.', 'Magsulat ng maikling message.'));
      return;
    }
    setError('');
    setState('sending');
    const r = await sendEntry({ kind: 'feedback', part: 0, ref: '', answers, page: from || '/feedback', lang, createdAt: new Date().toISOString() });
    setState(r);
  };

  if (state === 'sent' || state === 'saved') {
    return (
      <Layout>
        <div className="mx-auto max-w-xl space-y-4" data-feedback-done>
          <p className="eyebrow">{tx('Feedback', 'Feedback')}</p>
          <h1 className="text-3xl">{tx('Salamat! We got it.', 'Salamat! Natanggap namin.')}</h1>
          {state === 'saved' && <Notice tone="info">{tx('Saved on this phone. It will be sent when you are online.', 'Naka-save sa phone na ito. Ipapadala pag may internet na.')}</Notice>}
          <p className="text-ink-soft">{contact ? tx('We will reply to the contact you left.', 'Sasagot kami sa contact na iniwan mo.') : tx('You did not leave a contact, so we cannot reply, but we read every message.', 'Walang contact na iniwan kaya hindi kami makakasagot, pero binabasa namin lahat.')}</p>
          <Link to="/" className="btn-secondary">
            {tx('Back to Cakeita', 'Bumalik sa Cakeita')}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="eyebrow">{tx('Feedback and help', 'Feedback at tulong')}</p>
          <h1 className="mt-1 text-3xl">{tx('Tell us what to fix', 'Sabihin kung ano ang aayusin')}</h1>
          <p className="mt-2 text-ink-soft">{tx('A real person on the Cakeita team reads this. Please do not include payment details.', 'Totoong tao sa Cakeita team ang nagbabasa nito. Huwag isama ang payment details.')}</p>
        </div>
        <fieldset>
          <legend className="label">{tx('What is it about?', 'Tungkol saan?')}</legend>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map((t) => (
              <Chip key={t.id} pressed={type === t.id} onClick={() => setType(t.id)}>
                {lang === 'en' ? t.en : t.tl}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="fb-msg" className="label">
            {tx('Your message', 'Message mo')}
          </label>
          <textarea id="fb-msg" className="input min-h-32" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div>
          <label htmlFor="fb-contact" className="label">
            {tx('FB name, number or email, if you want a reply (optional)', 'FB name, number o email kung gusto mo ng sagot (optional)')}
          </label>
          <input id="fb-contact" className="input" maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="off" />
        </div>
        {error && (
          <p className="font-semibold text-danger-ink" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn w-full" onClick={send} disabled={state === 'sending'} data-send-feedback>
          {state === 'sending' ? tx('Sending…', 'Ipinapadala…') : tx('Send feedback', 'Ipadala ang feedback')}
        </button>
        <SurveyLink />
      </div>
    </Layout>
  );
}
