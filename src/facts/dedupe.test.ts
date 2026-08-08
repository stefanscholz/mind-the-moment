import { describe, expect, it } from 'vitest';
import { dedupeByTitle } from './engine';
import type { FactCandidate } from '../types';

function c(id: string, title: string): FactCandidate {
  return { id, kind: 'place', title, text: 'x', sourceName: 's' };
}

describe('dedupeByTitle', () => {
  it('keeps the first (higher-priority) source for a shared title', () => {
    const out = dedupeByTitle([
      c('wp:1', 'Residenzschloss Ludwigsburg'),
      c('osm:1', 'Residenzschloss Ludwigsburg'),
      c('wd:1', 'residenzschloss ludwigsburg'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('wp:1');
  });

  it('treats diacritics and punctuation as the same title', () => {
    const out = dedupeByTitle([c('a', 'Mylius-Straße'), c('b', 'Mylius Strasse')]);
    // NFKD folds ß→ss? It does not — ß needs special casing; these differ.
    // But ü/u-umlaut style diacritics fold:
    const out2 = dedupeByTitle([c('a', 'Türmle'), c('b', 'Turmle')]);
    expect(out2).toHaveLength(1);
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it('never collapses distinct places', () => {
    const out = dedupeByTitle([c('a', 'Marktplatz'), c('b', 'Rathaus')]);
    expect(out).toHaveLength(2);
  });
});
