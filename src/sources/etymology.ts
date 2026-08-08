import { cacheGet, cacheSet } from '../cache';
import { gridKey } from '../geo';
import type { Coords, FactCandidate } from '../types';

/**
 * Street-name etymology: distance zero, because you're standing on the
 * subject. OSM ways carry name:etymology:wikidata; one Overpass lookup for
 * the street under your feet plus one Wikidata entity fetch gives
 * "You're on X, named after Y — <who they were>".
 */

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const OVERPASS = 'https://overpass-api.de/api/interpreter';

interface EntityData {
  entities?: Record<
    string,
    {
      labels?: Record<string, { value: string }>;
      descriptions?: Record<string, { value: string }>;
    }
  >;
}

function pickLang(map: Record<string, { value: string }> | undefined): string | undefined {
  if (!map) return undefined;
  const lang = (navigator.language || 'en').slice(0, 2);
  return (map[lang] ?? map.en ?? map.de ?? Object.values(map)[0])?.value;
}

/** Pure formatting — unit-tested directly. */
export function etymologyFact(
  street: string,
  qid: string,
  namesake: string,
  description: string | undefined,
  at: Coords,
): FactCandidate {
  const tail = description ? ` — ${description}` : '';
  return {
    id: `ety:${qid}`,
    kind: 'place',
    title: street,
    text: `You’re on ${street}, named after ${namesake}${tail}.`,
    sourceName: 'OpenStreetMap & Wikidata',
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    coords: at,
  };
}

export async function etymologyCandidates(coords: Coords): Promise<FactCandidate[]> {
  const key = `ety:${gridKey(coords)}`;
  const cached = cacheGet<FactCandidate[]>(key, CACHE_MAX_AGE_MS);
  if (cached) return cached;

  const query = `[out:json][timeout:10];
way(around:40,${coords.lat},${coords.lon})["highway"]["name"]["name:etymology:wikidata"];
out tags 5;`;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass etymology failed: ${res.status}`);
  const data = (await res.json()) as {
    elements?: { tags?: Record<string, string> }[];
  };

  const candidates: FactCandidate[] = [];
  const seen = new Set<string>();
  for (const el of data.elements ?? []) {
    const street = el.tags?.name;
    // Ways can carry several QIDs separated by ";" — take the first.
    const qid = el.tags?.['name:etymology:wikidata']?.split(';')[0]?.trim();
    if (!street || !qid || !/^Q\d+$/.test(qid) || seen.has(qid)) continue;
    seen.add(qid);

    const entRes = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    );
    if (!entRes.ok) continue;
    const ent = (await entRes.json()) as EntityData;
    const entity = ent.entities?.[qid];
    const namesake = pickLang(entity?.labels);
    if (!namesake) continue;
    candidates.push(
      etymologyFact(street, qid, namesake, pickLang(entity?.descriptions), coords),
    );
    if (candidates.length >= 2) break;
  }

  cacheSet(key, candidates);
  return candidates;
}
