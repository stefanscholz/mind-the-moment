import type { Coords } from '../types';

export interface GeocodeResult {
  coords: Coords;
  displayName: string;
}

/**
 * Manual-place fallback via OSM Nominatim. Used when geolocation is denied
 * or unavailable — and as the dev mode ("pretend I'm in Ludwigsburg").
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ q: query, format: 'json', limit: '1' });
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];
  const hit = data[0];
  if (!hit) return null;
  return {
    coords: { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) },
    displayName: hit.display_name,
  };
}
