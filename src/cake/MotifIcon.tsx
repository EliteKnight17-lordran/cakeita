import { MOTIFS, motifFill, type MotifColors, type MotifKey } from '../domain/motifs';

/** Small flat picture of a theme topper shape, for pickers and order cards. */
export function MotifIcon({ k, colors, size = 36 }: { k: MotifKey; colors: MotifColors; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      {MOTIFS[k].layers.map((l, i) => (
        <path key={i} d={l.d} fill={motifFill(l.fill, colors)} stroke={i === 0 ? '#00000022' : 'none'} strokeWidth={2} />
      ))}
    </svg>
  );
}
