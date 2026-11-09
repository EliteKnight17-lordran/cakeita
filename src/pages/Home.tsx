import { Link } from 'react-router-dom';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { HeroSprinkles } from '../components/Decor';
import { IconArrow, IconCheck, IconPin } from '../components/icons';
import { Layout } from '../components/Layout';
import { toPublicMenu } from '../domain/pricing';
import { createSampleBakery } from '../domain/starterMenus';
import { toVisual } from '../domain/visual';
import { useDb } from '../data/store';
import { useInstall } from '../lib/install';
import { usePrefs, useTx } from '../lib/prefs';

const HERO_MENU = toPublicMenu(createSampleBakery());
const HERO = toVisual(HERO_MENU, { baseCakeId: 't2-6-8', componentIds: ['fl-ube', 'cv-buttercream', 'dc-drip', 'dc-flowers', 'tp-text'] }, { colors: ['#f5ddd6', '#8c2246'], textOnCake: 'Kita sa bawat hiwa', candles: 0 });

export default function Home() {
  const tx = useTx();
  const prefs = usePrefs();
  const db = useDb();
  const install = useInstall();
  return (
    <Layout>
      <div className="space-y-12">
        <section className="space-y-5 pt-2 text-center">
          <p className="eyebrow">Kita sa bawat hiwa</p>
          <h1 className="mx-auto max-w-2xl text-[2.35rem] leading-[1.08] sm:text-5xl">
            {tx('Custom cake quotes that fit the budget and still pay the baker', 'Custom cake quotes na pasok sa budget, at kumikita pa rin ang baker')}
          </h1>
          <p className="mx-auto max-w-xl text-[1.05rem] text-ink-soft">
            {tx('See your cake in 3D within your budget. The baker approves every price.', 'Makita ang cake mo sa 3D, pasok sa budget. Ang baker ang nag-a-approve ng presyo.')}
          </p>
          <div className="mx-auto flex max-w-md flex-col gap-2.5 pt-1 sm:max-w-none sm:flex-row sm:justify-center">
            <Link to="/b/sample" className="btn min-h-14 px-7 text-[1.05rem]" data-home-design>
              {tx('Design my cake', 'I-design ang cake ko')} <IconArrow />
            </Link>
            <Link to="/near" className="btn-secondary min-h-14 px-6 text-[1.05rem]">
              <IconPin /> {tx('Bakers near me', 'Mga baker na malapit')}
            </Link>
          </div>
          {install && (
            <button type="button" className="btn-ghost mx-auto" onClick={install}>
              {tx('Install Cakeita on this phone', 'I-install ang Cakeita sa phone')}
            </button>
          )}
          <p className="flex flex-wrap items-center justify-center gap-x-5 text-sm">
            <Link to="/baker" className="link inline-flex min-h-11 items-center">
              {db.bakery ? tx('Open my bakery', 'Buksan ang bakery ko') : tx('I’m a baker', 'Baker ako')}
            </Link>
            <Link to="/demo" className="link inline-flex min-h-11 items-center">
              {tx('Guided demo', 'Guided demo')}
            </Link>
            <Link to="/survey" className="link inline-flex min-h-11 items-center" data-home-survey>
              {tx('2-min survey', '2-minutong survey')}
            </Link>
          </p>
        </section>

        <div className="rise relative" style={{ ['--d' as string]: '120ms' }}>
          <HeroSprinkles />
          <CakeView visual={HERO} description={describeCake(HERO, prefs.lang)} showTools={false} />
        </div>

        <section className="space-y-5" aria-labelledby="how-h">
          <div className="text-center">
            <p className="eyebrow">{tx('How it works', 'Paano ito gumagana')}</p>
            <h2 id="how-h" className="mt-1 text-3xl">
              {tx('Three steps to your cake', 'Tatlong hakbang sa cake mo')}
            </h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              [tx('Describe it', 'Ilarawan'), tx('Type it like a chat, or add an inspo photo.', 'I-type na parang chat, o magdagdag ng inspo photo.')],
              [tx('See it and the price', 'Tingnan ang cake at presyo'), tx("Three designs in 3D, priced from the baker's menu.", 'Tatlong design sa 3D, may presyo mula sa menu ng baker.')],
              [tx('The baker approves', 'Nag-a-approve ang baker'), tx('Accept, counter, or choose another baker.', 'Tanggapin, makipagtawaran, o pumili ng iba.')],
            ].map(([title, text], i) => (
              <li key={i} className="card rise" style={{ ['--d' as string]: `${200 + i * 90}ms` }}>
                <p className="font-display text-3xl font-medium text-gold" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-lg">{title}</h3>
                <p className="mt-1 text-[0.95rem] text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card grid gap-5 sm:grid-cols-[1fr_1.4fr] sm:items-center">
          <div>
            <p className="eyebrow">{tx('Built for real kitchens', 'Para sa totoong kusina')}</p>
            <h2 className="mt-1 text-2xl">{tx('Honest prices, no surprises', 'Tapat na presyo, walang gulat')}</h2>
          </div>
          <ul className="space-y-2.5 text-[0.95rem]">
            {[
              tx('Free for customers, no sign-up.', 'Libre sa customer, walang sign-up.'),
              tx("Prices come from the baker's own costs, never from AI.", 'Galing sa sariling gastos ng baker ang presyo, hindi sa AI.'),
              tx('No payments in the app.', 'Walang bayaran sa app.'),
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <IconCheck className="mt-0.5 shrink-0 text-berry" />
                <span>{t}</span>
              </li>
            ))}
            <li className="pt-1">
              <Link to="/about" className="text-sm font-semibold text-berry underline underline-offset-4">
                {tx('About, privacy and limits', 'Tungkol, privacy at limitasyon')}
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
