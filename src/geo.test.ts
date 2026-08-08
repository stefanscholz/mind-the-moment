import { describe, expect, it } from 'vitest';
import { bearingDeg, compassName, distanceM, formatDistance, gridKey } from './geo';

describe('distanceM', () => {
  it('is zero for identical points', () => {
    const p = { lat: 48.8925, lon: 9.1857 };
    expect(distanceM(p, p)).toBe(0);
  });

  it('matches a known city distance roughly (Ludwigsburg to Stuttgart ~12 km)', () => {
    const ludwigsburg = { lat: 48.8973, lon: 9.1917 };
    const stuttgart = { lat: 48.7838, lon: 9.1829 };
    const d = distanceM(ludwigsburg, stuttgart);
    expect(d).toBeGreaterThan(11000);
    expect(d).toBeLessThan(14000);
  });
});

describe('compassName', () => {
  it('maps bearings to 8-point names', () => {
    expect(compassName(0)).toBe('north');
    expect(compassName(45)).toBe('north-east');
    expect(compassName(90)).toBe('east');
    expect(compassName(180)).toBe('south');
    expect(compassName(270)).toBe('west');
    expect(compassName(359)).toBe('north');
  });
});

describe('bearingDeg', () => {
  it('points east for a point due east', () => {
    const from = { lat: 48.0, lon: 9.0 };
    const to = { lat: 48.0, lon: 9.01 };
    expect(Math.abs(bearingDeg(from, to) - 90)).toBeLessThan(1);
  });
});

describe('formatDistance', () => {
  it('rounds meters to tens below 1 km', () => {
    expect(formatDistance(123)).toBe('120 m');
  });

  it('uses km with one decimal above 1 km', () => {
    expect(formatDistance(1234)).toBe('1.2 km');
  });
});

describe('gridKey', () => {
  it('groups nearby coordinates into the same ~100 m cell', () => {
    expect(gridKey({ lat: 48.89241, lon: 9.18569 })).toBe(
      gridKey({ lat: 48.89239, lon: 9.18571 }),
    );
  });

  it('separates coordinates in different cells', () => {
    expect(gridKey({ lat: 48.892, lon: 9.186 })).not.toBe(
      gridKey({ lat: 48.894, lon: 9.186 }),
    );
  });
});
