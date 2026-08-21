import { cacheGet, cacheSet } from '../cache';
import { gridKey } from '../geo';
import { isAddressTitle } from './filters';
import type { Coords, FactCandidate } from '../types';

/**
 * OpenStreetMap via Overpass: the hyper-local source. Every mapped building,
 * memorial, plaque and fountain — including ones far below Wikipedia's
 * notability bar — with tags describing exactly what we want: former names,
 * former uses, construction dates, inscriptions.
 */

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const HISTORIC_LABELS: Record<string, string> = {
  memorial: 'a memorial',
  monument: 'a monument',
  fountain: 'a historic fountain',
  ruins: 'ruins',
  castle: 'a castle',
  city_gate: 'a former city gate',
  citywalls: 'part of the old city walls',
  tower: 'a historic tower',
  wayside_cross: 'a wayside cross',
  wayside_shrine: 'a wayside shrine',
  boundary_stone: 'a historic boundary stone',
  archaeological_site: 'an archaeological site',
  building: 'a historic building',
  church: 'a historic church',
  manor: 'a manor house',
  mill: 'a historic mill',
};

/** "1898", "~1900", "1898-05-01" → a readable year phrase; junk stays as-is. */
function startDatePhrase(raw: string): string {
  const year = raw.match(/\d{4}/)?.[0];
  if (!year) return `dating from ${raw}`;
  return raw.startsWith('~') ? `built around ${year}` : `built in ${year}`;
}

/**
 * Turn one element's tags into fact text, or null when the tags carry
 * nothing worth reading out. Pure — unit-tested directly.
 */
export function describeElement(tags: Record<string, string>): {
  title: string;
  text: string;
} | null {
  const parts: string[] = [];
  // Weak parts restate that something old exists; strong parts say what
  // makes it worth looking at. Weak-only facts are the "there is a building
  // at this address" noise the app must never show.
  let strong = 0;
  let weak = 0;

  const historic = tags.historic;
  if (historic && HISTORIC_LABELS[historic]) {
    parts.push(HISTORIC_LABELS[historic]);
    // "a historic building" alone is filler; memorials, gates, ruins aren't.
    historic === 'building' ? weak++ : strong++;
  } else if (historic === 'yes') {
    parts.push('a historic site');
    weak++;
  }
  if (tags.tourism === 'artwork') {
    parts.push('a public artwork');
    strong++;
  }

  if (tags.old_name) {
    parts.push(`formerly known as “${tags.old_name}”`);
    strong++;
  }
  if (tags.start_date) {
    parts.push(startDatePhrase(tags.start_date));
    weak++;
  }
  if (tags.architect) {
    parts.push(`designed by ${tags.architect}`);
    strong++;
  }
  if (tags.heritage) {
    parts.push('a listed heritage site');
    weak++;
  }

  // disused:shop=bakery, abandoned:amenity=cinema, was:*=... → former uses.
  for (const [key, value] of Object.entries(tags)) {
    const m = key.match(/^(?:disused|abandoned|was):(?:.+)$/);
    if (m && /^[a-z_]+$/.test(value)) {
      parts.push(`no longer in use as a ${value.replace(/_/g, ' ')}`);
      strong++;
      break;
    }
  }

  if (tags.inscription) {
    const quote =
      tags.inscription.length > 160
        ? tags.inscription.slice(0, 160).trimEnd() + '…'
        : tags.inscription;
    parts.push(`its inscription reads: “${quote}”`);
    strong++;
  }
  if (tags.description && tags.description.length < 200) {
    parts.push(tags.description);
    strong++;
  }

  const title = tags.name ?? tags.old_name;
  if (parts.length === 0) return null;
  // Nameless elements need enough substance to stand alone.
  if (!title && strong === 0) return null;
  // Named elements: something real, or a proper name plus at least two
  // period signals. An address as a name counts for nothing.
  if (title && strong === 0 && (weak < 2 || isAddressTitle(title))) return null;

  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const body = [first, ...parts.slice(1)].join(', ') + '.';
  return { title: title ?? 'Right next to you', text: body };
}

export function elementsToCandidates(elements: OverpassElement[]): FactCandidate[] {
  const out: FactCandidate[] = [];
  for (const el of elements) {
    if (!el.tags) continue;
    const described = describeElement(el.tags);
    if (!described) continue;
    const coord = el.type === 'node' ? { lat: el.lat!, lon: el.lon! } : el.center;
    out.push({
      id: `osm:${el.type}:${el.id}`,
      kind: 'place',
      title: described.title,
      text: described.text,
      sourceName: 'OpenStreetMap',
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      coords: coord,
    });
  }
  return out;
}

function buildQuery(coords: Coords, radiusM: number): string {
  const c = `${coords.lat},${coords.lon}`;
  return `[out:json][timeout:15];
(
  nwr(around:${radiusM},${c})["historic"];
  nwr(around:${radiusM},${c})["tourism"="artwork"];
  nwr(around:${radiusM},${c})["old_name"];
  nwr(around:${radiusM},${c})["start_date"]["name"];
  nwr(around:${radiusM},${c})["heritage"]["name"];
);
out center tags 60;`;
}

export async function overpassCandidates(
  coords: Coords,
  radiusM: number,
): Promise<FactCandidate[]> {
  const key = `osm:${radiusM}:${gridKey(coords)}`;
  const cached = cacheGet<FactCandidate[]>(key, CACHE_MAX_AGE_MS);
  if (cached) return cached;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(buildQuery(coords, radiusM)),
  });
  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const data = (await res.json()) as { elements?: OverpassElement[] };
  const candidates = elementsToCandidates(data.elements ?? []);
  cacheSet(key, candidates);
  return candidates;
}
