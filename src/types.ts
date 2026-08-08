export interface Coords {
  lat: number;
  lon: number;
}

export type FactKind = 'place' | 'time';

/** A raw candidate from any source, before scoring and formatting. */
export interface FactCandidate {
  /** Stable id used for seen-tracking, e.g. "wp:de:12345" or "sun:sunset". */
  id: string;
  kind: FactKind;
  title: string;
  /** The fact text itself. Extracted, never invented. */
  text: string;
  sourceName: string;
  sourceUrl?: string;
  /** Where the subject of the fact is, if it has a physical anchor. */
  coords?: Coords;
}

/** A scored, presentable fact. */
export interface Fact extends FactCandidate {
  score: number;
  /** Meters from the user to the subject, if anchored. */
  distanceM?: number;
  /** Compass direction from the user to the subject, e.g. "north-east". */
  direction?: string;
}
