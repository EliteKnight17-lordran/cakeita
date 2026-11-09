/** "2026-11-12" → "Thu, Nov 12" (or "Huw, Nob 12"). Anything that isn't a date is returned as is. */
export function niceDate(iso: string, lang: 'tl' | 'en'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}
