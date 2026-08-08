import type { Coords, FactCandidate } from '../types';

/**
 * Rain nowcast via Open-Meteo (free, CORS, no key): a time-anchored fact
 * that only appears when something is about to change — rain arriving or
 * easing off within the next two hours.
 */

const RAIN_START_MM = 0.15;
const RAIN_STOP_MM = 0.05;

/**
 * Pure nowcast logic over 15-minute precipitation steps — unit-tested.
 * Returns a message or null when nothing noteworthy is coming.
 */
export function rainNowcast(
  times: string[],
  precipitation: number[],
  now: Date,
): string | null {
  const idxNow = times.findIndex((t) => new Date(t).valueOf() > now.valueOf()) - 1;
  const start = Math.max(idxNow, 0);
  if (start >= precipitation.length) return null;

  const raining = precipitation[start] >= RAIN_START_MM;
  for (let i = start + 1; i < precipitation.length; i++) {
    const minutes = Math.round((new Date(times[i]).valueOf() - now.valueOf()) / 60000);
    if (minutes <= 0 || minutes > 120) continue;
    if (!raining && precipitation[i] >= RAIN_START_MM) {
      return `Rain is likely to reach this spot in about ${minutes} minutes.`;
    }
    if (raining && precipitation[i] <= RAIN_STOP_MM) {
      return `The rain here should ease off in about ${minutes} minutes.`;
    }
  }
  return null;
}

export async function weatherCandidates(
  coords: Coords,
  now = new Date(),
): Promise<FactCandidate[]> {
  const url =
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lon),
      minutely_15: 'precipitation',
      forecast_minutely_15: '9',
      timezone: 'UTC',
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`);
  const data = (await res.json()) as {
    minutely_15?: { time: string[]; precipitation: number[] };
  };
  if (!data.minutely_15) return [];

  // Open-Meteo returns times without a zone suffix; they're UTC as requested.
  const times = data.minutely_15.time.map((t) => (t.endsWith('Z') ? t : t + 'Z'));
  const message = rainNowcast(times, data.minutely_15.precipitation, now);
  if (!message) return [];
  return [
    {
      id: 'rain:' + times[0],
      kind: 'time',
      title: 'Weather at this spot',
      text: message,
      sourceName: 'Open-Meteo (live)',
    },
  ];
}
