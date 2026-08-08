import type { Coords } from './types';

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in meters (haversine). */
export function distanceM(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial bearing from `from` to `to`, in degrees 0..360. */
export function bearingDeg(from: Coords, to: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

/** 8-point compass name for a bearing in degrees. */
export function compassName(bearing: number): string {
  const idx = Math.round(((bearing % 360) + 360) % 360 / 45) % 8;
  return DIRECTIONS[idx];
}

/** "80 m" below 1 km, "1.2 km" above. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Round coordinates onto a ~100 m grid. Used as a cache key so nearby
 * positions reuse the same API responses.
 */
export function gridKey(coords: Coords): string {
  return `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
}
