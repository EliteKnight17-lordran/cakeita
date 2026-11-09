import { cloudEnabled } from '../cloud/config';
import { normalizeSelection } from '../domain/designs';
import { formatPeso } from '../domain/money';
import { requestToOrder } from '../domain/orders';
import { ownText } from '../domain/placement';
import { cakeRequestSchema } from '../domain/schemas';
import type { CakeLook, CakeRequest, DesignTier, Handoff, PublicMenu, Selection } from '../domain/types';
import { isAutoBaker } from '../data/sampleBakers';
import { newId, repo } from '../data/store';
import type { SmallImage } from '../lib/image';
import { handoffText } from '../lib/dates';
import { requestLink } from '../lib/links';
import { sendNotify } from '../push/client';

type Tx = (en: string, tl: string) => string;

export interface RequestParts {
  /** The baker it goes to. */
  menu: PublicMenu;
  /** Where the customer designed the cake (their draft), for "choose another baker". */
  fromSlug: string;
  name: string;
  contact: string;
  note: string;
  description: string;
  occasion: string;
  eventDate: string;
  servings: number;
  budget: number | null;
  tier: DesignTier;
  selection: Selection;
  look: CakeLook;
  theme: string;
  licensedNote: string;
  unavailable: string[];
  estimate: number | null;
  /** Plain words for the cake ("2-tier ube cake with pink buttercream…"). */
  summary: string;
  photo: SmallImage | null;
  notifySub: string | null;
  lang: 'tl' | 'en';
  /** What the customer can't eat, as typed ('' = none). */
  allergies: string;
  handoff: Handoff;
  /** HH:MM or ''. */
  handoffTime: string;
  address: string;
}

export type SendResult = { ok: false } | { ok: true; id: string; link: string; message: string; cloud: boolean; auto: boolean };

/**
 * Send a cake request to one baker: into their Cakeita inbox when they have an account,
 * to this phone's own bakery for the demo, or to a sample bakery that answers by itself.
 * The Messenger message is always made too, as the fallback.
 */
export async function sendCakeRequest(p: RequestParts, tx: Tx): Promise<SendResult> {
  const { menu } = p;
  const req: CakeRequest = {
    id: newId('rq'),
    bakerySlug: menu.slug,
    createdAt: new Date().toISOString(),
    customer: { name: p.name.trim().slice(0, 80), contact: p.contact.trim().slice(0, 120) },
    occasion: (p.occasion || 'Other').slice(0, 40),
    eventDate: p.eventDate,
    servings: Math.max(1, Math.min(500, Math.round(p.servings))),
    budget: p.budget,
    description: [p.description, p.note && `Note: ${p.note}`].filter(Boolean).join('\n').slice(0, 1000),
    tier: p.tier,
    selection: normalizeSelection(menu, p.selection).selection,
    look: { ...p.look, textOnCake: p.look.textOnCake.slice(0, 40) },
    theme: p.theme.slice(0, 60),
    licensedNote: p.licensedNote.slice(0, 240),
    unavailable: p.unavailable.slice(0, 20),
    estimate: menu.showEstimates ? p.estimate : null,
    hasInspoPhoto: !!p.photo,
    lang: p.lang,
    allergies: p.allergies.trim().slice(0, 120),
    handoff: p.handoff,
    handoffTime: /^\d{2}:\d{2}$/.test(p.handoffTime) ? p.handoffTime : '',
    address: p.handoff === 'delivery' ? p.address.trim().slice(0, 200) : '',
  };
  if (!cakeRequestSchema.safeParse(req).success) return { ok: false };
  const link = await requestLink(req);
  const auto = isAutoBaker(menu.slug);
  // Bakers with an account get it in their inbox right away, with the inspo photo (the Messenger message still goes too).
  let cloud = false;
  let photoSent = false;
  if (!auto && menu.owner && cloudEnabled()) {
    try {
      const { sendRequest } = await import('../cloud/data');
      photoSent = await Promise.race([sendRequest(req, menu.owner, p.photo?.dataUrl ?? null, p.notifySub), new Promise<boolean>((_, rej) => setTimeout(() => rej(new Error('slow')), 12000))]);
      cloud = true;
      // Ping the baker's phone (if they turned alerts on). Fire and forget.
      sendNotify({ kind: 'request', bakerUid: menu.owner, id: req.id });
    } catch {
      cloud = false;
    }
  }
  const lines = [
    tx(`Hi ${menu.name}! Cake request from ${req.customer.name}:`, `Hi ${menu.name}! Cake request po mula kay ${req.customer.name}:`),
    `• ${req.occasion}, ${req.eventDate}, ${tx('for', 'para sa')} ${req.servings} ${tx('people', 'tao')}`,
    `• ${p.summary}`,
    `• ${handoffText(req, tx, 'me')}`,
    req.allergies ? `• ${tx('ALLERGY', 'ALLERGY')}: ${req.allergies}` : '',
    req.budget != null ? `• Budget: ${formatPeso(req.budget)}` : '',
    req.estimate != null ? `• ${tx('Estimate in the app', 'Tantya sa app')}: ${formatPeso(req.estimate)}` : '',
    req.look.own?.length ? `• ${ownText(req.look.own, p.lang)}` : '',
    p.photo ? (photoSent ? tx('• My inspo photo is with the request in Cakeita.', '• Kasama sa request sa Cakeita ang inspo photo ko.') : tx('• I will send my inspo photo here too.', '• Ise-send ko rin dito ang inspo photo ko.')) : '',
    tx('Open my request:', 'Buksan ang request ko:'),
  ].filter(Boolean);
  const message = lines.join('\n');
  repo.addMyRequest({
    id: req.id,
    bakerySlug: menu.slug,
    bakeryName: menu.name,
    createdAt: req.createdAt,
    summary: p.summary,
    requestLink: link,
    status: 'sent',
    cloud,
    auto,
    ...(cloud && menu.owner ? { bakerUid: menu.owner } : {}),
    fromSlug: p.fromSlug,
    eventDate: req.eventDate,
    contact: menu.contact,
  });
  // Same device as the baker (demo laptop or a baker testing their own link): drop it straight in the inbox.
  const own = repo.get().bakery;
  if (own && own.slug === menu.slug) repo.upsertOrder(requestToOrder(req, 'same-device'));
  return { ok: true, id: req.id, link, message, cloud, auto };
}

// The inspo photo is never saved; it rides along in memory from the design page to "Choose a baker".
let carried: SmallImage | null = null;
export function carryPhoto(p: SmallImage | null) {
  carried = p;
}
export function carriedPhoto(): SmallImage | null {
  return carried;
}

