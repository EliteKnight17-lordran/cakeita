/**
 * Star reviews, end to end, against local Firebase emulators (auth + firestore) and a Vite dev
 * server it starts itself. Run: npm run test:cloud
 * A baker lists a bakery and publishes a quote; a customer confirms, signs in, rates; the map
 * shows the rating; a second rating and order-id leaks are refused.
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const BASE = 'http://127.0.0.1:5174/';
const ok = (n, v, d = '') => { console.log(`${v ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); if (!v) process.exitCode = 1; };
const flags = () => { localStorage.setItem('cakeita.cloud', 'on'); localStorage.setItem('cakeita.emulator', '1'); };

(async () => {
  const vite = spawn('npx', ['vite', '--port', '5174', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
  process.on('exit', () => { try { process.kill(-vite.pid); } catch { /* gone */ } });
  for (let i = 0; i < 60; i++) {
    if (await fetch(BASE).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const b = await chromium.launch();
  const stamp = Date.now().toString(36);
  const slug = `ana-${stamp}`;

  // ---- Baker: account, listed bakery, approved quote in the cloud ----
  const bc = await b.newContext({ viewport: { width: 375, height: 800 } });
  await bc.addInitScript(flags);
  const bp = await bc.newPage();
  bp.on('pageerror', (e) => console.log('baker pageerror', String(e)));
  await bp.goto(BASE);
  const made = await bp.evaluate(async ({ slug }) => {
    const { loadCloud } = await import('/src/cloud/fb.ts');
    const data = await import('/src/cloud/data.ts');
    const { createSampleBakery } = await import('/src/domain/starterMenus.ts');
    const { requestToOrder, approveOrder, quoteLinkPayload } = await import('/src/domain/orders.ts');
    const { quoteLink } = await import('/src/lib/links.ts');
    const c = await loadCloud();
    const cred = await c.m.auth.createUserWithEmailAndPassword(c.auth, `baker-${slug}@test.dev`, 'secret123');
    const uid = cred.user.uid;
    const bakery = { ...createSampleBakery(), slug, name: 'Ana Test Bakes', isSample: false, cloudUid: uid, location: { lat: 14.6, lng: 121.0, area: 'QC', deliveryKm: 5, listed: true } };
    await data.saveBakery(uid, bakery);
    const req = { id: `rq-${slug}`, bakerySlug: slug, createdAt: new Date().toISOString(), customer: { name: 'Cara Dela Cruz', contact: '09170000000' }, occasion: 'Birthday', eventDate: '2026-12-01', servings: 12, budget: null, description: 'ube cake', tier: 'classic', selection: { baseCakeId: 'r6-2', componentIds: ['fl-ube', 'cv-buttercream'] }, look: { colors: [], textOnCake: '', candles: 0 }, theme: '', licensedNote: '', unavailable: [], estimate: null, hasInspoPhoto: false, lang: 'en', allergies: '' };
    const order = approveOrder(bakery, requestToOrder(req, 'cloud'), { selection: req.selection, look: req.look, price: 1200, note: '', validDays: 5 });
    const q = quoteLinkPayload(bakery, order);
    await data.publishQuote(uid, q);
    const { repo } = await import('/src/data/store.ts');
    repo.setBakery(bakery);
    return { uid, link: await quoteLink(q), orderId: req.id };
  }, { slug });
  ok('baker saved a listed bakery and published a quote', !!made.link);

  // ---- Customer: opens quote, confirms, signs in, rates ----
  const cc = await b.newContext({ viewport: { width: 375, height: 800 } });
  await cc.addInitScript(flags);
  const cp = await cc.newPage();
  cp.on('pageerror', (e) => console.log('customer pageerror', String(e)));
  await cp.goto(BASE);
  await cp.evaluate(async ({ slug, orderId }) => {
    const { repo } = await import('/src/data/store.ts');
    repo.addMyRequest({ id: orderId, bakerySlug: slug, bakeryName: 'Ana Test Bakes', createdAt: new Date().toISOString(), summary: 'ube cake', requestLink: 'x', status: 'quoted', cloud: true, auto: false, fromSlug: 'sample', eventDate: '2026-12-01', contact: '' });
  }, { slug, orderId: made.orderId });
  await cp.goto(made.link.replace(/^https?:\/\/[^/]+\//, BASE));
  await cp.getByRole('button', { name: /This is the one I want|Ito ang gusto ko/ }).click();
  const card = cp.locator('[data-review-card]');
  ok('after confirming, a rating card appears', await card.waitFor({ timeout: 10000 }).then(() => true, () => false));
  ok('signed out: it asks to sign in', await card.getByRole('link', { name: /Sign in to rate|Mag-sign in para mag-rate/ }).isVisible());
  // Rating before the baker has the confirmation would fail; wait until it exists by signing in now.
  await cp.evaluate(async ({ slug }) => {
    const { loadCloud } = await import('/src/cloud/fb.ts');
    const c = await loadCloud();
    await c.m.auth.createUserWithEmailAndPassword(c.auth, `cara-${slug}@test.dev`, 'secret123');
  }, { slug });
  await cp.locator('[data-star="5"]').waitFor({ timeout: 10000 });
  ok('signed in: stars show', true);
  await cp.locator('[data-star="4"]').click();
  await cp.getByLabel(/A few words|Ilang salita/).fill('On time and looked like the 3D cake');
  ok('says the public name is first name + initial', await card.getByText(/Cara C\./).isVisible());
  await cp.locator('[data-review-send]').click();
  ok('review posted', await cp.locator('[data-review-done]').waitFor({ timeout: 10000 }).then(() => true, () => false), await cp.locator('[data-review-card], [data-review-done]').first().innerText().catch(() => ''));
  await cp.reload();
  ok('after reload it remembers the review (one per bakery)', await cp.locator('[data-review-done]').waitFor({ timeout: 10000 }).then(() => true, () => false));

  // A second try by the same person is refused by the rules.
  const again = await cp.evaluate(async ({ slug, orderId }) => {
    const { currentUid } = await import('/src/cloud/account.ts');
    const data = await import('/src/cloud/data.ts');
    const { loadCloud } = await import('/src/cloud/fb.ts');
    const c = await loadCloud();
    try { await data.postReview(c.auth.currentUser.uid, { orderId, slug, stars: 1, text: 'spam', name: 'Cara D.' }); return 'posted'; } catch (e) { return String(e.code || e.message); }
  }, { slug, orderId: made.orderId });
  ok('a second review by the same customer is refused', again !== 'posted', again);

  // The public review never carries the order id.
  const pub = await cp.evaluate(async ({ slug }) => {
    const { loadCloud } = await import('/src/cloud/fb.ts');
    const c = await loadCloud();
    const { collection, getDocs, query, where } = c.m.fs;
    const s = await getDocs(query(collection(c.db, 'reviews'), where('slug', 'in', [slug])));
    return s.docs.map((d) => d.data());
  }, { slug });
  ok('public review has stars and no order id', pub.length === 1 && pub[0].stars === 4 && !JSON.stringify(pub).includes('rq-'), JSON.stringify(pub));

  // ---- Map: the real baker shows the rating ----
  const mp = await cc.newPage();
  await mp.goto(`${BASE}#/b/sample`);
  await mp.locator('[data-stage="idea"]').waitFor({ timeout: 20000 });
  await mp.getByLabel(/Describe|Ilarawan ang cake/).fill('ube cake for 12 people');
  await mp.locator('[data-make-cake]').click();
  await mp.locator('[data-next-price]').click();
  await mp.locator('[data-choose-baker]').click();
  await mp.getByLabel(/Your name|Pangalan mo/).fill('Cara Dela Cruz');
  await mp.getByLabel(/Messenger name|Messenger name o mobile/).fill('0917 000 0000');
  await mp.getByRole('button', { name: /Nob 16|Nov 16/ }).first().click();
  await mp.locator('[data-choose-baker]').click();
  const cardSel = mp.locator(`[data-baker-card="${slug}"]`);
  ok('the real baker is on the map list', await cardSel.waitFor({ timeout: 20000 }).then(() => true, () => false));
  ok('their card shows 4.0 (1 review)', await cardSel.locator('[data-rating]').waitFor({ timeout: 10000 }).then(async () => /4\.0\s*\(1 review/.test(await cardSel.locator('[data-rating]').innerText()), () => false));
  await cardSel.click();
  ok('selected card shows the review text with a confirmed-order label', await cardSel.locator('[data-reviews]').getByText(/On time/).isVisible().catch(() => false));
  await bp.goto(`${BASE}#/baker/insights`);
  ok('the baker sees the review on Insights', await bp.locator('[data-my-reviews]').getByText(/On time/).waitFor({ timeout: 10000 }).then(() => true, () => false));
  ok('sample shops show no ratings', (await mp.locator('[data-baker-card*="sample"] [data-rating]').count()) === 0);
  await b.close();
  console.log(process.exitCode ? 'cloud review checks FAILED' : 'all cloud review checks passed');
  process.exit();
})().catch((e) => { console.log('✗ crashed', e.message); process.exitCode = 1; process.exit(); });
