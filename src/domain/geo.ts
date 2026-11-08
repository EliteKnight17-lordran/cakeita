/** Distance helpers for the nearby-bakers map. Pure functions, no I/O. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Default spot when the customer doesn't share their location: Ortigas Center (SM Megamall area). */
export const DEFAULT_SPOT: LatLng & { label: string; labelTl: string } = {
  lat: 14.5849,
  lng: 121.0563,
  label: 'Ortigas (SM Megamall area)',
  labelTl: 'Ortigas (malapit sa SM Megamall)',
};
