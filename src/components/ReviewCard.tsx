import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { startAccount, useAccount } from '../cloud/account';
import { publicName, type Review } from '../domain/reviews';
import { useTx } from '../lib/prefs';
import { IconStar } from './icons';
import { Field, Notice } from './ui';

/**
 * Rate the baker, after a confirmed order. Needs an account (Google or email link) so one
 * person gets one review per bakery; the database checks the order was quoted and confirmed.
 */
export function ReviewCard({ orderId, slug, bakeryName, customerName }: { orderId: string; slug: string; bakeryName: string; customerName: string }) {
  const tx = useTx();
  const account = useAccount();
  const uid = account.status === 'signed-in' ? account.user.uid : null;
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [mine, setMine] = useState<Review | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const name = publicName(customerName);

  // Find out if they are signed in (Firebase is already loaded for the confirmation by now).
  useEffect(() => startAccount(), []);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    import('../cloud/data')
      .then((m) => m.myReview(uid, slug))
      .then((r) => alive && r && setMine(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, slug]);

  if (account.status === 'off') return null;
  const short = bakeryName.replace(' (sample)', '');

  if (mine) {
    return (
      <div data-review-done>
        <Notice tone="ok" title={tx(`You rated ${short} ${mine.stars} of 5`, `Binigyan mo si ${short} ng ${mine.stars} sa 5`)}>
          {mine.text ? `“${mine.text}”` : tx('Thanks for rating.', 'Salamat sa rating.')}
        </Notice>
      </div>
    );
  }

  const send = async () => {
    if (!uid || !stars) return;
    setState('sending');
    try {
      const m = await import('../cloud/data');
      await m.postReview(uid, { orderId, slug, stars, text, name });
      setMine({ slug, stars, text: text.trim(), name, createdAt: new Date().toISOString() });
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <section className="card space-y-3" aria-labelledby="rate-h" data-review-card>
      <h2 id="rate-h" className="font-display text-xl font-semibold">{tx(`Got your cake? Rate ${short}`, `Natanggap mo na? I-rate si ${short}`)}</h2>
      {!uid ? (
        <p>
          {tx('Only customers with a confirmed order can rate, one review per bakery. ', 'Ang may confirmed na order lang ang puwedeng mag-rate, isa bawat bakery. ')}
          <Link to="/account" className="font-semibold text-berry underline">{tx('Sign in to rate', 'Mag-sign in para mag-rate')}</Link>
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label={tx('Stars', 'Bituin')} className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={tx(`${n} of 5 stars`, `${n} sa 5 bituin`)} className={`flex h-11 w-11 items-center justify-center rounded-full ${n <= stars ? 'text-berry' : 'text-ink-soft'}`} onClick={() => setStars(n)} data-star={n}>
                <IconStar size={28} filled={n <= stars} />
              </button>
            ))}
          </div>
          <Field id="review-text" label={tx('A few words (optional)', 'Ilang salita (optional)')}>
            <textarea id="review-text" className="input min-h-20" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder={tx('e.g. On time, and it looked like the 3D cake', 'hal. Sakto sa oras, at kamukha ng 3D cake')} />
          </Field>
          <p className="text-sm text-ink-soft">{tx(`Shown as “${name}”, with a “confirmed order” label.`, `Lalabas bilang “${name}”, may “confirmed order” na label.`)}</p>
          {state === 'error' && (
            <Notice tone="warn">{tx('Could not post it. The baker needs your confirmation in Cakeita first, and each person can rate a bakery once. Try again in a minute.', 'Hindi na-post. Kailangan munang matanggap ng baker ang confirmation mo sa Cakeita, at isang beses lang puwedeng mag-rate bawat bakery. Subukan ulit mamaya.')}</Notice>
          )}
          <button type="button" className="btn w-full" disabled={!stars || state === 'sending'} onClick={send} data-review-send>
            {state === 'sending' ? tx('Posting…', 'Pino-post…') : tx('Post my rating', 'I-post ang rating ko')}
          </button>
        </>
      )}
    </section>
  );
}

/** "4.8 (5)" with a star, for a bakery that has real reviews. */
export function RatingLine({ avg, count }: { avg: number; count: number }) {
  const tx = useTx();
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink" data-rating>
      <IconStar size={15} filled className="text-berry" />
      {avg.toFixed(1)}
      <span className="font-normal text-ink-soft">({count} {count === 1 ? tx('review', 'review') : tx('reviews', 'reviews')})</span>
    </span>
  );
}
