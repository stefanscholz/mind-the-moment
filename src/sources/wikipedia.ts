import { cacheGet, cacheSet } from '../cache';
import { gridKey } from '../geo';
import type { Coords, FactCandidate } from '../types';

const SEARCH_RADIUS_M = 1200;
const MAX_PAGES = 25;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface GeoSearchResult {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
}

interface ExtractPage {
  pageid: number;
  title: string;
  extract?: string;
  coordinates?: { lat: number; lon: number }[];
}

function apiUrl(lang: string, params: Record<string, string>): string {
  const search = new URLSearchParams({
    format: 'json',
    origin: '*',
    ...params,
  });
  return `https://${lang}.wikipedia.org/w/api.php?${search}`;
}

async function geoSearch(lang: string, coords: Coords): Promise<GeoSearchResult[]> {
  const url = apiUrl(lang, {
    action: 'query',
    list: 'geosearch',
    gscoord: `${coords.lat}|${coords.lon}`,
    gsradius: String(SEARCH_RADIUS_M),
    gslimit: String(MAX_PAGES),
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia geosearch failed: ${res.status}`);
  const data = await res.json();
  return data?.query?.geosearch ?? [];
}

async function fetchExtracts(lang: string, pageIds: number[]): Promise<ExtractPage[]> {
  if (pageIds.length === 0) return [];
  // The extracts API caps exintro batches at 20 pages.
  const batch = pageIds.slice(0, 20);
  const url = apiUrl(lang, {
    action: 'query',
    prop: 'extracts|coordinates',
    exintro: '1',
    explaintext: '1',
    exsectionformat: 'plain',
    pageids: batch.join('|'),
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia extracts failed: ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  return Object.values(pages) as ExtractPage[];
}

/** Trim an article intro to a card-sized fact: first few sentences, hard cap. */
export function trimExtract(text: string, maxChars = 420): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSentence = cut.lastIndexOf('. ');
  if (lastSentence > maxChars * 0.4) return cut.slice(0, lastSentence + 1);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/**
 * Nearby Wikipedia articles as fact candidates.
 * Results are cached per ~100 m grid cell for a day.
 */
export async function wikipediaCandidates(
  coords: Coords,
  lang: string,
): Promise<FactCandidate[]> {
  const key = `wp:${lang}:${gridKey(coords)}`;
  const cached = cacheGet<FactCandidate[]>(key, CACHE_MAX_AGE_MS);
  if (cached) return cached;

  const hits = await geoSearch(lang, coords);
  const byId = new Map(hits.map((h) => [h.pageid, h]));
  const pages = await fetchExtracts(lang, hits.map((h) => h.pageid));

  const candidates: FactCandidate[] = [];
  for (const page of pages) {
    const extract = page.extract?.trim();
    if (!extract || extract.length < 60) continue;
    const hit = byId.get(page.pageid);
    const coord = page.coordinates?.[0] ?? hit;
    candidates.push({
      id: `wp:${lang}:${page.pageid}`,
      kind: 'place',
      title: page.title,
      text: trimExtract(extract),
      sourceName: 'Wikipedia',
      sourceUrl: `https://${lang}.wikipedia.org/?curid=${page.pageid}`,
      coords: coord ? { lat: coord.lat, lon: coord.lon } : undefined,
    });
  }

  cacheSet(key, candidates);
  return candidates;
}

/** Preferred Wikipedia language: the UI language if plausible, else English. */
export function wikipediaLang(): string {
  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(lang) ? lang : 'en';
}
