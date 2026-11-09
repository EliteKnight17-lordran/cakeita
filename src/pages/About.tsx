import { Layout } from '../components/Layout';
import { CHANGELOG, APP_VERSION, type Release as ReleaseT } from '../changelog';
import { usePrefs, useTx } from '../lib/prefs';

export default function About() {
  const tx = useTx();
  const { lang } = usePrefs();
  const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="card space-y-2">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-semibold">{tx('About Cakeita', 'Tungkol sa Cakeita')}</h1>
        <S title={tx('The problem', 'Ang problema')}>
          <p>
            {tx(
              'Home bakers quote custom cakes by hand in Messenger, one back-and-forth at a time. Customers often send an inspo photo that costs far more than their budget, and many bakers price from memory, so rising ingredient costs quietly eat their profit.',
              'Sa Messenger nagko-quote ang mga home baker, paisa-isang palitan ng message. Madalas mas mahal ang inspo photo kaysa sa budget ng customer, at marami ang nagpe-presyo mula sa alaala, kaya tahimik na nauubos ang tubo kapag tumaas ang presyo ng sangkap.',
            )}
          </p>
          <p className="text-sm text-ink-soft">
            {tx(
              'Our pilot survey (Nov 2026, 28 people, a small sample): 9 of 15 customers have given up on a baker over a slow reply or the price, budget was the problem they named most, and 8 of 13 bakers say 3 to 5 of every 10 people they quote stop replying.',
              'Pilot survey namin (Nov 2026, 28 tao, maliit na sample): 9 sa 15 customer ang nag-give up na sa isang baker dahil sa bagal ng reply o sa presyo, budget ang pinakamadalas nilang problema, at sabi ng 8 sa 13 baker, 3 hanggang 5 sa bawat 10 binigyan nila ng presyo ang hindi na nagre-reply.',
            )}
          </p>
        </S>
        <S title={tx('How prices are made', 'Paano ginagawa ang presyo')}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{tx('Each cake is broken into parts: size, flavor, frosting, decorations, toppers.', 'Hinahati ang cake sa parts: laki, flavor, frosting, dekorasyon, topper.')}</li>
            <li>{tx("Cost = the baker's ingredients + the baker's time + bought-in extras.", 'Gastos = sangkap ng baker + oras ng baker + binili na extras.')}</li>
            <li>{tx('Price = cost ÷ (1 − target margin), rounded up to the nearest ₱50, never below the minimum order.', 'Presyo = gastos ÷ (1 − target na tubo), rounded up sa ₱50, hindi bababa sa minimum order.')}</li>
            <li>{tx('AI (optional) only reads the message or photo and picks parts from the menu. It never sets a price.', 'Ang AI (optional) ay nagbabasa lang ng message o photo at pumipili ng parts sa menu. Hindi ito nagtatakda ng presyo.')}</li>
            <li>{tx('The baker approves every quote before the customer sees a final price.', 'Ang baker ang nag-a-approve ng bawat quote bago makita ng customer ang final na presyo.')}</li>
          </ul>
        </S>
        <S title={tx('Privacy', 'Privacy')}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{tx('Accounts are optional. Without one, your data stays on your own phone and requests travel as links you send in Messenger.', 'Optional ang account. Kung wala, nasa phone mo lang ang data at ang request ay link na ipinapadala mo sa Messenger.')}</li>
            <li>{tx('If you sign in (Facebook, Google or email), we keep your name, email, bakery menu, requests and quotes in Google Firebase so they reach the other side and follow you to any phone. Only the baker can read requests sent to them. Map pins are rounded to about 100 m.', 'Kung mag-sign in ka, iniimbak namin sa Google Firebase ang pangalan, email, menu, requests at quotes para makarating sa kabila at masundan ka sa kahit anong phone. Ang baker lang ang nakakabasa ng request sa kanila. Ang pin sa mapa ay nasa ~100 m lang.')}</li>
            <li>{tx('Delete everything any time: Account, then Delete my account. Full policy: ', 'Puwedeng burahin lahat kahit kailan: Account, tapos I-delete ang account ko. Buong policy: ')}<a className="underline" href="./privacy.html">privacy.html</a></li>
            <li>{tx('Inspo photos are shrunk on your phone. If the baker has an account, the photo goes with your request and only that baker can see it; otherwise it is never saved. If smart reading is on, the photo is sent once to the AI to read and then discarded.', 'Pinaliliit sa phone mo ang inspo photo. Kung may account ang baker, kasama ito sa request at siya lang ang makakakita; kung wala, hindi ito sine-save. Kung naka-on ang smart reading, ipapadala ito minsan sa AI at itatapon.')}</li>
            <li>{tx('Cakeita never asks for or handles payments.', 'Hindi humihingi o humahawak ng bayad ang Cakeita.')}</li>
            <li>{tx('Your location for the bakers map stays on your phone. Only the map pictures are downloaded.', 'Nasa phone mo lang ang location mo para sa mapa. Ang larawan lang ng mapa ang dina-download.')}</li>
          </ul>
        </S>
        <S title={tx('Limits we are honest about', 'Mga limitasyon')}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{tx('The 3D cake is a concept, not a photo. The real cake may look different.', 'Concept lang ang 3D cake, hindi litrato. Puwedeng mag-iba ang totoong cake.')}</li>
            <li>{tx('Sample ingredient prices are estimates. Bakers should enter their own.', 'Tantya lang ang sample prices. Dapat ilagay ng baker ang sarili nilang presyo.')}</li>
            <li>{tx('Data is per device. Use Download backup in Menu and prices.', 'Per device ang data. Gamitin ang Download backup sa Menu at presyo.')}</li>
            <li>{tx('Character themes are made generic. Bakers should use licensed toppers.', 'Ginagawang generic ang character themes. Gumamit ng licensed topper.')}</li>
            <li>{tx('The bakeries on the map are fictional samples for the demo, with sample prices.', 'Sample lang (hindi totoo) ang mga bakery sa mapa para sa demo, at sample din ang presyo.')}</li>
          </ul>
        </S>
        <S title={tx('Update history', 'Mga update')}>
          {/* The newest three; the rest fold away so the page stays short. */}
          <ol className="space-y-3" aria-label={tx('Update history', 'Mga update')}>
            {CHANGELOG.slice(0, 3).map((r) => (
              <Release key={r.version} r={r} lang={lang} />
            ))}
          </ol>
          {CHANGELOG.length > 3 && (
            <details className="rounded-xl border border-line p-3">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">{tx(`Older updates (${CHANGELOG.length - 3})`, `Mga lumang update (${CHANGELOG.length - 3})`)}</summary>
              <ol className="mt-2 space-y-3">
                {CHANGELOG.slice(3).map((r) => (
                  <Release key={r.version} r={r} lang={lang} />
                ))}
              </ol>
            </details>
          )}
        </S>
        <p className="text-center text-sm text-ink-soft">Build-Off 2026 · {tx('Prototype', 'Prototype')} · v{APP_VERSION}</p>
      </div>
    </Layout>
  );
}

function Release({ r, lang }: { r: ReleaseT; lang: 'tl' | 'en' }) {
  return (
    <li>
      <h3 className="font-bold">
        v{r.version} <span className="font-normal text-sm text-ink-soft">· {r.date}</span>
      </h3>
      <ul className="list-disc space-y-1 pl-5">
        {(lang === 'tl' ? r.tl : r.en).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </li>
  );
}
