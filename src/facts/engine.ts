import { bearingDeg, compassName, distanceM } from '../geo';
import type { Coords, Fact, FactCandidate } from '../types';

/**
 * Words that hint at a surprising past: former uses, origins, destruction,
 * renamings. German + English, matched case-insensitively.
 */
const SURPRISE_WORDS = [
  'former',
  'formerly',
  'originally',
  'destroyed',
  'demolished',
  'founded',
  'renamed',
  'ruins',
  'prison',
  'factory',
  'monastery',
  'fortress',
  'executed',
  'oldest',
  'first',
  'ehemalig',
  'ursprünglich',
  'zerstört',
  'abgerissen',
  'gegründet',
  'umbenannt',
  'gefängnis',
  'fabrik',
  'kloster',
  'festung',
  'älteste',
  'erste',
];

const weights = {
  proximity: 40,
  surprise: 12,
  surpriseCap: 36,
  anchor: 15,
  time: 30,
  seen: 100,
};

export function surpriseScore(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of SURPRISE_WORDS) {
    if (lower.includes(word)) hits += 1;
  }
  return Math.min(hits * weights.surprise, weights.surpriseCap);
}

/** Closer is better; <500 m strongly preferred, fades out toward 2 km. */
export function proximityScore(meters: number): number {
  if (meters <= 100) return weights.proximity;
  if (meters >= 2000) return 0;
  return weights.proximity * (1 - (meters - 100) / 1900);
}

/**
 * Score and order candidates for one position. Seen facts sink to the
 * bottom rather than disappearing, so the pool never dead-ends silently.
 */
export function rankFacts(
  candidates: FactCandidate[],
  user: Coords,
  seenIds: ReadonlySet<string>,
): Fact[] {
  const facts = candidates.map((c) => {
    let score = 0;
    let distance: number | undefined;
    let direction: string | undefined;

    if (c.coords) {
      distance = distanceM(user, c.coords);
      direction = compassName(bearingDeg(user, c.coords));
      score += proximityScore(distance);
      score += weights.anchor;
    }
    score += surpriseScore(c.text);
    if (c.kind === 'time') score += weights.time;
    if (seenIds.has(c.id)) score -= weights.seen;

    return { ...c, score, distanceM: distance, direction } satisfies Fact;
  });

  return facts.sort((a, b) => b.score - a.score);
}
