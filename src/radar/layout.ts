import { bearingDeg, distanceM } from '../geo';
import { formatDistance } from '../geo';
import type { Coords } from '../types';

/**
 * Pure layout math for the radar screen: place items around the user by
 * true bearing (north-up) and distance, with the zoom chosen so the
 * farthest item still fits on screen and the range rings land on round
 * distances.
 */

export interface RadarPoint<T> {
  item: T;
  x: number;
  y: number;
  distanceM: number;
}

export interface RadarRing {
  radiusPx: number;
  label: string;
}

export interface RadarLayout<T> {
  points: RadarPoint<T>[];
  rings: RadarRing[];
}

const NICE_STEPS = [
  10, 20, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500,
  2000, 2500, 5000, 10000, 20000, 50000,
];

/** Smallest "round" distance ≥ x, for ring labels. */
export function niceCeil(x: number): number {
  for (const step of NICE_STEPS) {
    if (step >= x) return step;
  }
  return Math.ceil(x / 50000) * 50000;
}

export function radarLayout<T>(
  items: { item: T; coords: Coords }[],
  center: Coords,
  radiusPx: number,
  edgePadPx = 16,
): RadarLayout<T> {
  if (items.length === 0) return { points: [], rings: [] };

  const measured = items.map(({ item, coords }) => ({
    item,
    distanceM: distanceM(center, coords),
    bearing: bearingDeg(center, coords),
  }));

  // Three rings at round distances; the outer ring covers the farthest item.
  const maxDist = Math.max(...measured.map((m) => m.distanceM), 25);
  const ringStep = niceCeil(maxDist / 3);
  const outerDist = ringStep * 3;
  const usable = radiusPx - edgePadPx;
  const scale = usable / outerDist;

  const points = measured.map(({ item, distanceM: d, bearing }) => {
    const rad = (bearing * Math.PI) / 180;
    return {
      item,
      x: Math.sin(rad) * d * scale,
      y: -Math.cos(rad) * d * scale,
      distanceM: d,
    };
  });

  const rings = [1, 2, 3].map((i) => ({
    radiusPx: ringStep * i * scale,
    label: formatDistance(ringStep * i),
  }));

  return { points, rings };
}
