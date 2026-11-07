import { Link } from 'react-router-dom';
import { describeCake } from '../cake/describe';
import { CakeView } from '../cake/CakeView';
import { Layout } from '../components/Layout';
import { toPublicMenu } from '../domain/pricing';
import { createSampleBakery } from '../domain/starterMenus';
import { toVisual } from '../domain/visual';
import { useDb } from '../data/store';
import { usePrefs, useTx } from '../lib/prefs';

const HERO_MENU = toPublicMenu(createSampleBakery());
const HERO = toVisual(HERO_MENU, { baseCakeId: 't2-6-8', componentIds: ['fl-ube', 'cv-buttercream', 'dc-drip', 'dc-flowers', 'tp-text'] }, { colors: ['#f8c8d8', '#b3164f'], textOnCake: 'Kita sa bawat hiwa', candles: 0 });

const STEP_BG = ['bg-strawberry', 'bg-ube', 'bg-mango'];

/** Party sweets floating around the hero. Decorative only, hidden from screen readers. */
function FloatingSweets() {
  const items: Array<[string, string, string]> = [
    ['🧁', 'left-0 top-0', '-12deg'],
    ['🎈', 'right-1 top-2', '8deg'],
    ['🍬', '-left-10 top-40 hidden md:block', '20deg'],
    ['🍩', '-right-10 top-44 hidden md:block', '-10deg'],
    ['🍭', '-left-8 bottom-0 hidden md:block', '14deg'],
    ['🎊', '-right-8 bottom-2 hidden md:block', '0deg'],
  ];
  return (
    <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
      {items.map(([e, pos, r], i) => (
        <span key={i} className={`bob absolute text-3xl opacity-80 ${pos}`} style={{ ['--r' as string]: r, animationDelay: `${i * 0.6}s` }}>
          {e}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const tx = useTx();
  const prefs = usePrefs();
  const db = useDb();
  return (
    <Layout>
      <div className="space-y-8">
        <section className="relative space-y-4 pt-2 text-center">
          <FloatingSweets />
          <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1 font-display text-lg font-medium text-berry shadow-sm">
            <span aria-hidden="true">🎉</span> Kita sa bawat hiwa. <span aria-hidden="true">🍰</span>
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {tx('Custom cake quotes that fit the budget and still pay the baker', 'Custom cake quotes na pasok sa budget, at kumikita pa rin ang baker')}
          </h1>
          <p className="mx-auto max-w-xl text-lg text-ink-soft">
            {tx(
              'Customers see 3 designs in 3D within their budget. Cakeita prices every part from the baker\'s real costs. The baker approves every quote.',
              'Makikita ng customer ang 3 design sa 3D na pasok sa budget nila. Ipe-presyo ng Cakeita ang bawat part mula sa totoong gastos ng baker. Ang baker ang nag-a-approve ng bawat quote.',
            )}
          </p>
        </section>

        <div className="rounded-[2rem] bg-white/70 p-2 shadow-[0_6px_0_#f6dbe3]">
          <CakeView visual={HERO} description={describeCake(HERO, prefs.lang)} showTools={false} />
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link to="/b/sample" className="btn min-h-16 text-lg">
            🎂 {tx("I'm ordering a cake", 'Mag-oorder ako ng cake')}
          </Link>
          <Link to="/baker" className="btn-secondary min-h-16 text-lg">
            👩‍🍳 {db.bakery ? tx('Open my bakery', 'Buksan ang bakery ko') : tx("I'm a baker", 'Baker ako')}
          </Link>
        </section>

        <section className="space-y-3" aria-labelledby="how-h">
          <h2 id="how-h" className="font-display text-2xl font-bold">
            {tx('How it works', 'Paano ito gumagana')}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ['💬', tx('Customer tells us the budget, people and idea, in Taglish.', 'Sasabihin ng customer ang budget, ilang tao at idea, kahit Taglish.')],
              ['🧁', tx('Cakeita builds Simple, Classic and Showstopper designs from the baker\'s menu, priced by code.', 'Gagawa ang Cakeita ng Simple, Classic at Showstopper mula sa menu ng baker, presyo gamit ang code.')],
              ['✅', tx('The baker checks the cost breakdown, approves, and sends the quote link in Messenger.', 'Iche-check ng baker ang breakdown, i-a-approve, at ipapadala ang quote link sa Messenger.')],
            ].map(([icon, text], i) => (
              <li key={i} className={`card ${STEP_BG[i]}`}>
                <p className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm" aria-hidden="true">
                  {icon}
                </p>
                <p className="mt-1">
                  <strong>{i + 1}.</strong> {text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card space-y-2 bg-mint">
          <h2 className="font-display text-xl font-bold">{tx('Built for real kitchens', 'Para sa totoong kusina')}</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>{tx('Free. No sign-up. Works on a basic phone and weak signal.', 'Libre. Walang sign-up. Gumagana sa simpleng phone at mahinang signal.')}</li>
            <li>{tx('AI only reads the request. Prices always come from your own costs.', 'Binabasa lang ng AI ang request. Galing lagi sa sarili mong gastos ang presyo.')}</li>
            <li>{tx('No payments inside the app, so no fake payment screens.', 'Walang bayaran sa app, kaya walang pekeng payment screen.')}</li>
            <li>{tx('Bigger text button at the top for Lolo and Lola.', 'May button sa taas para lumaki ang letra, para kay Lolo at Lola.')}</li>
          </ul>
          <Link to="/about" className="text-berry underline">
            {tx('About, privacy and limits', 'Tungkol, privacy at limitasyon')}
          </Link>
        </section>
      </div>
    </Layout>
  );
}
