/**
 * User settings, stored on-device. The range applies to place facts;
 * live facts (departures, weather, sunset) are always about "right here".
 */

export interface Settings {
  rangeM: number;
  sources: {
    wikipedia: boolean;
    osm: boolean;
    wikidata: boolean;
    etymology: boolean;
    transport: boolean;
    weather: boolean;
  };
}

export const RANGE_OPTIONS_M = [100, 150, 250, 500, 1000];

export const DEFAULT_SETTINGS: Settings = {
  rangeM: 150,
  sources: {
    wikipedia: true,
    // Field verdict: OSM building facts are too noisy — off by default,
    // re-enableable in settings.
    osm: false,
    wikidata: true,
    etymology: true,
    transport: true,
    weather: true,
  },
};

const KEY = 'mtm:settings';

/** Merge a stored partial onto the defaults — survives future new fields. */
export function mergeSettings(partial: unknown): Settings {
  const p = (partial ?? {}) as Partial<Settings>;
  return {
    rangeM:
      typeof p.rangeM === 'number' && p.rangeM >= 50 && p.rangeM <= 10000
        ? p.rangeM
        : DEFAULT_SETTINGS.rangeM,
    sources: { ...DEFAULT_SETTINGS.sources, ...(p.sources ?? {}) },
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return mergeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return mergeSettings(null);
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings then only last for the session — acceptable.
  }
}
