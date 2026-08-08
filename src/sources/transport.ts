import type { Coords, FactCandidate } from '../types';

/**
 * Live departures from the nearest public-transport stop, via transport.rest
 * (community Deutsche Bahn API — Germany-focused, free, CORS, no key).
 * Not history, but genuinely *current* and anchored to where you stand.
 */

const API = 'https://v6.db.transport.rest';
const MAX_STOP_DISTANCE_M = 400;

interface NearbyStop {
  id: string;
  name: string;
  distance?: number;
  location?: { latitude: number; longitude: number };
}

export interface Departure {
  when: string | null;
  plannedWhen?: string | null;
  delay?: number | null;
  direction?: string | null;
  platform?: string | null;
  line?: { name?: string };
}

/** Pure formatting — unit-tested directly. */
export function departureFact(
  stop: { name: string; coords?: Coords },
  dep: Departure,
): FactCandidate | null {
  if (!dep.when || !dep.direction || !dep.line?.name) return null;
  const time = new Date(dep.when);
  if (Number.isNaN(time.valueOf())) return null;
  const hhmm = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const delayMin = Math.round((dep.delay ?? 0) / 60);
  const delayNote = delayMin >= 2 ? `, running ${delayMin} minutes late` : '';
  const platformNote = dep.platform ? ` from platform ${dep.platform}` : '';

  return {
    id: `dep:${stop.name}:${dep.line.name}:${dep.when}`,
    kind: 'time',
    title: stop.name,
    text: `Next from ${stop.name}: the ${dep.line.name} to ${dep.direction} at ${hhmm}${platformNote}${delayNote}.`,
    sourceName: 'Deutsche Bahn (live)',
    coords: stop.coords,
  };
}

export async function transportCandidates(coords: Coords): Promise<FactCandidate[]> {
  const nearbyUrl =
    `${API}/locations/nearby?` +
    new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lon),
      results: '3',
    });
  const nearbyRes = await fetch(nearbyUrl);
  if (!nearbyRes.ok) throw new Error(`transport.rest nearby failed: ${nearbyRes.status}`);
  const stops = (await nearbyRes.json()) as NearbyStop[];
  const stop = stops.find(
    (s) => s.id && (s.distance === undefined || s.distance <= MAX_STOP_DISTANCE_M),
  );
  if (!stop) return [];

  const depUrl =
    `${API}/stops/${encodeURIComponent(stop.id)}/departures?` +
    new URLSearchParams({ duration: '45', results: '8', remarks: 'false' });
  const depRes = await fetch(depUrl);
  if (!depRes.ok) throw new Error(`transport.rest departures failed: ${depRes.status}`);
  const payload = (await depRes.json()) as { departures?: Departure[] } | Departure[];
  const departures = Array.isArray(payload) ? payload : (payload.departures ?? []);

  const stopInfo = {
    name: stop.name,
    coords: stop.location
      ? { lat: stop.location.latitude, lon: stop.location.longitude }
      : undefined,
  };
  for (const dep of departures) {
    const fact = departureFact(stopInfo, dep);
    if (fact) return [fact]; // one live departure fact is enough
  }
  return [];
}
