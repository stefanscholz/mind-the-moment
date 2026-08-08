import { describe, expect, it } from 'vitest';
import { sunCandidates, sunTimes } from './sun';

const LUDWIGSBURG = { lat: 48.8973, lon: 9.1917 };

describe('sunTimes', () => {
  it('puts a German summer sunset in a plausible evening window (UTC)', () => {
    const date = new Date('2026-06-21T12:00:00Z');
    const times = sunTimes(date, LUDWIGSBURG);
    expect(times).not.toBeNull();
    const hour = times!.sunset.getUTCHours();
    // Sunset in Ludwigsburg on the solstice is ~21:28 local (19:28 UTC).
    expect(hour).toBeGreaterThanOrEqual(18);
    expect(hour).toBeLessThanOrEqual(20);
    expect(times!.sunrise.valueOf()).toBeLessThan(times!.sunset.valueOf());
  });

  it('returns null in polar night', () => {
    const date = new Date('2026-12-21T12:00:00Z');
    expect(sunTimes(date, { lat: 78.22, lon: 15.63 })).toBeNull();
  });
});

describe('sunCandidates', () => {
  it('emits a sunset fact only when sunset is imminent', () => {
    const noonish = new Date('2026-06-21T10:00:00Z');
    expect(sunCandidates(LUDWIGSBURG, noonish)).toHaveLength(0);

    const evening = new Date('2026-06-21T19:00:00Z'); // ~28 min before sunset
    const facts = sunCandidates(LUDWIGSBURG, evening);
    expect(facts.some((f) => f.id === 'sun:sunset')).toBe(true);
    expect(facts[0].text).toMatch(/minute/);
  });
});
