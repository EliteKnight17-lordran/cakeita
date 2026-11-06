/** Round to centavos, avoiding binary float drift (0.1 + 0.2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round UP to the nearest ₱50. 1,901 -> 1,950. 1,950 -> 1,950. */
export function roundUpTo50(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  // round2 first so 1950.0000001 does not jump to 2000.
  return Math.ceil(round2(n) / 50) * 50;
}

const peso = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
const peso2 = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₱1,950 */
export function formatPeso(n: number): string {
  return `₱${peso.format(Math.round(n))}`;
}

/** ₱0.55, for per-unit costs. */
export function formatPesoExact(n: number): string {
  return `₱${peso2.format(n)}`;
}
