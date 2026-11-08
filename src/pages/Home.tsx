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
import { usePrefs, useTx } from '../lib/prefs';

const HERO_MENU = toPublicMenu(createSampleBakery());
const HERO = toVisual(HERO_MENU, { baseCakeId: 't2-6-8', componentIds: ['fl-ube', 'cv-buttercream', 'dc-drip', 'dc-flowers', 'tp-text'] }, { colors: ['#f5ddd6', '#8c2246'], textOnCake: 'Kita sa bawat hiwa', candles: 0 });

export default function Home() {
  const tx = useTx();
  const prefs = usePrefs();
  const db = useDb();
  return (
    <Layout>
      <div className="space-y-12">
        <section className="space-y-5 pt-2 text-center">
          <p className="eyebrow">Kita sa bawat hiwa</p>
          <h1 className="mx-auto max-w-2xl text-[2.35rem] leading-[1.08] sm:text-5xl">
            {tx('Custom cake quotes that fit the budget and still pay the baker', 'Custom cake quotes na pasok sa budget, at kumikita pa rin ang baker')}
          </h1>
          <p className="mx-auto max-w-xl text-[1.05rem] text-ink-soft">
            {tx(
              'Customers see three designs in 3D within their budget. Every part is priced from the baker\'s real costs, and the baker approves every quote.',
              'Makikita ng customer ang tatlong design sa 3D na pasok sa budget nila. Bawat part ay may presyo mula sa totoong gastos ng baker, at ang baker ang nag-a-approve ng bawat quote.',
            )}
          </p>
          <div className="mx-auto flex max-w-md flex-col gap-2.5 pt-1 sm:max-w-none sm:flex-row sm:justify-center">
            <Link to="/near" className="btn min-h-14 px-7 text-[1.05rem]">
              <IconPin /> {tx('Find a baker near me', 'Maghanap ng baker na malapit')}
            </Link>
            <Link to="/demo" className="btn-secondary min-h-14 px-6 text-[1.05rem]">
              {tx('Try the demo', 'Subukan ang demo')} <IconArrow />
            </Link>
          </div>
          <p className="text-sm text-ink-soft">
            {db.bakery ? tx('Welcome back.', 'Welcome back.') : tx('Are you a baker?', 'Baker ka ba?')}{' '}
            <Link to="/baker" className="font-semibold text-berry underline underline-offset-4">
              {db.bakery ? tx('Open my bakery', 'Buksan ang bakery ko') : tx('Set up your bakery in 3 minutes', 'I-set up ang bakery mo sa 3 minuto')}
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
              {tx('From a Messenger message to a confirmed order', 'Mula Messenger message hanggang confirmed order')}
            </h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              [tx('The customer asks', 'Nagtanong ang customer'), tx('Budget, people and the idea, typed in Taglish like a normal chat.', 'Budget, ilang tao at idea, naka-Taglish na parang normal na chat.')],
              [tx('Cakeita designs and prices', 'Nagdi-design at nagpe-presyo ang Cakeita'), tx("Simple, Classic and Showstopper, built from the baker's own menu and priced by code.", 'Simple, Classic at Showstopper, mula sa sariling menu ng baker at may presyo gamit ang code.')],
              [tx('The baker approves', 'Nag-a-approve ang baker'), tx('A clear cost breakdown, one tap to approve, and the quote goes back through Messenger.', 'Malinaw na breakdown ng gastos, isang tap para i-approve, at babalik ang quote sa Messenger.')],
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
              tx('Free. Customers order without signing up. Works on a basic phone and weak signal.', 'Libre. Walang sign-up para sa customer. Gumagana sa simpleng phone at mahinang signal.'),
              tx('AI only reads the request. Prices always come from your own costs.', 'Binabasa lang ng AI ang request. Galing lagi sa sarili mong gastos ang presyo.'),
              tx('No payments inside the app, so no fake payment screens.', 'Walang bayaran sa app, kaya walang pekeng payment screen.'),
              tx('Bakers sign in with Facebook, Google or email: a live inbox, short link and a spot on the map.', 'Nagsa-sign in ang baker gamit ang Facebook, Google o email: live inbox, maikling link at puwesto sa mapa.'),
              tx('Bigger text button at the top for Lolo and Lola.', 'May button sa taas para lumaki ang letra, para kay Lolo at Lola.'),
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
