/**
 * End-to-end + accessibility walkthrough. Plays the customer, the baker and an
 * elder on separate "phones" (browser contexts with separate storage), passing
 * links between them exactly like Messenger would.
 *
 *   npm run build && npm run e2e
 *
 * Needs Playwright with Chromium (preinstalled in CI image / `npx playwright install chromium`).
 * Screenshots go to e2e/out/.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out');
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BLANK_TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==', 'base64');

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

async function axe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
  });
  const bad = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(`a11y: ${label}`, bad.length === 0, bad.length ? JSON.stringify(bad) : res.length ? `minor: ${res.map((v) => v.id).join(', ')}` : 'clean');
}

async function phone(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, ...opts });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  // Map pictures come from the internet; serve a blank tile so the test is offline and repeatable.
  await ctx.route(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/, (r) => r.fulfill({ contentType: 'image/png', body: BLANK_TILE }));
  const page = await ctx.newPage();
  if (process.env.E2E_THROTTLE) { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.E2E_THROTTLE) }); }
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.label = name;
  return page;
}

async function waitTrue(fn, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

const shot = async (page, name) => {
  try {
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true, timeout: 15000 });
  } catch {
    await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 15000 }).catch(() => {});
  }
};
const linkFromShareBox = async (page) => {
  await page.locator('details summary').filter({ hasText: /message|link/i }).first().click();
  return page.locator('details a[href*="#/"]').first().getAttribute('href');
};

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: join(here, '..'), stdio: 'ignore' });
  try {
    await waitForServer();
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

    // ---------------- Customer ----------------
    const customer = await phone(browser, 'customer');
    await customer.goto(BASE);
    await customer.waitForTimeout(1500);
    check('home shows 3D cake canvas', (await customer.locator('canvas').count()) === 1);
    await axe(customer, 'home');
    await shot(customer, '01-home');

    // Real-product pages: Demo tab, My cakes, Account (cloud is off for test robots, so it says so).
    await customer.goto(`${BASE}#/demo`);
    check('demo tab offers the sample customer and bakery', await customer.getByRole('link', { name: /Mag-order bilang customer/ }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    check('presenter tools are folded away from visitors', !(await customer.getByRole('button', { name: /Buksan ang developer panel/ }).isVisible()));
    await axe(customer, 'demo tab');
    await customer.goto(`${BASE}#/me`);
    check('my cakes shows an empty state', await customer.getByText(/Wala pang request/).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await customer.goto(`${BASE}#/account`);
    check('account page loads (offline mode for robots)', await customer.getByRole('heading', { name: 'Account' }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await axe(customer, 'account');
    await customer.goto(BASE);
    await customer.getByRole('button', { name: 'Menu' }).click();
    check('phone menu opens with main links', await customer.getByRole('link', { name: 'Mga cake ko' }).waitFor({ timeout: 10000 }).then(() => true, () => false));

    await customer.goto(`${BASE}#/b/sample`);
    // Step by step: 1 photo and words only, 2 the 3D cake to customize, 3 price, 4 bakers.
    await customer.locator('[data-stage="idea"]').waitFor({ timeout: 20000 });
    check('step 1 shows only the inspo photo and the description', (await customer.locator('[data-inspo]').isVisible()) && (await customer.getByRole('radiogroup', { name: 'Mga design' }).count()) === 0 && (await customer.getByTestId('live-price').count()) === 0);
    check('"make my cake" waits for a photo or words', await customer.locator('[data-make-cake]').isDisabled());
    await axe(customer, 'step 1: idea');
    await customer.getByLabel(/Ilarawan ang cake/).fill('2 tier pink ube cake with chocolate drip and fresh flowers for a birthday, 30 pax, "Happy 7th Mia"');
    await customer.locator('[data-make-cake]').click();
    check('making the cake shows the building steps', await customer.locator('[data-photo-building]').waitFor({ timeout: 3000 }).then(() => true, () => false));
    await customer.locator('[data-stage="cake"]').waitFor({ timeout: 10000 });
    check('step 2 shows the 3D cake', await customer.locator('figure [role="img"]').first().isVisible());
    check('unofficial understanding shown', await customer.getByText('Ang naintindihan namin').isVisible());
    check('sticky price shows on the cake step', await customer.getByTestId('live-price').isVisible());
    const inside = customer.locator('[data-see-inside]').first();
    await inside.click();
    check('"See inside" cuts the cake open', (await inside.getAttribute('aria-pressed')) === 'true' && /Hiniwa/.test((await customer.locator('figure [role="img"]').first().getAttribute('aria-label')) ?? ''));
    await inside.click();
    await customer.waitForTimeout(1200);
    await axe(customer, 'step 2: cake');
    await shot(customer, '02-cake');

    await customer.getByText('I-customize').first().click();
    const priceBefore = await customer.getByTestId('live-price').innerText();
    await customer.getByRole('button', { name: /Sprinkles/ }).click();
    const priceAfter = await customer.getByTestId('live-price').innerText();
    check('adding sprinkles re-prices live', priceBefore !== priceAfter, `${priceBefore} → ${priceAfter}`);
    await customer.waitForTimeout(1000);
    await shot(customer, '03-customize');

    // Phones: the cake follows you down the page as a small floating cake.
    await customer.getByLabel('Nakasulat sa cake').scrollIntoViewIfNeeded();
    const mini = customer.getByTestId('mini-cake');
    await mini.waitFor({ timeout: 5000 }).catch(() => {});
    check('small cake floats while customizing', await mini.isVisible());
    await mini.click();
    check('tapping the small cake enlarges it', await customer.getByTestId('mini-cake-open').isVisible());
    await shot(customer, '03b-mini-cake');
    await customer.getByRole('button', { name: /Tingnan sa 3D/ }).click();
    await customer.waitForTimeout(1200);
    const cakeTop = await customer.getByRole('img', { name: /cake/i }).first().evaluate((el) => el.getBoundingClientRect().top);
    check('"See it in 3D" jumps back to the big cake', cakeTop >= 0 && cakeTop < 400, `top ${Math.round(cakeTop)}`);

    // Allergies: the sponge itself, designs that skip a part, and a part added back by hand.
    const allergy = customer.locator('#allergies');
    await allergy.scrollIntoViewIfNeeded();
    await allergy.fill('itlog');
    check('allergy to egg warns about the sponge itself', await customer.locator('[data-allergy="warn"]').getByText(/Ang mismong cake/).waitFor({ timeout: 5000 }).then(() => true, () => false));
    await allergy.fill('chocolate');
    check('allergy to chocolate: the suggested cake leaves the drip out', await customer.locator('[data-allergy="clear"]').waitFor({ timeout: 5000 }).then(() => true, () => false));
    await customer.getByRole('button', { name: /Chocolate drip/ }).first().click();
    check('adding it back by hand shows a red warning', await customer.locator('[data-allergy-hit="dc-drip"]').waitFor({ timeout: 5000 }).then(() => true, () => false));
    await axe(customer, 'allergy warning');
    await shot(customer, '03c-allergy');
    await customer.locator('[data-allergy-remove="dc-drip"]').click();
    check('"Remove" takes the part off the cake', await customer.locator('[data-allergy-hit="dc-drip"]').waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
    await allergy.fill('blueberries');
    await customer.waitForTimeout(300);

    // Step 3: price range, then the designs that fit.
    await customer.locator('[data-next-price]').click();
    await customer.locator('[data-stage="price"]').waitFor();
    const designGroup = customer.getByRole('radiogroup', { name: 'Mga design' });
    const cards = designGroup.getByRole('radio');
    await customer.getByRole('button', { name: '₱2,000 – ₱3,500' }).click();
    check('a price range sets the budget', (await customer.locator('#budget').inputValue()) === '3500');
    await customer.locator('#budget').fill('2500');
    await customer.locator('[data-quick-date]').first().click();
    check('customer sees 2-3 designs', (await cards.count()) >= 2, `${await cards.count()} designs`);
    check('designs show budget fit labels', (await customer.getByText('Pasok sa budget').count()) >= 1);
    // The drip was taken off by hand (allergy "Remove"), so it is not "left out"; Simple still says what it skips.
    const simpleCard = await customer.locator('[data-design="simple"]').innerText();
    check('each design says what it leaves out (not what they removed themselves)', /Wala rito: /.test(simpleCard) && !/Chocolate drip/.test(simpleCard), simpleCard.replace(/\n+/g, ' / '));
    await customer.waitForTimeout(800);
    await axe(customer, 'step 3: price');
    await shot(customer, '02-designs');

    // Nearby bakers map: same cake, each baker's own price.
    await customer.goto(`${BASE}#/near?from=sample`);
    await customer.getByRole('heading', { name: /Mga baker na malapit/ }).waitFor();
    check('map loads with price pins', await waitTrue(async () => (await customer.locator('.leaflet-marker-icon .pin').count()) >= 2), `${await customer.locator('.leaflet-marker-icon .pin').count()} pins`);
    const requestButtons = customer.getByRole('button', { name: /^Mag-request kay/ });
    check('map lists bakers who can make it', (await requestButtons.count()) >= 1, `${await requestButtons.count()} bakers`);
    const pinPrices = await customer.locator('.leaflet-marker-icon .pin').allInnerTexts();
    check('pins show a peso estimate, with the bakery name where there is room', pinPrices.every((t) => /(^|\n)₱[\d,]+$/.test(t.trim())) && pinPrices.some((t) => /^\S.*\n₱[\d,]+$/.test(t.trim())), pinPrices.join(' | '));
    const pinBoxes = await customer.locator('.leaflet-marker-icon .pin').evaluateAll((els) => els.filter((e) => e.querySelector('.pin-name')).map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
    const pileUp = pinBoxes.some((a, i) => pinBoxes.some((b, j) => j > i && a[0] < b[1] - 2 && a[1] > b[0] + 2 && a[2] < b[3] - 2 && a[3] > b[2] + 2));
    check('pin names never pile on top of each other', !pileUp, `${pinBoxes.length} named pins`);
    await customer.locator('[data-filters] summary').click();
    await customer.getByRole('button', { name: 'Kahit gaano kalayo' }).click();
    await customer.getByLabel('Yung kaya lang gawin').uncheck();
    check('unticking shows bakers who cannot make all of it', await waitTrue(async () => (await customer.getByText(/Hindi gumagawa ng|masyadong maaga/).count()) >= 1));
    await customer.waitForTimeout(800);
    await axe(customer, 'nearby bakers map');
    await shot(customer, '13-near-map');
    await customer.goBack();
    await designGroup.waitFor();
    check('cake survives the trip to the map and back (same step)', await customer.evaluate(() => JSON.parse(sessionStorage.getItem('cakeita.draft.sample') || '{}').description?.includes('Happy 7th Mia')));

    await customer.locator('[data-choose-baker]').click();
    check('choosing a baker first asks for name and contact', await customer.getByText(/Pakilagay ang pangalan/).isVisible());
    await customer.getByLabel('Pangalan mo').fill('Ana Test');
    await customer.getByLabel(/Messenger name o mobile/).fill('0917 123 4567');
    check('sending explains what the baker will see (no extra checkbox)', await customer.locator('[data-consent-note]').isVisible());
    await axe(customer, 'customer contact');
    // Two-phone demo: send straight to the demo bakery and pass the link like Messenger would.
    await customer.locator('[data-send-direct]').click();
    await customer.getByRole('heading', { name: /Ipadala na sa baker/ }).waitFor();
    const requestUrl = await linkFromShareBox(customer);
    check('request link created', !!requestUrl && requestUrl.includes('#/baker/import?r='), `${requestUrl?.length} chars`);
    await shot(customer, '04-sent');

    // ---------------- Baker ----------------
    const baker = await phone(browser, 'baker');
    await baker.goto(`${BASE}#/baker`);
    await axe(baker, 'baker setup');
    await baker.getByRole('button', { name: 'Gamitin ang demo bakery' }).click();
    await baker.goto(requestUrl);
    await baker.getByRole('heading', { name: 'Ana Test' }).waitFor();
    check('baker sees breakdown', await baker.getByRole('heading', { name: 'Breakdown ng presyo' }).isVisible());
    check('baker sees the customer allergy', await baker.locator('[data-allergy]').getByText(/Allergy ng customer: blueberries/).isVisible());
    check('baker sees "accept at the app price" button', await baker.getByRole('button', { name: /Tanggapin sa ₱/ }).isVisible());
    await baker.getByLabel(/Presyong ipapadala/).fill('500');
    check('red warning for a losing price', await baker.getByText('Lugi ka rito').isVisible());
    await baker.getByLabel(/Presyong ipapadala/).fill('');
    await baker.waitForTimeout(800);
    await axe(baker, 'baker approval card');
    await shot(baker, '05-approval');
    await baker.getByRole('button', { name: /Tanggapin sa ₱/ }).click();
    await baker.getByText('Ipadala ang quote sa customer').waitFor();
    const quoteUrl = await linkFromShareBox(baker);
    check('quote link created', !!quoteUrl && quoteUrl.includes('#/o/'));

    // ---------------- Customer gets quote ----------------
    await customer.goto(quoteUrl);
    await customer.getByRole('heading', { name: /ito ang quote mo/ }).waitFor();
    check('customer quote page says to pay the baker directly', await customer.getByText(/Sa baker ka mismo magbabayad/).first().isVisible());
    await customer.waitForTimeout(800);
    await axe(customer, 'customer quote');
    await shot(customer, '06-quote');
    await customer.getByRole('button', { name: /Ito ang gusto ko/ }).click();
    const confirmUrl = await linkFromShareBox(customer);
    check('confirm link created', !!confirmUrl && confirmUrl.includes('?c='));

    // ---------------- Baker gets confirmation ----------------
    await baker.goto(confirmUrl);
    await baker.getByRole('heading', { name: 'Order ticket' }).waitFor();
    check('order confirmed on baker phone', await baker.getByText('Confirmed').first().isVisible());
    await baker.getByLabel(/Bayad na/).check();
    await baker.goto(`${BASE}#/baker/board`);
    check('order on board', await waitTrue(() => baker.getByText('Ana Test').first().isVisible()));
    await axe(baker, 'baker board');
    await shot(baker, '07-board');

    // ---------------- Paste a DM ----------------
    await baker.goto(`${BASE}#/baker`);
    await baker.getByLabel('Message ng customer').fill("Spiderman theme cake for my son's 5th bday, 20 pax, 1.8k budget, may candles po");
    await baker.getByRole('button', { name: 'Basahin at i-presyo' }).click();
    await baker.getByText('May character').waitFor();
    check('trademark swapped and licensed topper note shown', await baker.getByText(/Customer mentioned .*licensed topper/).isVisible());
    check('character request gets a generic theme topper', (await baker.locator('[data-motif="hero"][aria-pressed="true"]').count()) === 1);
    await shot(baker, '08-pasted-dm');

    // ---------------- Price update + lugi ----------------
    await baker.goto(`${BASE}#/baker/menu`);
    await baker.getByLabel('I-type o sabihin').fill('butter 900 per kilo, itlog 12 each');
    await baker.getByRole('button', { name: 'Basahin ang presyo' }).click();
    check('price update preview', await baker.getByText('I-check bago i-save:').isVisible());
    await baker.getByRole('button', { name: 'I-save ang bagong presyo' }).click();
    check('lugi alert offers a raise', (await baker.getByRole('button', { name: /Itaas sa ₱/ }).count()) > 0);
    await axe(baker, 'baker menu');
    await shot(baker, '09-menu');
    await baker.goto(`${BASE}#/baker/insights`);
    await baker.waitForTimeout(300);
    check('phone: the open baker tab is scrolled into view', await baker.getByRole('link', { name: 'Insights' }).evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }));
    await axe(baker, 'baker insights');
    await shot(baker, '10-insights');

    // A signed-in baker places their own pin by tapping the map (cloud is off for robots, so fake the account id).
    await baker.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('cakeita.db.v1'));
      d.bakery.cloudUid = 'e2e-baker';
      d.bakery.isSample = false;
      localStorage.setItem('cakeita.db.v1', JSON.stringify(d));
    });
    await baker.goto(`${BASE}#/baker/share`);
    await baker.reload();
    const bakerMap = baker.locator('[data-baker-map] .leaflet-container');
    await bakerMap.waitFor({ timeout: 15000 });
    const listBox = baker.locator('section[aria-labelledby="map-h"] input[type="checkbox"]');
    check('baker map: listing waits for a pin', await listBox.isDisabled());
    await bakerMap.scrollIntoViewIfNeeded();
    const mb = await bakerMap.boundingBox();
    await baker.mouse.click(mb.x + mb.width * 0.7, mb.y + mb.height * 0.5);
    const pinned = await waitTrue(async () => !!(await baker.evaluate(() => JSON.parse(localStorage.getItem('cakeita.db.v1')).bakery.location?.lat)));
    check('baker map: tapping the map sets the pin (rounded to ~100 m)', pinned && (await baker.evaluate(() => { const l = JSON.parse(localStorage.getItem('cakeita.db.v1')).bakery.location; return Math.round(l.lat * 1000) === l.lat * 1000; })));
    await listBox.check();
    check('baker map: then they can list themselves', await listBox.isChecked());
    await axe(baker, 'baker map listing');
    // Laptop browsers have no share menu: no "Send" button there that only copies.
    const sheet = await baker.evaluate(() => typeof navigator.share === 'function');
    const box = baker.locator('[data-share-box]').first();
    check('share box: "Send" only where the device has a share menu', (await box.getAttribute('data-share-box')) === (sheet ? 'sheet' : 'copy') && (await box.locator('[data-share-send]').count()) === (sheet ? 1 : 0), `share=${sheet}`);

    // ---------------- Laptop: the cake stays beside the controls ----------------
    const laptop = await phone(browser, 'laptop', { viewport: { width: 1280, height: 800 } });
    await laptop.goto(`${BASE}#/b/sample`);
    await laptop.locator('[data-stage="idea"]').waitFor({ timeout: 20000 });
    await laptop.getByLabel(/Ilarawan ang cake/).fill('Ube cake with fresh flowers, 20 pax, "Happy 7th Mia"');
    await laptop.locator('[data-make-cake]').click();
    await laptop.locator('[data-stage="cake"]').waitFor({ timeout: 10000 });
    await laptop.getByText('I-customize').first().click();
    await laptop.getByLabel('Nakasulat sa cake').scrollIntoViewIfNeeded();
    const inView = async () => laptop.locator('[data-side-cake] figure').first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight * 0.5 && r.left > 0; });
    check('laptop: the cake stays beside the controls while customizing', await inView());
    await laptop.locator('[data-next-price]').click();
    await laptop.locator('[data-stage="price"]').waitFor();
    await laptop.locator('[data-choose-baker]').scrollIntoViewIfNeeded();
    check('laptop: the cake stays beside the designs on the price step', await inView());
    await axe(laptop, 'laptop side by side');
    await shot(laptop, '05-laptop-side-by-side');

    // The cake made by hand in step 2 survives the price step: a budget never wipes it, the
    // other designs are built from it, and picking another design can be undone.
    await laptop.locator('[data-stage-nav="cake"]').click();
    await laptop.locator('[data-stage="cake"]').waitFor({ timeout: 5000 });
    {
      if (!(await laptop.locator('details[open] summary', { hasText: 'I-customize' }).count())) await laptop.getByText('I-customize').first().click();
      await laptop.getByRole('button', { name: /Sprinkles/ }).first().click();
      await laptop.getByRole('button', { name: /Buttercream rosettes/ }).first().click();
      const handMade = await laptop.evaluate(() => JSON.parse(sessionStorage.getItem('cakeita.draft.sample')).handPicked);
      await laptop.locator('[data-next-price]').click();
      await laptop.locator('[data-stage="price"]').waitFor();
      await laptop.getByRole('button', { name: '₱1,000 – ₱2,000' }).click();
      const stillMine = await laptop.evaluate(() => JSON.parse(sessionStorage.getItem('cakeita.draft.sample')).handPicked);
      check('a budget does not wipe the cake made by hand', !!handMade && JSON.stringify(handMade) === JSON.stringify(stillMine));
      const own = laptop.locator('[data-design]', { hasText: /Sarili mong design|Kapareho ng cake na ginawa mo/ });
      check('their own cake is one of the design cards', (await own.count()) === 1);
      const classicParts = await laptop.locator('[data-design="classic"]').innerText().catch(() => '');
      check('Classic is built from their decorations', /Sprinkles/.test(classicParts) || /Wala rito: .*Sprinkles/.test(classicParts), classicParts.replace(/\n+/g, ' / '));
      await laptop.locator('[data-design="simple"]').click();
      check('picking Simple keeps their own cake as a card', (await own.count()) === 1 && (await own.getAttribute('aria-checked')) === 'false');
      await own.click();
      const back = await laptop.evaluate(() => JSON.parse(sessionStorage.getItem('cakeita.draft.sample')));
      check('tapping their own cake brings it back', (await own.getAttribute('aria-checked')) === 'true' && JSON.stringify(back.handPicked) === JSON.stringify(handMade));
      check('design cards say what each one is', (await laptop.getByText('Simple lang, pinakamura').count()) === 1);
      await axe(laptop, 'designs with your own cake');
    }
    await laptop.context().close();

    // ---------------- Elder ----------------
    const elder = await phone(browser, 'elder', { reducedMotion: 'reduce' });
    await elder.goto(`${BASE}#/b/sample`);
    await elder.getByRole('button', { name: 'Mas malaking letra' }).click();
    const big = await waitTrue(async () => (await elder.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === '20px');
    check('elder mode enlarges text', big);
    await axe(elder, 'elder welcome');
    await shot(elder, '11-elder');

    // Language must survive a second tab (e.g. a link opened from Messenger).
    const tab2 = await elder.context().newPage();
    await tab2.goto(`${BASE}#/about`);
    await tab2.getByRole('button', { name: 'Switch to English' }).click();
    await elder.bringToFront();
    check('language picked in another tab reaches this tab', await waitTrue(() => elder.getByRole('button', { name: 'Lumipat sa Taglish' }).isVisible()));
    // Changing big text in the old tab must not write the old language back.
    await elder.getByRole('button', { name: 'Bigger text' }).click();
    await elder.reload();
    check('language stays after reload and other settings change', await waitTrue(() => elder.getByRole('button', { name: 'Lumipat sa Taglish' }).isVisible()));
    check('about page shows update history', await tab2.getByRole('heading', { name: /^v\d+\.\d+\.\d+/ }).first().isVisible());
    await axe(tab2, 'about + update history');
    await tab2.close();

    // ---------------- No WebGL / dev panel ----------------
    const tester = await phone(browser, 'tester');
    await tester.goto(`${BASE}?dev=1#/b/sample?dev=1`);
    await tester.getByRole('button', { name: 'Open developer panel' }).click();
    await tester.getByLabel('No WebGL (2D cake)').check();
    await tester.getByRole('button', { name: 'Fill + jump' }).click();
    await tester.getByRole('radiogroup', { name: 'Mga design' }).waitFor();
    check('dev panel jumps straight to designs', true);
    check('2D fallback renders when WebGL is off', (await tester.locator('canvas').count()) === 0 && (await tester.locator('svg[role="img"]').count()) > 0);
    await shot(tester, '12-dev-2d');
    // Request from a nearby baker on the map: their page shows the same price as the map card.
    await tester.goto(`${BASE}#/near`);
    const firstCard = tester.locator('article').first();
    await firstCard.waitFor();
    const cardPrice = (await firstCard.locator('.price').innerText()).trim();
    await firstCard.getByRole('button', { name: /^Mag-request kay/ }).click();
    await tester.getByTestId('live-price').waitFor();
    check('requesting from the map keeps the map price', (await tester.getByTestId('live-price').innerText()).trim() === cardPrice, cardPrice);
    check('map bakeries are labeled as samples', await tester.getByText('Sample bakery, demo data').first().isVisible());
    await tester.goto(`${BASE}#/o/fake?q=zzzz`);
    check('tampered quote link shows a friendly error', await waitTrue(() => tester.getByText('Hindi mabuksan ang quote').isVisible()));

    // Customization: placement presets, cake stands and things the customer brings.
    await tester.goto(`${BASE}#/b/sample`);
    await tester.locator('[data-stage-nav="idea"]').click().catch(() => {});
    await tester.getByLabel(/Ilarawan ang cake/).fill('2 tier wedding cake, fresh flowers, 40 pax, budget 6k');
    await tester.locator('[data-make-cake]').click();
    await tester.locator('[data-stage="cake"]').waitFor();
    await tester.getByText('I-customize').first().click();
    const place = tester.locator('[data-placement]');
    check('flower placement shows only when flowers are on the cake', await place.waitFor({ timeout: 10000 }).then(() => true, () => false));
    const first = (await tester.getByTestId('live-price').innerText()).trim();
    await place.getByRole('button', { name: 'Pababa sa gilid', exact: true }).click();
    await tester.waitForTimeout(300);
    const before = (await tester.getByTestId('live-price').innerText()).trim();
    check('placement changes the picture, not the price', /pababa/i.test((await tester.locator('figure [role="img"]').first().getAttribute('aria-label')) ?? '') && before === first, `${first} → ${before}`);
    await tester.locator('[data-stand]').getByRole('button', { name: /Gold na pedestal/ }).click();
    await tester.waitForTimeout(300);
    const withStand = (await tester.getByTestId('live-price').innerText()).trim();
    check('a priced cake stand adds to the price', withStand !== before, `${before} → ${withStand}`);
    await tester.locator('[data-stand]').getByRole('button', { name: /Sariling cake stand/ }).click();
    await tester.waitForTimeout(300);
    const ownPrice = (await tester.getByTestId('live-price').innerText()).trim();
    const ownNote = (await tester.locator('[data-own-note]').isVisible()) ? 1 : 0;
    check('own stand is free, replaces the priced one, and Customize stays open', ownPrice === before && ownNote === 1, `${ownPrice}, note ${ownNote}`);
    await tester.locator('[data-stage-nav="idea"]').click();
    await tester.locator('[data-inspo]').waitFor();
    check('step 1 has a big inspo photo upload', await tester.locator('[data-inspo]').getByText('Mag-upload ng inspo photo').isVisible());
    // Inspo photo becomes the 3D cake: with no AI key, the phone still reads its colors.
    const inspoPng = await tester.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 400; const g = c.getContext('2d');
      g.fillStyle = '#c4c4cc'; g.fillRect(0, 0, 400, 400);
      g.fillStyle = '#c9b3e6'; g.fillRect(90, 140, 220, 200);
      g.fillStyle = '#d4af37'; g.fillRect(90, 140, 220, 45);
      return c.toDataURL('image/png').split(',')[1];
    });
    await tester.locator('#photo').setInputFiles({ name: 'inspo.png', mimeType: 'image/png', buffer: Buffer.from(inspoPng, 'base64') });
    await tester.locator('[data-make-cake]').click();
    check('reading a photo shows the animated "building your cake" steps', await tester.locator('[data-photo-building]').waitFor({ timeout: 5000 }).then(() => true, () => false));
    const match = tester.locator('[data-photo-match]');
    check('inspo photo turns into the cake (colors read on the phone, no AI)', await match.waitFor({ timeout: 10000 }).then(() => true, () => false) && /lavender/.test(await match.innerText()) && /lavender/i.test((await tester.locator('figure [role="img"]').first().getAttribute('aria-label')) ?? ''));
    await axe(tester, 'cake from inspo photo');
    await axe(tester, 'customize with placement and stands');

    // Block-game cake from words: generic blocky figures (no game characters), the child's name on a banner, the age as a number.
    const gamer = await phone(browser, 'gamer');
    await gamer.goto(`${BASE}#/b/sample`);
    await gamer.getByLabel(/Ilarawan ang cake/).fill("Roblox cake for Migo's 7th birthday, sky blue fondant, brick wall, name banner, number topper, 12 pax");
    await gamer.locator('[data-make-cake]').click();
    await gamer.getByTestId('live-price').waitFor();
    const gameCake = gamer.locator('figure [role="img"]').first();
    await waitTrue(async () => /MIGO/.test((await gameCake.getAttribute('aria-label')) ?? ''));
    const gameLabel = (await gameCake.getAttribute('aria-label')) ?? '';
    check('block-game cake: name banner, age number, brick wall and blocky figures', /banner na "MIGO"/.test(gameLabel) && /numerong 7/.test(gameLabel) && /brick wall/.test(gameLabel) && /blocky/.test(gameLabel), gameLabel);
    check('block-game cake: no game name on the cake', !/roblox/i.test(gameLabel));
    check('block-game cake draws in 3D', await gamer.locator('figure canvas').first().waitFor({ timeout: 10000 }).then(() => true, () => false));
    await gamer.waitForTimeout(1500);
    await axe(gamer, 'block-game cake');
    // Stop drawing the 3D cake so the next checks get the whole (slow CI) CPU.
    await gamer.context().close();

    // Pilot survey: tap-only part 1, try the app, reminder to come back, part 2 (saved on the phone when offline).
    await tester.goto(`${BASE}#/survey?role=customer`);
    await tester.locator('[data-survey]').waitFor();
    const pick = async (name) => { await tester.getByRole('button', { name, exact: true }).click(); await tester.waitForTimeout(350); };
    await pick('2 hanggang 3');
    await tester.getByRole('button', { name: 'Home baker sa Facebook o IG' }).click();
    await tester.locator('[data-next]').click();
    await tester.getByRole('button', { name: 'Matagal maghintay ng presyo' }).click();
    await tester.getByRole('button', { name: 'Sobrang lampas sa budget ko' }).click();
    await tester.locator('[data-next]').click();
    await pick('Kinabukasan o mas matagal');
    // A double tap on the last answer must not save part 1 twice (it did at the booth).
    await tester.getByRole('button', { name: 'Oo', exact: true }).dblclick();
    await tester.waitForTimeout(350);
    check('survey part 1 takes only taps and leads to trying the app', await tester.locator('[data-survey-try]').waitFor({ timeout: 15000 }).then(() => true, () => false));
    check('survey answers wait on the phone when offline', await tester.getByText(/Naka-save sa phone na ito/).isVisible());
    const tryHere = tester.locator('[data-survey-try]');
    await tryHere.getByLabel(/Ang cake mo, kasama ang budget/).fill('Chocolate cake with sprinkles, 12 pax, budget 900');
    check('people try the app inside the survey: a cake and 3 prices, no leaving', (await tryHere.locator('figure [role="img"]').count()) >= 1 && (await tryHere.getByRole('radio').count()) >= 2 && (await tryHere.locator('[data-part2]').isVisible()));
    await axe(tester, 'survey: try it here');
    // Those who open the full app get a reminder bar, and a pop-up after a while (shortened for the test).
    await tester.evaluate(() => localStorage.setItem('cakeita.survey.promptMs', '1500'));
    await tester.locator('[data-try-it] details summary').click();
    await tester.locator('[data-try-link]').click();
    await tester.locator('[data-open-designer]').first().waitFor();
    check('reminder to finish the survey shows while trying', await tester.locator('[data-survey-nudge]').isVisible());
    check('after a while of trying, a pop-up asks for the last taps', await tester.locator('[data-survey-prompt]').waitFor({ timeout: 6000 }).then(() => true, () => false));
    await axe(tester, 'survey pop-up');
    await tester.getByRole('button', { name: 'Mamaya' }).click();
    check('the pop-up can be closed and stays closed', (await tester.locator('[data-survey-prompt]').count()) === 0);
    await tester.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await tester.waitForTimeout(400);
    check('the survey reminder stays on screen while scrolling', await tester.locator('[data-survey-nudge]').evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= 200; }));
    await tester.goto(quoteUrl);
    await tester.getByRole('heading', { name: /ito ang quote mo/ }).waitFor();
    check('a "finish the survey" card shows when a quote arrives', await tester.locator('[data-survey-finish]').isVisible());
    await axe(tester, 'quote with survey finish card');
    await tester.locator('[data-survey-finish] a').click();
    await pick('Oo, malaki');
    await pick('Kaunti');
    await pick('Oo');
    await tester.locator('[data-next]').click();
    check('survey part 2 finishes with a share QR', await tester.locator('[data-survey-done] img').waitFor({ timeout: 20000 }).then(() => true, () => false));
    const outbox = await tester.evaluate(() => JSON.parse(localStorage.getItem('cakeita.outbox.v1') || '[]'));
    check('both survey parts are kept for sending, linked but anonymous', outbox.length === 2 && outbox[0].entry.ref === outbox[1].entry.ref && outbox[1].entry.answers.see3d === 'lot', JSON.stringify(outbox.map((o) => o.entry.part)));
    check('a double tap saves each part once, under one id per person and part', /p1$/.test(outbox[0].id) && /p2$/.test(outbox[1].id), outbox.map((o) => o.id).join(' '));
    await axe(tester, 'survey');
    await tester.locator('[data-survey-next-person]').click();
    check('"next person" starts a fresh survey on a shared phone', await tester.locator('[data-role="customer"]').isVisible() && (await tester.evaluate((r) => JSON.parse(localStorage.getItem('cakeita.survey.v1') || 'null')?.ref !== r, outbox[0].entry.ref)));
    await tester.goto(`${BASE}#/near`);
    await tester.locator('[data-footer-feedback]').click();
    await tester.locator('[data-send-feedback]').click();
    check('feedback asks what it is about first', await tester.getByRole('alert').isVisible());
    await tester.getByRole('button', { name: 'May sira' }).click();
    await tester.getByLabel('Message mo').fill('Hindi lumalabas ang mapa');
    await tester.locator('[data-send-feedback]').click();
    await tester.locator('[data-feedback-done]').waitFor();
    const fbItem = (await tester.evaluate(() => JSON.parse(localStorage.getItem('cakeita.outbox.v1') || '[]'))).at(-1);
    check('feedback from any page records where it came from', fbItem?.entry.kind === 'feedback' && fbItem.entry.page === '/near', fbItem?.entry.page);
    await axe(tester, 'feedback');
    // The survey link on the feedback page follows this phone's survey: here, a new person.
    await tester.goto(`${BASE}#/feedback`);
    await tester.reload();
    check('feedback page: survey link starts a fresh survey for the next person', await tester.locator('[data-survey-link="start"]').waitFor({ timeout: 5000 }).then(() => true, () => false));


    // ---------------- Choose a baker, counter-offers, sample bakers that answer ----------------
    // Phones that are done close first: their 3D cakes keep drawing in software GL and starve a slow CI machine.
    for (const done of [customer, elder, tester]) await done.context().close();
    const picker = await phone(browser, 'picker');
    await picker.goto(`${BASE}#/demo`); // the guided demo unlocks the two-phone "send straight to the demo bakery" link
    await picker.getByRole('link', { name: /Mag-order bilang customer/ }).waitFor();
    await picker.goto(`${BASE}#/b/sample`);
    await picker.getByLabel(/Ilarawan ang cake/).fill('Ube birthday cake with drip and sprinkles, 20 pax, budget 1200');
    await picker.locator('[data-make-cake]').click();
    await picker.locator('[data-next-price]').click();
    await picker.locator('[data-quick-date]').nth(2).click();
    await picker.getByLabel('Pangalan mo').fill('Carla Test');
    await picker.getByLabel(/Messenger name o mobile/).fill('0917 222 3333');
    await picker.locator('[data-choose-baker]').click();
    await picker.getByRole('heading', { name: /Piliin kung sino/ }).waitFor();
    check('after designing, bakers are ranked with a best match', (await picker.locator('[data-best-match]').count()) === 1 && (await picker.locator('article').first().locator('[data-best-match]').count()) === 1);
    await picker.waitForTimeout(800);
    await axe(picker, 'choose a baker');
    await shot(picker, '14-choose-baker');
    const firstName = (await picker.locator('article h3').first().innerText()).trim();
    await picker.locator('article').first().locator('[data-send-to]').click();
    check('request goes straight to the chosen baker', await picker.locator('[data-waiting-auto]').waitFor({ timeout: 8000 }).then(() => true, () => false), firstName);
    check('sample baker answers by itself', await picker.locator('[data-quote-price]').waitFor({ timeout: 20000 }).then(() => true, () => false));
    check('an over-budget answer shows as their counter-offer', (await picker.locator('[data-counter]').count()) === 1);
    const pPrice = Number((await picker.locator('[data-quote-price]').innerText()).replace(/[^\d]/g, ''));
    await picker.locator('[data-offer-open]').click();
    await picker.getByLabel(/Presyo mo/).fill(String(pPrice + 50));
    await picker.locator('[data-send-offer]').click();
    check('offer must be lower than the quote', await picker.getByText(/Dapat mas mababa/).isVisible());
    await picker.getByLabel(/Presyo mo/).fill(String(pPrice - 50));
    await axe(picker, 'counter-offer form');
    await picker.locator('[data-send-offer]').click();
    check('customer offer waits for the baker', await picker.locator('[data-offer-pending]').isVisible());
    check('sample baker answers the offer (final)', await picker.waitForFunction(() => !document.querySelector('[data-offer-pending]'), null, { timeout: 10000 }).then(() => true, () => false));
    check('only one offer per quote', (await picker.locator('[data-offer-open]').count()) === 0);
    await shot(picker, '15-offer-answered');
    await picker.getByRole('button', { name: /Ito ang gusto ko/ }).click();
    check('confirming a sample bakery says no real order was made', await picker.getByText(/walang totoong order/).isVisible());
    await picker.goto(`${BASE}#/near?from=sample`);
    check(
      'the chosen baker shows as already asked',
      await picker.locator('[data-asked]').first().waitFor({ timeout: 15000 }).then(() => true, () => false),
      await picker.evaluate(() => JSON.stringify({ my: JSON.parse(localStorage.getItem('cakeita.db.v1') || '{}').myRequests?.map((r) => [r.bakerySlug, r.eventDate, r.status]), date: JSON.parse(sessionStorage.getItem('cakeita.draft.sample') || '{}').eventDate, from: JSON.parse(localStorage.getItem('cakeita.db.v1') || '{}').myRequests?.map((r) => r.fromSlug), asked: document.querySelectorAll('[data-asked]').length, url: location.hash, cards: [...document.querySelectorAll('[data-baker-card]')].map((e) => e.getAttribute('data-baker-card')).slice(0, 3) })),
    );
    // A date too soon for a baker: they say no with a reason, and the customer picks another.
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    await picker.goto(`${BASE}#/b/sample`);
    await picker.locator('#date').fill(`${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`);
    await picker.locator('[data-choose-baker]').click();
    await picker.getByRole('heading', { name: /Piliin kung sino/ }).waitFor();
    await picker.locator('[data-filters] summary').click();
    await picker.getByRole('button', { name: 'Kahit gaano kalayo' }).click();
    await picker.getByLabel('Yung kaya lang gawin').uncheck();
    await picker.locator('article', { hasText: 'masyadong maaga' }).first().locator('[data-send-to]').click();
    check('a baker who can\'t make it says no with a reason', await picker.locator('[data-declined]').waitFor({ timeout: 10000 }).then(() => true, () => false) && (await picker.getByText(/araw na abiso/).isVisible()));
    await axe(picker, 'declined request');
    await picker.locator('[data-choose-another]').click();
    check('"choose another baker" goes back to the ranked list', await picker.getByRole('heading', { name: /Piliin kung sino/ }).waitFor({ timeout: 8000 }).then(() => true, () => false));

    // Counter-offer over Messenger links (no cloud): baker counters, customer offers once, baker accepts.
    await picker.goto(`${BASE}#/b/sample`);
    check('the phone remembers the customer: name and contact show as one line', await picker.locator('[data-me-summary]').getByText('Carla Test').isVisible());
    await picker.locator('[data-quick-date]').nth(1).click();
    await picker.locator('[data-send-direct]').click();
    await picker.getByRole('heading', { name: /Ipadala na sa baker/ }).waitFor();
    const req2 = await linkFromShareBox(picker);
    await baker.goto(req2);
    await baker.getByRole('heading', { name: 'Carla Test' }).waitFor();
    const est2 = Number(((await baker.locator('[data-app-estimate]').innerText()).match(/₱([\d,]+)/) ?? ['', '0'])[1].replace(/,/g, ''));
    await baker.getByLabel(/Presyong ipapadala/).fill(String(est2 + 200));
    check('a different price is sent as the baker\'s counter-offer', await baker.getByRole('button', { name: /Ipadala ang alok na ₱/ }).isVisible());
    await baker.getByRole('button', { name: /Ipadala ang alok na ₱/ }).click();
    await baker.getByText('Ipadala ang quote sa customer').waitFor();
    const q2 = await linkFromShareBox(baker);
    await picker.goto(q2);
    await picker.locator('[data-counter]').waitFor();
    await picker.locator('[data-offer-open]').click();
    await picker.getByLabel(/Presyo mo/).fill(String(est2));
    await picker.locator('[data-send-offer]').click();
    await picker.locator('[data-offer-pending]').waitFor();
    const offerUrl = await linkFromShareBox(picker);
    check('offer link made for Messenger', !!offerUrl && offerUrl.includes('#/baker/import?o='));
    await baker.goto(offerUrl);
    check('baker sees the offer with their margin', await baker.locator('[data-offer-card]').waitFor({ timeout: 8000 }).then(() => true, () => false) && (await baker.getByText(/Tubo mo sa presyo nila/).isVisible()));
    await axe(baker, 'offer card');
    await baker.locator('[data-offer-accept]').click();
    await baker.getByText('Ipadala ang quote sa customer').waitFor();
    const q3 = await linkFromShareBox(baker);
    await picker.goto(q3);
    check('customer sees the accepted offer at their price', await picker.getByText('Pumayag sila sa alok mo').waitFor({ timeout: 8000 }).then(() => true, () => false) && Number((await picker.locator('[data-quote-price]').innerText()).replace(/[^\d]/g, '')) === est2);

    for (const p of [customer, baker, elder, tester, picker, gamer]) check(`no JS errors on ${p.label} phone`, p.errors.length === 0, p.errors.slice(0, 3).join(' | '));
    await browser.close();
  } finally {
    server.kill();
  }
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
