/**
 * Update history shown on the About page. Newest first.
 * When you ship a change: add an entry here AND bump "version" in package.json
 * (a unit test checks they match).
 */
export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  en: string[];
  tl: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.2.0',
    date: '2026-11-08',
    en: [
      'New: one-page order. Type your cake like a Messenger message and the designs, 3D cake and price update as you type. No more Next, Next, Next.',
      'New: "Bakers near me" map. Compare the same cake across nearby bakers, each priced from their own costs, with distance, lead time and delivery. Tap to send your request to the one you like.',
      'New: more realistic 3D cake: soft studio lighting, rounded frosting edges, piped shell borders, swirl rosettes, roses, glossy drips, strawberries and a porcelain cake stand.',
      'New for bakers: "Get on the map" in My link.',
      'The 3D cake lowers its quality by itself on slow phones instead of stuttering.',
    ],
    tl: [
      'Bago: isang page na lang ang pag-order. I-type ang cake na parang Messenger message at kusang magbabago ang design, 3D cake at presyo.',
      'Bago: mapa ng "Mga baker na malapit". Ikumpara ang parehong cake sa mga baker sa malapit, bawat isa may presyo mula sa sarili nilang gastos, may layo, abiso at delivery. I-tap para ipadala ang request sa napili mo.',
      'Bago: mas makatotohanang 3D cake: malambot na ilaw, bilugang gilid ng frosting, piped na border, rosettes, rosas, makintab na drip, strawberry at porcelain na cake stand.',
      'Bago para sa baker: "Mapasama sa mapa" sa My link.',
      'Kusang binababa ng 3D cake ang quality sa mabagal na phone para hindi mag-lag.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-07',
    en: [
      'New look: sweets wallpaper (cakes, cupcakes, poppers, candy), frosting drip header and fiesta banderitas over the cake.',
      'Rounder, friendlier fonts that work offline, and candy-style buttons.',
      'Confetti when the baker approves a quote and when the customer confirms.',
    ],
    tl: [
      'Bagong itsura: wallpaper ng matatamis (cake, cupcake, popper, kendi), frosting drip sa header at banderitas sa ibabaw ng cake.',
      'Mas bilog at masayang font na gumagana kahit offline, at parang kendi na mga button.',
      'May confetti kapag in-approve ng baker ang quote at kapag nag-confirm ang customer.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-11-06',
    en: [
      'Fixed: your English/Taglish choice now stays when you open Cakeita in another tab or come back from Messenger.',
      'Fixed: the optional AI reading route now builds and runs on Vercel.',
      'New: this update history on the About page.',
    ],
    tl: [
      'Ayos na: nananatili na ang piniling English/Taglish kahit magbukas ng ibang tab o bumalik galing Messenger.',
      'Ayos na: gumagana na sa Vercel ang optional na AI reading.',
      'Bago: itong listahan ng mga update sa About page.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-06',
    en: [
      'First release for Build-Off 2026.',
      'Customers: budget-first Simple, Classic and Showstopper designs with a 3D cake you can turn (2D on older phones).',
      'Bakers: quick setup with starter menus, request inbox, cost breakdown and approval, order board, shopping list, lugi alerts and insights.',
      'Requests, quotes and confirmations travel as links in Messenger. No accounts, no payments.',
      'Big-text mode, English/Taglish, offline reader, and a developer panel for testing.',
    ],
    tl: [
      'Unang release para sa Build-Off 2026.',
      'Customer: Simple, Classic at Showstopper na design ayon sa budget, may 3D cake na naiikot (2D sa lumang phone).',
      'Baker: mabilis na setup gamit ang starter menu, inbox ng request, breakdown ng gastos at approval, order board, shopping list, lugi alert at insights.',
      'Ang request, quote at kumpirmasyon ay mga link sa Messenger. Walang account, walang bayad.',
      'Big-text mode, English/Taglish, offline reader, at developer panel para sa testing.',
    ],
  },
];

export const APP_VERSION = CHANGELOG[0]?.version ?? '0.0.0';
