/** "2026-11-12" → "Thu, Nov 12" (or "Huw, Nob 12"). Anything that isn't a date is returned as is. */
export function niceDate(iso: string, lang: 'tl' | 'en'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "15:30" -> "3:30 PM" ('' if not a time). */
export function niceTime(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

type Tx = (en: string, tl: string) => string;

/**
 * "Pickup at 3:00 PM" / "Delivery to Cubao at 3:00 PM (customer pays the delivery fee)".
 * `who` is who reads it: the customer writing ('me'), the customer reading ('you'), or the baker.
 */
export function handoffText(r: { handoff?: 'pickup' | 'delivery' | null; handoffTime?: string; address?: string }, tx: Tx, who: 'me' | 'you' | 'baker'): string {
  const time = r.handoffTime ? niceTime(r.handoffTime) : '';
  const at = time ? ` ${tx('at', 'nang')} ${time}` : '';
  if (r.handoff === 'delivery') {
    const to = r.address ? ` ${tx('to', 'sa')} ${r.address}` : '';
    const fee = who === 'me' ? tx('I pay the delivery fee', 'ako ang magbabayad ng delivery fee') : who === 'you' ? tx('you pay the delivery fee', 'ikaw ang magbabayad ng delivery fee') : tx('customer pays the delivery fee', 'customer ang magbabayad ng delivery fee');
    return `Delivery${to}${at} (${fee})`;
  }
  return `Pickup${at}`;
}
