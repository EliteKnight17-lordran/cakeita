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
    version: '1.5.0',
    date: '2026-11-09',
    en: [
      'Pilot survey (about 2 minutes, mostly taps) for bakers and customers: a few questions about ordering cakes today, then try Cakeita, then a few questions after.',
      'Feedback and help on every page. Answers wait on the phone if there is no signal.',
      'Terms of use, and a team-only results page with booth QR codes and a CSV download.',
    ],
    tl: [
      'Pilot survey (mga 2 minuto, puro tap) para sa baker at customer: ilang tanong tungkol sa pag-order ng cake ngayon, subukan ang Cakeita, tapos ilang tanong pagkatapos.',
      'Feedback at tulong sa bawat page. Naka-save muna sa phone kung walang signal.',
      'Terms of use, at results page para sa team na may QR codes para sa booth at CSV download.',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-11-09',
    en: ['Demo tab: owners can make the phone alert keys right on their device, ready to paste into Vercel.'],
    tl: ['Demo tab: puwedeng gumawa ang may-ari ng phone alert keys sa sariling device, handang i-paste sa Vercel.'],
  },
  {
    version: '1.4.0',
    date: '2026-11-09',
    en: [
      'Phone alerts: bakers can get a notification for each new request, and customers can ask to be told when the quote is ready.',
      'Inspo photos now reach the baker inside Cakeita when the baker has an account (only that baker can see them).',
      'Fully booked days: bakers mark days they are full; customers cannot pick them and the map shows the baker as booked.',
    ],
    tl: [
      'Phone alerts: may notification ang baker sa bawat bagong request, at puwedeng magpasabi ang customer kapag may quote na.',
      'Nakakarating na sa baker sa loob ng Cakeita ang inspo photo kapag may account ang baker (siya lang ang makakakita).',
      'Mga araw na puno: minamarkahan ng baker ang mga araw na puno na; hindi ito mapipili ng customer at nakalagay sa mapa.',
    ],
  },
  {
    version: '1.3.6',
    date: '2026-11-09',
    en: ['Map pictures now come from OpenStreetMap (free, no key), softened to match Cakeita. CARTO had started asking for a key.'],
    tl: ['Galing na sa OpenStreetMap ang mapa (libre, walang key). Humihingi na ng key ang CARTO.'],
  },
  {
    version: '1.3.5',
    date: '2026-11-09',
    en: ['Map: if map pictures hang on a network or browser, it tries a second map provider, then says so clearly. Pins, prices and the list keep working.'],
    tl: ['Mapa: kung hindi mag-load ang larawan ng mapa, susubukan ang ibang provider, at sasabihin nang malinaw. Gumagana pa rin ang pins, presyo at listahan.'],
  },
  {
    version: '1.3.4',
    date: '2026-11-09',
    en: [
      'Saved pictures now use the 3D cake as a clean picture card with what the cake is, ready to send in Messenger.',
      'The "sent" page shows the 3D cake instead of the flat drawing.',
      'Candles stand along the back when there are words or a topper, so nothing covers the message.',
    ],
    tl: [
      'Ang naka-save na picture ay galing na sa 3D cake, isang malinis na picture card na may paliwanag, handang i-send sa Messenger.',
      '3D cake na ang nasa "naipadala" na page imbes na flat na drawing.',
      'Nasa likod ang kandila kapag may sulat o topper, para walang natatakpan.',
    ],
  },
  {
    version: '1.3.3',
    date: '2026-11-09',
    en: [
      'After an update, a page left open reloads itself instead of breaking (this could stop the map from opening).',
      'If a screen ever crashes, you get a Reload button instead of a blank page.',
      'Bakers on a new phone are told to sign in to bring their bakery back; the empty quote page now has a way out.',
    ],
    tl: [
      'Pagkatapos ng update, kusang nagre-reload ang nakabukas na page imbes na masira (puwedeng ito ang dahilan kung bakit hindi bumubukas ang mapa).',
      'Kung may masira na screen, may Reload button imbes na blangkong page.',
      'Sinasabihan ang baker sa bagong phone na mag-sign in para bumalik ang bakery; may labasan na ang walang lamang quote page.',
    ],
  },
  {
    version: '1.3.2',
    date: '2026-11-09',
    en: [
      'See inside: cut a slice out of the 3D cake to show the sponge and filling layers.',
      'Nothing you type is dropped silently: when a design leaves something out to fit your budget, the page lists it, with one tap to the design that has it all.',
      '"Cake for 15" now reads as 15 people, a size you type (8 inch) is kept, and no surprise chocolate drip when you named your own decorations.',
      'New colors or words in your message now update the cake even after you customized it.',
    ],
    tl: [
      'Tingnan ang loob: hiwain ang 3D cake para makita ang sponge at palaman.',
      'Walang nawawala nang tahimik: kung may tinanggal para pumasok sa budget, nakalista ito, at isang pindot lang papunta sa kumpletong design.',
      'Nababasa na ang "cake for 15" bilang 15 tao, sinusunod ang laki (8 inch), at walang dagdag na drip kung may sarili kang dekorasyon.',
      'Nagbabago na ang cake kapag nagdagdag ka ng kulay o sulat sa mensahe, kahit na-customize mo na.',
    ],
  },
  {
    version: '1.3.1',
    date: '2026-11-09',
    en: [
      'Delete my account: one place to remove your sign-in and everything in the cloud.',
      'Full privacy policy page (privacy.html), also used for Facebook sign-in.',
      'Security update for a Firebase dependency used by our tests.',
    ],
    tl: [
      'I-delete ang account: isang pindot para burahin ang sign-in at lahat ng nasa cloud.',
      'Buong privacy policy (privacy.html), gamit din para sa Facebook sign-in.',
      'Security update sa isang Firebase dependency ng tests.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-09',
    en: [
      'Accounts: sign in with Facebook, Google or an emailed link. Customers still order without one.',
      'Bakers with an account get a short link, a live inbox (requests arrive by themselves), quotes that reach the customer live, and confirmations back. Messenger links keep working.',
      'Real bakers can put themselves on the "bakers near me" map; they show before the sample shops.',
      'New menu: Find bakers, My cakes, For bakers, Demo. Everything pretend now lives in the Demo tab, with an offline demo mode.',
      'Install Cakeita on your phone, and it opens with no signal after one visit.',
    ],
    tl: [
      'Accounts: mag-sign in gamit ang Facebook, Google o link sa email. Puwede pa ring mag-order ang customer nang walang account.',
      'Ang baker na may account ay may maikling link, live inbox, quote na live na nakikita ng customer, at live na confirmation. Gumagana pa rin ang Messenger links.',
      'Puwede nang ilagay ng totoong baker ang sarili sa mapa; nauuna sila sa mga sample shop.',
      'Bagong menu: Maghanap ng baker, Mga cake ko, Para sa baker, Demo. Nasa Demo tab na ang lahat ng pang-demo, may offline demo mode.',
      'I-install ang Cakeita sa phone; bumubukas kahit walang signal pagkatapos ng unang bisita.',
    ],
  },
  {
    version: '1.2.3',
    date: '2026-11-08',
    en: [
      'Theme toppers: character and theme requests (superhero, princess, dinosaur, unicorn, sports, graduation and more) get a generic printed cut-out in the cake colors, in 3D and 2D, priced like any other part. Real characters stay a licensed-topper note.',
      'The look is alive again: a slowly drifting glow with a pâtisserie pattern, a scalloped header, floating sprinkles and twinkling sparkles, and a sprinkle burst when you send, approve or confirm. All of it turns off with "reduce motion".',
      'Smarter AI model choice: tries the current Gemini Flash models in order and falls back automatically.',
      'The 3D view re-zooms when the cake grows or shrinks.',
    ],
    tl: [
      'Theme toppers: ang character at theme na request (superhero, princess, dinosaur, unicorn, sports, graduation at iba pa) ay may generic na printed cut-out sa kulay ng cake, sa 3D at 2D, at may presyo tulad ng ibang part. Ang totoong character ay nananatiling note para sa licensed topper.',
      'Buhay na ulit ang itsura: gumagalaw na glow at pattern ng pastry, scalloped na header, lumulutang na sprinkles at kislap, at sabog ng sprinkles kapag nag-send, nag-approve o nag-confirm. Naka-off lahat kapag naka-"reduce motion".',
      'Mas matalinong pagpili ng AI model: sinusubukan ang mga bagong Gemini Flash model nang sunod-sunod.',
      'Kusang nag-zoom ang 3D kapag lumaki o lumiit ang cake.',
    ],
  },
  {
    version: '1.2.2',
    date: '2026-11-08',
    en: [
      'Your cake stays in view while you customize. On phones a small live cake floats above the price: tap it to enlarge, then "See it in 3D" jumps back to the big cake.',
      'On laptops the order page is side by side: the 3D cake stays pinned on the left while you fill in the right.',
    ],
    tl: [
      'Kita mo pa rin ang cake habang nagcu-customize. Sa phone, may maliit na cake sa itaas ng presyo: i-tap para lumaki, at "Tingnan sa 3D" para bumalik sa malaking cake.',
      'Sa laptop, magkatabi na: naka-pin ang 3D cake sa kaliwa habang nagfi-fill out ka sa kanan.',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-11-08',
    en: [
      'New refined look: an editorial serif with a clean sans, warm ivory and deep raspberry, and simple line icons instead of emoji.',
      'Removed the playful extras (sweets wallpaper, banderitas, confetti) so the cake and the prices take center stage.',
      'Numbered sections on the order page, a calmer studio backdrop for the 3D cake, and tidier baker cards on the map.',
    ],
    tl: [
      'Bagong mas pino na itsura: eleganteng serif at malinis na sans, ivory at malalim na raspberry, at simpleng line icons imbes na emoji.',
      'Inalis ang mga pambatang dekorasyon (sweets wallpaper, banderitas, confetti) para ang cake at presyo ang bida.',
      'May numero na ang bawat bahagi ng order page, mas tahimik na backdrop para sa 3D cake, at mas maayos na baker cards sa mapa.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-08',
    en: [
      'New: one-page order. Type your cake like a Messenger message and the designs, 3D cake and price update as you type. No more Next, Next, Next.',
      'New: "Bakers near me" map. Compare the same cake across nearby bakers, each priced from their own costs, with distance, lead time and delivery. Tap to send your request to the one you like.',
      'New: more realistic 3D cake: soft studio lighting, rounded frosting edges, piped shell borders, swirl rosettes, roses, glossy drips, strawberries and a porcelain cake stand.',
      'New for bakers: "Get on the map" in My link.',
      'The 3D cake lowers its quality by itself on slow phones instead of stuttering, and computers without a graphics chip get a lighter 3D view.',
    ],
    tl: [
      'Bago: isang page na lang ang pag-order. I-type ang cake na parang Messenger message at kusang magbabago ang design, 3D cake at presyo.',
      'Bago: mapa ng "Mga baker na malapit". Ikumpara ang parehong cake sa mga baker sa malapit, bawat isa may presyo mula sa sarili nilang gastos, may layo, abiso at delivery. I-tap para ipadala ang request sa napili mo.',
      'Bago: mas makatotohanang 3D cake: malambot na ilaw, bilugang gilid ng frosting, piped na border, rosettes, rosas, makintab na drip, strawberry at porcelain na cake stand.',
      'Bago para sa baker: "Mapasama sa mapa" sa My link.',
      'Kusang binababa ng 3D cake ang quality sa mabagal na phone para hindi mag-lag, at mas magaan na 3D sa computer na walang graphics chip.',
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
