import { cacheGet, cacheSet } from '../cache';
import { gridKey } from '../geo';
import type { Coords, FactCandidate } from '../types';

/**
 * Wikidata around-query. Much denser than Wikipedia near street level:
 * Germany's heritage registers are mass-imported here, so listed buildings,
 * sculptures and fountains have items (with inception, architect, namesake)
 * even when no article exists.
 */

const RADIUS_KM = 0.25;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ENDPOINT = 'https://query.wikidata.org/sparql';

interface SparqlValue {
  value: string;
}

export interface WikidataBinding {
  item: SparqlValue;
  itemLabel?: SparqlValue;
  itemDescription?: SparqlValue;
  coord?: SparqlValue;
  inception?: SparqlValue;
  architectLabel?: SparqlValue;
  namedAfterLabel?: SparqlValue;
}

function buildQuery(coords: Coords): string {
  return `SELECT ?item ?itemLabel ?itemDescription ?coord ?inception ?architectLabel ?namedAfterLabel WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${coords.lon} ${coords.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${RADIUS_KM}" .
  }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P84 ?architect . }
  OPTIONAL { ?item wdt:P138 ?namedAfter . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${navigator.language?.slice(0, 2) || 'en'},en,de". }
}
LIMIT 50`;
}

function parsePoint(wkt: string): Coords | undefined {
  const m = wkt.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
  if (!m) return undefined;
  return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

/** Pure binding→candidate mapping — unit-tested directly. */
export function bindingsToCandidates(bindings: WikidataBinding[]): FactCandidate[] {
  const out: FactCandidate[] = [];
  const seen = new Set<string>();
  for (const b of bindings) {
    const qid = b.item.value.split('/').pop();
    if (!qid || seen.has(qid)) continue;
    seen.add(qid);

    const label = b.itemLabel?.value;
    // The label service echoes the QID back when an item has no label.
    if (!label || /^Q\d+$/.test(label)) continue;

    const sentences: string[] = [];
    if (b.itemDescription?.value) {
      const d = b.itemDescription.value;
      sentences.push(d.charAt(0).toUpperCase() + d.slice(1) + '.');
    }
    const year = b.inception?.value.match(/^(-?\d{1,4})/)?.[1];
    if (year && !year.startsWith('-')) sentences.push(`Dates from ${year}.`);
    if (b.architectLabel?.value && !/^Q\d+$/.test(b.architectLabel.value)) {
      sentences.push(`Designed by ${b.architectLabel.value}.`);
    }
    if (b.namedAfterLabel?.value && !/^Q\d+$/.test(b.namedAfterLabel.value)) {
      sentences.push(`Named after ${b.namedAfterLabel.value}.`);
    }
    if (sentences.length === 0) continue;

    out.push({
      id: `wd:${qid}`,
      kind: 'place',
      title: label,
      text: sentences.join(' '),
      sourceName: 'Wikidata',
      sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      coords: b.coord ? parsePoint(b.coord.value) : undefined,
    });
  }
  return out;
}

export async function wikidataCandidates(coords: Coords): Promise<FactCandidate[]> {
  const key = `wd:${gridKey(coords)}`;
  const cached = cacheGet<FactCandidate[]>(key, CACHE_MAX_AGE_MS);
  if (cached) return cached;

  const url =
    ENDPOINT +
    '?' +
    new URLSearchParams({ query: buildQuery(coords), format: 'json' });
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`Wikidata failed: ${res.status}`);
  const data = await res.json();
  const candidates = bindingsToCandidates(data?.results?.bindings ?? []);
  cacheSet(key, candidates);
  return candidates;
}
