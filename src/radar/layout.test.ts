import { describe, expect, it } from 'vitest';
import { niceCeil, radarLayout } from './layout';

const CENTER = { lat: 48.8925, lon: 9.1857 };

describe('niceCeil', () => {
  it('rounds up to friendly distances', () => {
    expect(niceCeil(8)).toBe(10);
    expect(niceCeil(34)).toBe(50);
    expect(niceCeil(110)).toBe(150);
    expect(niceCeil(600)).toBe(750);
    expect(niceCeil(2600)).toBe(5000);
  });
});

describe('radarLayout', () => {
  it('places a northern item straight up and an eastern one to the right', () => {
    const { points } = radarLayout(
      [
        { item: 'north', coords: { lat: CENTER.lat + 0.002, lon: CENTER.lon } },
        { item: 'east', coords: { lat: CENTER.lat, lon: CENTER.lon + 0.002 } },
      ],
      CENTER,
      160,
    );
    const north = points.find((p) => p.item === 'north')!;
    const east = points.find((p) => p.item === 'east')!;
    expect(north.y).toBeLessThan(0);
    expect(Math.abs(north.x)).toBeLessThan(2);
    expect(east.x).toBeGreaterThan(0);
    expect(Math.abs(east.y)).toBeLessThan(2);
  });

  it('zooms so the farthest item stays inside the radar', () => {
    const { points } = radarLayout(
      [
        { item: 'near', coords: { lat: CENTER.lat + 0.0003, lon: CENTER.lon } },
        { item: 'far', coords: { lat: CENTER.lat + 0.01, lon: CENTER.lon } }, // ~1.1 km
      ],
      CENTER,
      160,
    );
    for (const p of points) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(160 - 15);
    }
  });

  it('labels rings with round distances covering the farthest item', () => {
    const { rings } = radarLayout(
      [{ item: 'x', coords: { lat: CENTER.lat + 0.0025, lon: CENTER.lon } }], // ~280 m
      CENTER,
      160,
    );
    expect(rings).toHaveLength(3);
    expect(rings[2].label).toBe('300 m');
    expect(rings[2].radiusPx).toBeLessThanOrEqual(160 - 15);
  });

  it('handles the everything-right-here case without dividing by zero', () => {
    const { points, rings } = radarLayout(
      [{ item: 'here', coords: CENTER }],
      CENTER,
      160,
    );
    expect(points[0].x).toBe(0);
    expect(points[0].y).toBeCloseTo(0);
    expect(rings[0].radiusPx).toBeGreaterThan(0);
  });

  it('returns empty layout for no items', () => {
    expect(radarLayout([], CENTER, 160)).toEqual({ points: [], rings: [] });
  });
});
