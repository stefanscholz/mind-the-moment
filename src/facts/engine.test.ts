import { describe, expect, it } from 'vitest';
import { proximityScore, rankFacts, surpriseScore } from './engine';
import type { Coords, FactCandidate } from '../types';

const LUDWIGSBURG_STATION: Coords = { lat: 48.8925, lon: 9.1857 };

function candidate(overrides: Partial<FactCandidate>): FactCandidate {
  return {
    id: 'test:1',
    kind: 'place',
    title: 'Test place',
    text: 'A building in Ludwigsburg.',
    sourceName: 'Test',
    ...overrides,
  };
}

describe('proximityScore', () => {
  it('gives full score at close range', () => {
    expect(proximityScore(50)).toBe(40);
  });

  it('gives nothing beyond 2 km', () => {
    expect(proximityScore(2500)).toBe(0);
  });

  it('decreases with distance', () => {
    expect(proximityScore(200)).toBeGreaterThan(proximityScore(800));
  });
});

describe('surpriseScore', () => {
  it('rewards former-use language in English and German', () => {
    expect(surpriseScore('The former prison was demolished in 1967.')).toBeGreaterThan(0);
    expect(surpriseScore('Die ehemalige Fabrik wurde 1967 abgerissen.')).toBeGreaterThan(0);
  });

  it('is zero for plain description', () => {
    expect(surpriseScore('A residential street with shops.')).toBe(0);
  });

  it('is capped', () => {
    const loaded =
      'former formerly originally destroyed demolished founded renamed prison factory';
    expect(surpriseScore(loaded)).toBeLessThanOrEqual(36);
  });
});

describe('rankFacts', () => {
  it('prefers a close surprising fact over a distant plain one', () => {
    const close = candidate({
      id: 'close',
      text: 'The former tobacco factory closed in 1967.',
      coords: { lat: 48.893, lon: 9.186 },
    });
    const far = candidate({
      id: 'far',
      text: 'A plain building.',
      coords: { lat: 48.905, lon: 9.21 },
    });
    const ranked = rankFacts([far, close], LUDWIGSBURG_STATION, new Set());
    expect(ranked[0].id).toBe('close');
  });

  it('computes distance and compass direction for anchored facts', () => {
    const north = candidate({
      id: 'north',
      coords: { lat: LUDWIGSBURG_STATION.lat + 0.002, lon: LUDWIGSBURG_STATION.lon },
    });
    const [fact] = rankFacts([north], LUDWIGSBURG_STATION, new Set());
    expect(fact.direction).toBe('north');
    expect(fact.distanceM).toBeGreaterThan(180);
    expect(fact.distanceM).toBeLessThan(260);
  });

  it('sinks seen facts below unseen ones', () => {
    const a = candidate({ id: 'a', coords: { lat: 48.8926, lon: 9.1858 } });
    const b = candidate({ id: 'b', coords: { lat: 48.8926, lon: 9.1858 } });
    const ranked = rankFacts([a, b], LUDWIGSBURG_STATION, new Set(['a']));
    expect(ranked[0].id).toBe('b');
  });

  it('leaves unanchored time facts competitive via the time bonus', () => {
    const sunset = candidate({ id: 'sun', kind: 'time', text: 'The sun sets soon.' });
    const plain = candidate({ id: 'plain', coords: { lat: 48.9, lon: 9.19 } });
    const ranked = rankFacts([plain, sunset], LUDWIGSBURG_STATION, new Set());
    expect(ranked.map((f) => f.id)).toContain('sun');
    expect(ranked.find((f) => f.id === 'sun')!.score).toBeGreaterThan(0);
  });
});
