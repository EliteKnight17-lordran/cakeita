import { allergyHits, readAllergies } from '../domain/allergens';
import type { PublicMenu, Selection } from '../domain/types';
import { usePrefs, useTx } from '../lib/prefs';
import { Notice } from './ui';

/**
 * Red allergy warning for a cake: which picked parts match what the customer can't eat.
 * The customer can drop a decoration from here; flavor and frosting are changed in Customize.
 * Always says the check is by name only, so the baker must confirm.
 */
export function AllergyNotice({ menu, selection, text, who, onRemove }: { menu: PublicMenu; selection: Selection; text: string; who: 'customer' | 'baker'; onRemove?: (id: string) => void }) {
  const tx = useTx();
  const prefs = usePrefs();
  const allergies = readAllergies(text);
  if (!allergies.said.length) return null;
  const hits = allergyHits(menu, selection, allergies);
  const said = allergies.said.join(', ');
  const name = (h: { name: string; nameTl?: string }) => (prefs.lang === 'tl' && h.nameTl ? h.nameTl : h.name);
  const confirm =
    who === 'baker'
      ? tx('Matched by your ingredient names only. Check your recipes, and keep tools clean.', 'Batay lang sa pangalan ng sangkap mo. I-check ang recipe, at linisin ang gamit.')
      : tx('We check by ingredient names only. Tell the baker too: home kitchens share tools.', 'Batay lang ito sa pangalan ng sangkap. Sabihin din sa baker: iisa ang gamit sa kusina.');
  if (!hits.length) {
    return (
      <div data-allergy="clear">
        <Notice tone={who === 'baker' ? 'warn' : 'ok'} title={who === 'baker' ? tx(`Customer allergy: ${said}`, `Allergy ng customer: ${said}`) : tx(`Allergy: ${said}`, `Allergy: ${said}`)}>
          <p>{tx('Nothing in this cake has it by name.', 'Wala nito sa cake ayon sa pangalan.')}</p>
          <p className="mt-1 text-sm">{confirm}</p>
        </Notice>
      </div>
    );
  }
  return (
    <div data-allergy="warn">
      <Notice tone="danger" title={who === 'baker' ? tx(`Customer allergy: ${said}`, `Allergy ng customer: ${said}`) : tx(`Allergy: ${said}`, `Allergy: ${said}`)}>
        <ul className="mt-1 space-y-1.5">
          {hits.map((h) => {
            const removable = h.kind === 'part' && !['flavor', 'covering'].includes(h.category);
            return (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" data-allergy-hit={h.id}>
                <span>
                  <strong>{h.kind === 'base' ? tx('The cake itself', 'Ang mismong cake') : name(h)}</strong>
                  {': '}
                  {h.kind === 'base'
                    ? tx(`the sponge is usually made with ${h.said.join(', ')}. Ask the baker if they can make it without.`, `kadalasang may ${h.said.join(', ')} ang sponge. Itanong sa baker kung kaya nang wala.`)
                    : tx(`may have ${h.said.join(', ')}`, `baka may ${h.said.join(', ')}`)}
                  {who === 'customer' && h.kind === 'part' && !removable && tx('. Change it in Customize.', '. Palitan sa I-customize.')}
                </span>
                {who === 'customer' && removable && onRemove && (
                  <button type="button" className="min-h-11 rounded-full border border-current px-3 text-sm font-semibold" onClick={() => onRemove(h.id)} data-allergy-remove={h.id}>
                    {tx('Remove', 'Tanggalin')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm">{confirm}</p>
      </Notice>
    </div>
  );
}
