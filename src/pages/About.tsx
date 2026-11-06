import { Layout } from '../components/Layout';
import { useTx } from '../lib/prefs';

export default function About() {
  const tx = useTx();
  const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="card space-y-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">{tx('About Cakeita', 'Tungkol sa Cakeita')}</h1>
        <S title={tx('The problem', 'Ang problema')}>
          <p>
            {tx(
              'Home bakers quote custom cakes by hand in Messenger, one back-and-forth at a time. Customers often send an inspo photo that costs far more than their budget, and many bakers price from memory, so rising ingredient costs quietly eat their profit.',
              'Sa Messenger nagko-quote ang mga home baker, paisa-isang palitan ng message. Madalas mas mahal ang inspo photo kaysa sa budget ng customer, at marami ang nagpe-presyo mula sa alaala, kaya tahimik na nauubos ang tubo kapag tumaas ang presyo ng sangkap.',
            )}
          </p>
          <p className="text-sm text-ink-soft">{tx('This is our hypothesis from talking to bakers. We are still collecting numbers to confirm it.', 'Ito ang hypothesis namin mula sa pakikipag-usap sa mga baker. Nangongolekta pa kami ng datos para patunayan ito.')}</p>
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
            <li>{tx('No accounts. Data stays on your own phone (browser storage).', 'Walang account. Nasa sarili mong phone lang ang data.')}</li>
            <li>{tx('Requests and quotes travel as links you send yourself in Messenger. Our servers do not keep them.', 'Ang request at quote ay mga link na ikaw mismo ang nagpapadala sa Messenger. Hindi ito iniimbak ng server namin.')}</li>
            <li>{tx('Inspo photos are shrunk on your phone and are never saved. If smart reading is on, the photo is sent once to the AI to read and then discarded.', 'Pinaliliit sa phone mo ang inspo photo at hindi sine-save. Kung naka-on ang smart reading, ipapadala ito minsan sa AI para basahin at pagkatapos ay itatapon.')}</li>
            <li>{tx('Cakeita never asks for or handles payments.', 'Hindi humihingi o humahawak ng bayad ang Cakeita.')}</li>
          </ul>
        </S>
        <S title={tx('Limits we are honest about', 'Mga limitasyon')}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{tx('The 3D cake is a concept, not a photo. The real cake may look different.', 'Concept lang ang 3D cake, hindi litrato. Puwedeng mag-iba ang totoong cake.')}</li>
            <li>{tx('Sample ingredient prices are estimates. Bakers should enter their own.', 'Tantya lang ang sample prices. Dapat ilagay ng baker ang sarili nilang presyo.')}</li>
            <li>{tx('Data is per device. Use Download backup in Menu and prices.', 'Per device ang data. Gamitin ang Download backup sa Menu at presyo.')}</li>
            <li>{tx('Character themes are made generic. Bakers should use licensed toppers.', 'Ginagawang generic ang character themes. Gumamit ng licensed topper.')}</li>
          </ul>
        </S>
        <p className="text-center text-sm text-ink-soft">Build-Off 2026 · {tx('Prototype', 'Prototype')} · v0.1</p>
      </div>
    </Layout>
  );
}
