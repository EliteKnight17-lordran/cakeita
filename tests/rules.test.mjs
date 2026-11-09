/**
 * Firestore security rules test. Needs the Firestore emulator:
 *   npx firebase-tools emulators:exec --only firestore --project demo-cakeita "node tests/rules.test.mjs"
 */
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-cakeita',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();

let fails = 0;
async function t(name, p) {
  try {
    await p;
    console.log(`✓ ${name}`);
  } catch (e) {
    fails++;
    console.log(`✗ ${name} — ${e.message?.split('\n')[0]}`);
  }
}

const now = new Date().toISOString();
const ana = env.authenticatedContext('anaUid0000001').firestore();
const ben = env.authenticatedContext('benUid0000001').firestore();
const anon = env.unauthenticatedContext().firestore();
const menu = (owner, slug, extra = {}) => ({ ownerUid: owner, slug, name: 'Ana Bakes', listed: true, lat: 14.6, lng: 121.0, area: 'QC', deliveryKm: 5, menu: '{}', updatedAt: now, ...extra });

await t('baker saves own private bakery', assertSucceeds(setDoc(doc(ana, 'bakeries/anaUid0000001'), { data: '{}', slug: 'ana-bakes', updatedAt: now })));
await t('nobody else reads it', assertFails(getDoc(doc(ben, 'bakeries/anaUid0000001'))));
await t('customers cannot read it', assertFails(getDoc(doc(anon, 'bakeries/anaUid0000001'))));
await t('cannot write someone else\'s bakery', assertFails(setDoc(doc(ben, 'bakeries/anaUid0000001'), { data: '{}', slug: 'x', updatedAt: now })));
await t('extra fields rejected', assertFails(setDoc(doc(ana, 'bakeries/anaUid0000001'), { data: '{}', slug: 'a', updatedAt: now, admin: true })));

await t('baker claims a link name', assertSucceeds(setDoc(doc(ana, 'menus/ana-bakes'), menu('anaUid0000001', 'ana-bakes'))));
await t('anyone reads menus', assertSucceeds(getDoc(doc(anon, 'menus/ana-bakes'))));
await t('map query works for anyone', assertSucceeds(getDocs(query(collection(anon, 'menus'), where('listed', '==', true)))));
await t('someone else cannot take the link name', assertFails(setDoc(doc(ben, 'menus/ana-bakes'), menu('benUid0000001', 'ana-bakes'))));
await t('cannot create a menu in someone else\'s name', assertFails(setDoc(doc(ben, 'menus/ben-bakes'), menu('anaUid0000001', 'ben-bakes'))));
await t('bad slug rejected', assertFails(setDoc(doc(ben, 'menus/Bad Slug'), menu('benUid0000001', 'Bad Slug'))));
await t('silly map pin rejected', assertFails(setDoc(doc(ana, 'menus/ana-bakes'), menu('anaUid0000001', 'ana-bakes', { lat: 500 }))));

const reqDoc = (bakerUid, slug = 'ana-bakes') => ({ bakerUid, slug, req: '{}', createdAt: now });
await t('customer (no account) sends a request', assertSucceeds(setDoc(doc(anon, 'requests/rq-abc123def456'), reqDoc('anaUid0000001'))));
await t('request to a bakery that is not theirs rejected', assertFails(setDoc(doc(anon, 'requests/rq-x2'), reqDoc('benUid0000001'))));
await t('request to unknown bakery rejected', assertFails(setDoc(doc(anon, 'requests/rq-x3'), reqDoc('anaUid0000001', 'nope'))));
await t('customer cannot overwrite a request', assertFails(setDoc(doc(anon, 'requests/rq-abc123def456'), reqDoc('anaUid0000001'))));
await t('baker reads own inbox', assertSucceeds(getDocs(query(collection(ana, 'requests'), where('bakerUid', '==', 'anaUid0000001')))));
await t('another baker cannot read it', assertFails(getDocs(query(collection(ben, 'requests'), where('bakerUid', '==', 'anaUid0000001')))));
await t('customers cannot read requests', assertFails(getDoc(doc(anon, 'requests/rq-abc123def456'))));
const jpg = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
await t('request with an inspo photo', assertSucceeds(setDoc(doc(anon, 'requests/rq-photo1'), { ...reqDoc('anaUid0000001'), photo: jpg })));
await t('photo must be a JPEG data URL', assertFails(setDoc(doc(anon, 'requests/rq-photo2'), { ...reqDoc('anaUid0000001'), photo: 'https://evil.example/x.jpg' })));
await t('oversized photo rejected', assertFails(setDoc(doc(anon, 'requests/rq-photo3'), { ...reqDoc('anaUid0000001'), photo: 'data:image/jpeg;base64,' + 'A'.repeat(400000) })));
await t('request can carry the customer\'s alert phone', assertSucceeds(setDoc(doc(anon, 'requests/rq-notif1'), { ...reqDoc('anaUid0000001'), notify: '{"endpoint":"https://x"}' })));
await t('baker reads the photo', assertSucceeds(getDoc(doc(ana, 'requests/rq-photo1'))));
await t('oversized request rejected', assertFails(setDoc(doc(anon, 'requests/rq-big'), { ...reqDoc('anaUid0000001'), req: 'x'.repeat(20001) })));

await t('baker publishes a quote', assertSucceeds(setDoc(doc(ana, 'quotes/rq-abc123def456'), { bakerUid: 'anaUid0000001', quote: '{}', updatedAt: now })));
await t('customer opens the quote by id', assertSucceeds(getDoc(doc(anon, 'quotes/rq-abc123def456'))));
await t('nobody can list all quotes', assertFails(getDocs(collection(anon, 'quotes'))));
await t('another baker cannot change the quote', assertFails(setDoc(doc(ben, 'quotes/rq-abc123def456'), { bakerUid: 'benUid0000001', quote: '{}', updatedAt: now })));
await t('customers cannot write quotes', assertFails(setDoc(doc(anon, 'quotes/rq-new'), { bakerUid: 'anaUid0000001', quote: '{}', updatedAt: now })));

await t('customer confirms a real quote', assertSucceeds(setDoc(doc(anon, 'confirmations/rq-abc123def456'), { bakerUid: 'anaUid0000001', conf: '{}', createdAt: now })));
await t('confirm only once', assertFails(setDoc(doc(anon, 'confirmations/rq-abc123def456'), { bakerUid: 'anaUid0000001', conf: '{}', createdAt: now })));
await t('cannot confirm without a quote', assertFails(setDoc(doc(anon, 'confirmations/rq-none'), { bakerUid: 'anaUid0000001', conf: '{}', createdAt: now })));
await t('baker reads confirmations', assertSucceeds(getDocs(query(collection(ana, 'confirmations'), where('bakerUid', '==', 'anaUid0000001')))));
await t('others cannot read confirmations', assertFails(getDoc(doc(anon, 'confirmations/rq-abc123def456'))));
// One counter-offer per quote, for the quote's baker only.
await t('offer must go to the quote baker', assertFails(setDoc(doc(anon, 'offers/rq-abc123def456'), { bakerUid: 'benUid0000001', offer: '{}', createdAt: now })));
await t('offer has no extra fields', assertFails(setDoc(doc(anon, 'offers/rq-abc123def456'), { bakerUid: 'anaUid0000001', offer: '{}', createdAt: now, price: 1 })));
await t('customer sends one offer on a real quote', assertSucceeds(setDoc(doc(anon, 'offers/rq-abc123def456'), { bakerUid: 'anaUid0000001', offer: '{}', createdAt: now })));
await t('only one offer per quote', assertFails(setDoc(doc(anon, 'offers/rq-abc123def456'), { bakerUid: 'anaUid0000001', offer: '{}', createdAt: now })));
await t('baker sends the finished-cake photo', assertSucceeds(setDoc(doc(ana, 'ready/rq-abc123def456'), { bakerUid: 'anaUid0000001', photo: jpg, at: now })));
await t('customer opens the ready photo by id', assertSucceeds(getDoc(doc(anon, 'ready/rq-abc123def456'))));
await t('nobody can list ready photos', assertFails(getDocs(collection(anon, 'ready'))));
await t('another baker cannot post a ready photo', assertFails(setDoc(doc(ben, 'ready/rq-abc123def456'), { bakerUid: 'benUid0000001', photo: jpg, at: now })));
await t('customers cannot post a ready photo', assertFails(setDoc(doc(anon, 'ready/rq-abc123def456'), { bakerUid: 'anaUid0000001', photo: jpg, at: now })));
await t('ready photo must be a JPEG data URL', assertFails(setDoc(doc(ana, 'ready/rq-abc123def456'), { bakerUid: 'anaUid0000001', photo: 'https://x.y/z.jpg', at: now })));
await t('no ready photo without a quote', assertFails(setDoc(doc(ana, 'ready/rq-none'), { bakerUid: 'anaUid0000001', photo: jpg, at: now })));
await t('cannot offer without a quote', assertFails(setDoc(doc(anon, 'offers/rq-none'), { bakerUid: 'anaUid0000001', offer: '{}', createdAt: now })));
await t('baker reads offers', assertSucceeds(getDocs(query(collection(ana, 'offers'), where('bakerUid', '==', 'anaUid0000001')))));
await t('others cannot read offers', assertFails(getDoc(doc(anon, 'offers/rq-abc123def456'))));

await t('customer saves own My cakes', assertSucceeds(setDoc(doc(ben, 'users/benUid0000001'), { myRequests: '[]', updatedAt: now })));
await t('others cannot read it', assertFails(getDoc(doc(ana, 'users/benUid0000001'))));
await t('baker saves alert phones', assertSucceeds(setDoc(doc(ana, 'push/anaUid0000001'), { subs: '[]', updatedAt: now })));
await t('notify function can read them by id', assertSucceeds(getDoc(doc(anon, 'push/anaUid0000001'))));
await t('nobody can list alert phones', assertFails(getDocs(collection(anon, 'push'))));
await t('cannot set someone else\'s alert phones', assertFails(setDoc(doc(ben, 'push/anaUid0000001'), { subs: '[]', updatedAt: now })));
await t('alert list size limited', assertFails(setDoc(doc(ana, 'push/anaUid0000001'), { subs: 'x'.repeat(8001), updatedAt: now })));
// Reviews: a private ticket proves a quoted + confirmed order; the public review never shows the order id.
const cara = env.authenticatedContext('caraUid000001').firestore();
const tk = (uid, extra = {}) => ({ orderId: 'rq-abc123def456', bakerUid: 'anaUid0000001', slug: 'ana-bakes', uid, createdAt: now, ...extra });
const T1 = 'tkCara0000000000000001';
await t('customer gets a review ticket for a confirmed order', assertSucceeds(setDoc(doc(cara, `reviewTickets/${T1}`), tk('caraUid000001'))));
await t('nobody can read tickets (order id stays private)', assertFails(getDoc(doc(cara, `reviewTickets/${T1}`))));
await t('ticket needs a confirmation', assertFails(setDoc(doc(ben, 'reviewTickets/tkBen00000000000000001'), tk('benUid0000001', { orderId: 'rq-photo1' }))));
await t('ticket needs a real quote', assertFails(setDoc(doc(ben, 'reviewTickets/tkBen00000000000000002'), tk('benUid0000001', { orderId: 'rq-none' }))));
await t('ticket must name the quote baker', assertFails(setDoc(doc(ben, 'reviewTickets/tkBen00000000000000003'), tk('benUid0000001', { bakerUid: 'benUid0000001' }))));
await t('ticket is for yourself only', assertFails(setDoc(doc(ben, 'reviewTickets/tkBen00000000000000004'), tk('caraUid000001'))));
await t('baker cannot get a ticket for their own bakery', assertFails(setDoc(doc(ana, 'reviewTickets/tkAna00000000000000001'), tk('anaUid0000001'))));
await t('ticket needs an account', assertFails(setDoc(doc(anon, 'reviewTickets/tkAnon0000000000000001'), tk('x'))));
const rev = (extra = {}) => ({ bakerUid: 'anaUid0000001', slug: 'ana-bakes', ticket: T1, stars: 5, text: 'Ang sarap!', name: 'Cara D.', createdAt: now, ...extra });
await t('customer posts a review with their ticket', assertSucceeds(setDoc(doc(cara, 'reviews/caraUid000001_ana-bakes'), rev())));
await t('anyone reads reviews for a bakery', assertSucceeds(getDocs(query(collection(anon, 'reviews'), where('slug', 'in', ['ana-bakes'])))));
await t('one review per customer per bakery', assertFails(setDoc(doc(cara, 'reviews/caraUid000001_ana-bakes'), rev({ stars: 1 }))));
await t('someone else cannot use your ticket', assertFails(setDoc(doc(ben, 'reviews/benUid0000001_ana-bakes'), rev())));
await t('review needs a ticket', assertFails(setDoc(doc(ben, 'reviews/benUid0000001_ana-bakes'), rev({ ticket: 'tkMissing000000000000001' }))));
await t('review id must be the reviewer', assertFails(setDoc(doc(ben, 'reviews/caraUid000001_x'), rev({ slug: 'x' }))));
await t('review cannot carry the order id', assertFails(setDoc(doc(cara, 'reviews/caraUid000001_ana-bakes2'), rev({ slug: 'ana-bakes2', orderId: 'rq-abc123def456' }))));
const T2 = 'tkCara0000000000000002';
await setDoc(doc(cara, `reviewTickets/${T2}`), tk('caraUid000001'));
await t('ticket and review must be the same bakery', assertFails(setDoc(doc(cara, 'reviews/caraUid000001_ben-bakes'), rev({ ticket: T2, slug: 'ben-bakes' }))));
await t('stars are 1 to 5 whole numbers', assertFails(setDoc(doc(cara, 'reviews/caraUid000001_ana-bakes'), rev({ ticket: T2, stars: 6 }))));
await t('baker cannot delete a review', assertFails(deleteDoc(doc(ana, 'reviews/caraUid000001_ana-bakes'))));
await t('nobody can edit a review', assertFails(setDoc(doc(cara, 'reviews/caraUid000001_ana-bakes'), rev({ stars: 1 }), { merge: true })));
await t('reviewer can delete their own review (account deletion)', assertSucceeds(deleteDoc(doc(cara, 'reviews/caraUid000001_ana-bakes'))));

await t('baker deletes own menu', assertSucceeds(deleteDoc(doc(ana, 'menus/ana-bakes'))));


const fb = (extra = {}) => ({ kind: 'customer', part: 1, ref: 'r-123', answers: '{"count":"1"}', page: '/survey', lang: 'tl', createdAt: now, ...extra });
await t('anyone can send a survey answer', assertSucceeds(setDoc(doc(anon, 'feedback/fb-abcdef123456'), fb())));
await t('survey answer cannot be changed', assertFails(setDoc(doc(anon, 'feedback/fb-abcdef123456'), fb({ ref: 'r-999' }))));
await t('survey answers are not public', assertFails(getDoc(doc(anon, 'feedback/fb-abcdef123456'))));
await t('signed-in non-admins cannot read answers', assertFails(getDocs(collection(ben, 'feedback'))));
await t('unknown kind rejected', assertFails(setDoc(doc(anon, 'feedback/fb-abcdef123457'), fb({ kind: 'spam' }))));
await t('extra fields rejected', assertFails(setDoc(doc(anon, 'feedback/fb-abcdef123458'), fb({ email: 'x@y.z' }))));
await t('oversized answers rejected', assertFails(setDoc(doc(anon, 'feedback/fb-abcdef123459'), fb({ answers: 'x'.repeat(4001) }))));
await t('nobody can make themselves admin', assertFails(setDoc(doc(ben, 'admins/benUid0000001'), { ok: true })));
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins/anaUid0000001'), { ok: true }); });
await t('admin checks own admin flag', assertSucceeds(getDoc(doc(ana, 'admins/anaUid0000001'))));
await t('admin reads answers', assertSucceeds(getDocs(collection(ana, 'feedback'))));
await t('others cannot read admin list', assertFails(getDoc(doc(ben, 'admins/anaUid0000001'))));

await env.cleanup();
console.log(fails ? `${fails} rule checks FAILED` : 'all rule checks passed');
process.exit(fails ? 1 : 0);
