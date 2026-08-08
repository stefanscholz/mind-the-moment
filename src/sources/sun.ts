import type { Coords, FactCandidate } from '../types';

/**
 * Compact sunrise/sunset calculation (standard astronomical formulas,
 * same approach as the suncalc library). Accurate to a couple of minutes,
 * which is plenty for a "look west" prompt.
 */

const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const RAD = Math.PI / 180;
const OBLIQUITY = RAD * 23.4397;

const toJulian = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = (date: Date) => toJulian(date) - J2000;

const solarMeanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);

function eclipticLongitude(M: number): number {
  const C =
    RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + Math.PI;
}

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

/** Sunrise and sunset for the given date and place; null in polar day/night. */
export function sunTimes(date: Date, coords: Coords): SunTimes | null {
  const lw = RAD * -coords.lon;
  const phi = RAD * coords.lat;
  const d = toDays(date);

  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = Math.asin(Math.sin(L) * Math.sin(OBLIQUITY));
  const jNoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  const h0 = RAD * -0.833; // sun altitude at rise/set, refraction included
  const cosH =
    (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) /
    (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;

  const w = Math.acos(cosH);
  const jSet =
    J2000 +
    (0.0009 + (w + lw) / (2 * Math.PI) + n) +
    0.0053 * Math.sin(M) -
    0.0069 * Math.sin(2 * L);
  const jRise = jNoon - (jSet - jNoon);
  return { sunrise: fromJulian(jRise), sunset: fromJulian(jSet) };
}

function minutesUntil(now: Date, then: Date): number {
  return Math.round((then.valueOf() - now.valueOf()) / 60000);
}

/**
 * Zero-API time anchors: a sunset or sunrise fact when one is imminent.
 * Only fires within a 90-minute window so it stays an occasional delight.
 */
export function sunCandidates(coords: Coords, now = new Date()): FactCandidate[] {
  const times = sunTimes(now, coords);
  if (!times) return [];
  const out: FactCandidate[] = [];

  const untilSet = minutesUntil(now, times.sunset);
  if (untilSet > 0 && untilSet <= 90) {
    out.push({
      id: 'sun:sunset',
      kind: 'time',
      title: 'Sunset',
      text: `The sun sets here in ${untilSet} minute${untilSet === 1 ? '' : 's'}. Look west — the light is about to get good.`,
      sourceName: 'Computed for your position',
    });
  }

  const untilRise = minutesUntil(now, times.sunrise);
  if (untilRise > 0 && untilRise <= 90) {
    out.push({
      id: 'sun:sunrise',
      kind: 'time',
      title: 'Sunrise',
      text: `The sun rises here in ${untilRise} minute${untilRise === 1 ? '' : 's'}. Look east.`,
      sourceName: 'Computed for your position',
    });
  }

  return out;
}
