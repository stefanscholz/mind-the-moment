import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings';

describe('mergeSettings', () => {
  it('returns defaults for empty or invalid input', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ rangeM: -5 })).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ rangeM: 99999 })).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults OSM off and range to 150 m', () => {
    const s = mergeSettings(null);
    expect(s.sources.osm).toBe(false);
    expect(s.rangeM).toBe(150);
  });

  it('keeps stored choices and fills in missing fields', () => {
    const s = mergeSettings({ rangeM: 500, sources: { osm: true } });
    expect(s.rangeM).toBe(500);
    expect(s.sources.osm).toBe(true);
    expect(s.sources.wikipedia).toBe(true);
  });
});
