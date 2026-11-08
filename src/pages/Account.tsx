import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inAppBrowser, sendEmailLink, signInWith, signOut, startAccount, useAccount } from '../cloud/account';
import { useSyncStatus } from '../cloud/CloudSync';
import { Layout } from '../components/Layout';
import { IconCheck, IconCloud, IconMail, IconUser } from '../components/icons';
import { Field, Notice } from '../components/ui';
import { useDb } from '../data/store';
import { useTx } from '../lib/prefs';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6h-4a12 12 0 000 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#fff" />
      <path fill="#1877F2" d="M24 12a12 12 0 10-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0024 12z" />
    </svg>
  );
}

export default function Account() {
  const tx = useTx();
  const account = useAccount();
  const sync = useSyncStatus();
  const db = useDb();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => startAccount(), []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg('');
    const e = await fn();
    setBusy(false);
    if (e) setMsg(e);
  };
  const sendLink = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMsg(tx('Please type your email.', 'I-type ang email mo.'));
      return;
    }
    setBusy(true);
    const e = await sendEmailLink(email.trim());
    setBusy(false);
    setMsg(e || tx(`Check ${email.trim()} and tap the link to sign in. You can close this page.`, `Tingnan ang ${email.trim()} at i-tap ang link para mag-sign in.`));
  };

  if (account.status === 'off') {
    return (
      <Layout>
        <div className="space-y-4">
          <h1 className="text-3xl">{tx('Account', 'Account')}</h1>
          <Notice tone="info" title={tx('Cloud is off on this device', 'Naka-off ang cloud sa device na ito')}>
            {tx('This phone is in offline demo mode. Everything works with Messenger links. Turn the cloud back on in the Demo tab.', 'Naka-offline demo mode ang phone na ito. Gumagana pa rin lahat gamit ang Messenger links. I-on ulit sa Demo tab.')}
          </Notice>
          <Link to="/demo" className="btn-secondary">{tx('Open Demo tab', 'Buksan ang Demo tab')}</Link>
        </div>
      </Layout>
    );
  }

  if (account.status === 'signed-in') {
    const u = account.user;
    const bakery = db.bakery && !db.bakery.isSample ? db.bakery : null;
    return (
      <Layout>
        <div className="space-y-5">
          <p className="eyebrow">{tx('Account', 'Account')}</p>
          <div className="card flex items-center gap-4">
            {u.photo ? (
              <img src={u.photo} alt="" className="h-14 w-14 rounded-full border border-line object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-berry-soft text-berry"><IconUser size={26} /></span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl">{u.name || u.email || tx('Signed in', 'Naka-sign in')}</h1>
              <p className="truncate text-sm text-ink-soft">{u.email} · {u.provider === 'password' ? 'email' : u.provider.replace('.com', '')}</p>
            </div>
          </div>

          <section className="card space-y-3" aria-labelledby="bakery-h">
            <h2 id="bakery-h" className="flex items-center gap-2 text-xl"><IconCloud className="text-berry" /> {tx('Your bakery', 'Ang bakery mo')}</h2>
            {sync.otherOwner ? (
              <Notice tone="warn">{tx('The bakery on this phone belongs to another account, so it is not synced. Sign in with that account, or start your own.', 'Ibang account ang may-ari ng bakery sa phone na ito, kaya hindi ito naka-sync.')}</Notice>
            ) : bakery ? (
              <>
                <p className="flex items-start gap-2"><IconCheck className="mt-1 shrink-0 text-ok-ink" /> {tx(`${bakery.name} is saved to your account. Open it on any phone by signing in.`, `Naka-save ang ${bakery.name} sa account mo. Buksan sa kahit anong phone sa pag-sign in.`)}</p>
                <p className="flex items-start gap-2"><IconCheck className="mt-1 shrink-0 text-ok-ink" /> {tx('Requests from your link arrive here live, and your quotes reach customers live. Messenger links still work too.', 'Live na dumarating dito ang requests, at live ring nakikita ng customer ang quote mo. Gumagana pa rin ang Messenger links.')}</p>
                <p className="text-sm text-ink-soft" aria-live="polite">
                  {sync.error ? sync.error : sync.savedAt ? `${tx('Last saved', 'Huling na-save')} ${new Date(sync.savedAt).toLocaleTimeString()}` : tx('Saving…', 'Sine-save…')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/baker" className="btn">{tx('Open my bakery', 'Buksan ang bakery ko')}</Link>
                  <Link to="/baker/share" className="btn-secondary">{tx('My link and map listing', 'Link ko at listing sa mapa')}</Link>
                </div>
              </>
            ) : (
              <>
                <p>{tx('Bake for customers? Set up your bakery and it saves to this account.', 'Nagbe-bake para sa customer? I-set up ang bakery mo at mase-save ito sa account na ito.')}</p>
                <Link to="/baker" className="btn">{tx('Set up my bakery', 'I-set up ang bakery ko')}</Link>
              </>
            )}
          </section>

          <section className="card space-y-2" aria-labelledby="cakes-h">
            <h2 id="cakes-h" className="text-xl">{tx('My cake requests', 'Mga cake request ko')}</h2>
            <p className="text-ink-soft">{tx(`${db.myRequests.length} saved. They follow you to any phone you sign in on.`, `${db.myRequests.length} naka-save. Kasama mo ito sa kahit anong phone.`)}</p>
            <Link to="/me" className="btn-ghost">{tx('See my cakes', 'Tingnan ang mga cake ko')}</Link>
          </section>

          <button type="button" className="btn-ghost" onClick={() => signOut()}>{tx('Sign out', 'Mag-sign out')}</button>
          <p className="text-sm text-ink-soft">{tx('Signing out keeps everything on this phone. We never see payments; pay your baker directly.', 'Naiiwan sa phone ang lahat kahit mag-sign out. Hindi kami humahawak ng bayad.')}</p>
        </div>
      </Layout>
    );
  }

  const loading = account.status === 'loading' || account.status === 'idle';
  const err = account.status === 'signed-out' ? account.error : '';
  return (
    <Layout>
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <p className="eyebrow">{tx('Account', 'Account')}</p>
          <h1 className="mt-1 text-3xl">{tx('Sign in to Cakeita', 'Mag-sign in sa Cakeita')}</h1>
          <p className="mt-2 text-ink-soft">
            {tx('Customers can order without an account. Sign in to keep your bakery, requests and quotes on every phone.', 'Puwedeng mag-order kahit walang account. Mag-sign in para nasa kahit anong phone ang bakery, requests at quotes mo.')}
          </p>
        </div>
        <div className="card space-y-3">
          <button type="button" className="btn-secondary w-full" disabled={busy || loading} onClick={() => run(() => signInWith('facebook'))}>
            <FacebookMark /> {tx('Continue with Facebook', 'Ituloy gamit ang Facebook')}
          </button>
          <button type="button" className="btn-secondary w-full" disabled={busy || loading} onClick={() => run(() => signInWith('google'))}>
            <GoogleMark /> {tx('Continue with Google', 'Ituloy gamit ang Google')}
          </button>
          {inAppBrowser() && (
            <p className="text-sm text-amber-ink">{tx('Opened from Messenger? Google may not work here. Use Facebook or email, or open this page in Chrome or Safari.', 'Galing sa Messenger? Baka hindi gumana ang Google dito. Gamitin ang Facebook o email, o buksan sa Chrome o Safari.')}</p>
          )}
          <div className="flex items-center gap-3 text-sm text-ink-soft" aria-hidden="true">
            <span className="h-px flex-1 bg-line" /> {tx('or', 'o')} <span className="h-px flex-1 bg-line" />
          </div>
          <Field id="acct-email" label={tx('Email', 'Email')} hint={tx('We email you a one-tap sign-in link. No password.', 'Magpapadala kami ng link para mag-sign in. Walang password.')}>
            <input id="acct-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="acct-email-hint" />
          </Field>
          <button type="button" className="btn w-full" disabled={busy || loading} onClick={sendLink}>
            <IconMail /> {tx('Email me a sign-in link', 'I-email ang sign-in link')}
          </button>
          {(msg || err) && <p className="text-sm font-semibold" aria-live="polite">{msg || err}</p>}
        </div>
        <p className="text-center text-sm text-ink-soft">
          {tx('By signing in you agree to our ', 'Sa pag-sign in, sumasang-ayon ka sa ')}
          <Link to="/about" className="underline">{tx('privacy notes', 'privacy notes')}</Link>.
        </p>
      </div>
    </Layout>
  );
}
