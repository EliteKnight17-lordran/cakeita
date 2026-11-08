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

    await customer.goto(`${BASE}#/b/sample`);
    // One page: no Next buttons. Designs are there before anything is typed.
    check('order form is one page (no Next button)', (await customer.getByRole('button', { name: 'Sunod' }).count()) === 0);
    const designGroup = customer.getByRole('radiogroup', { name: 'Mga design' });
    const cards = designGroup.getByRole('radio');
    check('designs show before typing anything', await cards.first().waitFor({ timeout: 20000 }).then(() => true, () => false));
    await customer.getByLabel(/Ilarawan ang cake/).fill('2 tier pink ube cake with chocolate drip and fresh flowers, "Happy 7th Mia"');
    await customer.getByRole('button', { name: /Birthday/ }).click();
    await customer.getByRole('button', { name: '30 tao' }).click();
    await customer.getByRole('button', { name: '₱2,500' }).click();
    await customer.locator('[data-quick-date]').first().click();
    check('customer sees 2-3 designs', (await cards.count()) >= 2, `${await cards.count()} designs`);
    check('designs show budget fit labels', (await customer.getByText('Pasok sa budget').count()) >= 1);
    check('unofficial understanding shown live', await customer.getByText('Ang naintindihan namin').isVisible());
    check('sticky price shows while filling in', await customer.getByTestId('live-price').isVisible());
    await customer.waitForTimeout(1200);
    await axe(customer, 'customer one-page form');
    await shot(customer, '02-designs');

    await customer.getByText('I-customize').first().click();
    const priceBefore = await customer.getByTestId('live-price').innerText();
    await customer.getByRole('button', { name: /Sprinkles/ }).click();
    const priceAfter = await customer.getByTestId('live-price').innerText();
    check('adding sprinkles re-prices live', priceBefore !== priceAfter, `${priceBefore} → ${priceAfter}`);
    await customer.waitForTimeout(1000);
    await shot(customer, '03-customize');

    // Nearby bakers map: same cake, each baker's own price.
    await customer.getByRole('link', { name: /Ikumpara ang malapit na baker/ }).click();
    await customer.getByRole('heading', { name: /Mga baker na malapit/ }).waitFor();
    check('map loads with price pins', await waitTrue(async () => (await customer.locator('.leaflet-marker-icon .pin').count()) >= 2), `${await customer.locator('.leaflet-marker-icon .pin').count()} pins`);
    const requestButtons = customer.getByRole('button', { name: /^Mag-request kay/ });
    check('map lists bakers who can make it', (await requestButtons.count()) >= 1, `${await requestButtons.count()} bakers`);
    const pinPrices = await customer.locator('.leaflet-marker-icon .pin').allInnerTexts();
    check('pins show peso estimates', pinPrices.every((t) => /^₱[\d,]+$/.test(t.trim())), pinPrices.join(' '));
    await customer.getByRole('button', { name: 'Kahit gaano kalayo' }).click();
    await customer.getByLabel('Yung kaya lang gawin').uncheck();
    check('unticking shows bakers who cannot make all of it', await waitTrue(async () => (await customer.getByText(/Hindi gumagawa ng|masyadong maaga/).count()) >= 1));
    await customer.waitForTimeout(800);
    await axe(customer, 'nearby bakers map');
    await shot(customer, '13-near-map');
    await customer.goBack();
    await designGroup.waitFor();
    check('cake survives the trip to the map and back', (await customer.getByLabel(/Ilarawan ang cake/).inputValue()).includes('Happy 7th Mia'));

    await customer.getByRole('button', { name: /Ipadala sa baker/ }).click();
    check('send blocks empty name', await customer.getByText(/Pakilagay ang pangalan/).isVisible());
    await customer.getByLabel('Pangalan mo').fill('Ana Test');
    await customer.getByLabel(/Messenger name o mobile/).fill('0917 123 4567');
    await customer.locator('#consent').check();
    await axe(customer, 'customer contact');
    await customer.getByRole('button', { name: /Ipadala sa baker/ }).click();
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
    check('baker sees approve button', await baker.getByRole('button', { name: /I-approve ₱/ }).isVisible());
    await baker.getByLabel(/Presyong ipapadala/).fill('500');
    check('red warning for a losing price', await baker.getByText('Lugi ka rito').isVisible());
    await baker.getByLabel(/Presyong ipapadala/).fill('');
    await baker.waitForTimeout(800);
    await axe(baker, 'baker approval card');
    await shot(baker, '05-approval');
    await baker.getByRole('button', { name: /I-approve ₱/ }).click();
    await baker.getByText('Ipadala ang quote sa customer').waitFor();
    const quoteUrl = await linkFromShareBox(baker);
    check('quote link created', !!quoteUrl && quoteUrl.includes('#/o/'));

    // ---------------- Customer gets quote ----------------
    await customer.goto(quoteUrl);
    await customer.getByRole('heading', { name: /ito ang quote mo/ }).waitFor();
    check('customer quote shows payment safety note', await customer.getByText('Tungkol sa bayad').isVisible());
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
    check('trademark swapped and licensed topper note shown', await baker.getByText(/licensed topper/).isVisible());
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
    await axe(baker, 'baker insights');
    await shot(baker, '10-insights');

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

    for (const p of [customer, baker, elder, tester]) check(`no JS errors on ${p.label} phone`, p.errors.length === 0, p.errors.slice(0, 3).join(' | '));
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
