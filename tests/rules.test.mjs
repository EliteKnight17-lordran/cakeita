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

await t('customer saves own My cakes', assertSucceeds(setDoc(doc(ben, 'users/benUid0000001'), { myRequests: '[]', updatedAt: now })));
await t('others cannot read it', assertFails(getDoc(doc(ana, 'users/benUid0000001'))));
await t('baker saves alert phones', assertSucceeds(setDoc(doc(ana, 'push/anaUid0000001'), { subs: '[]', updatedAt: now })));
await t('notify function can read them by id', assertSucceeds(getDoc(doc(anon, 'push/anaUid0000001'))));
await t('nobody can list alert phones', assertFails(getDocs(collection(anon, 'push'))));
await t('cannot set someone else\'s alert phones', assertFails(setDoc(doc(ben, 'push/anaUid0000001'), { subs: '[]', updatedAt: now })));
await t('alert list size limited', assertFails(setDoc(doc(ana, 'push/anaUid0000001'), { subs: 'x'.repeat(8001), updatedAt: now })));
await t('baker deletes own menu', assertSucceeds(deleteDoc(doc(ana, 'menus/ana-bakes'))));

await env.cleanup();
console.log(fails ? `${fails} rule checks FAILED` : 'all rule checks passed');
process.exit(fails ? 1 : 0);
