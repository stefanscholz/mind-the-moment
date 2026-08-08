import { describe, expect, it } from 'vitest';
import { rainNowcast } from './weather';

function steps(start: string, values: number[]): { times: string[]; precip: number[] } {
  const t0 = new Date(start).valueOf();
  return {
    times: values.map((_, i) => new Date(t0 + i * 15 * 60000).toISOString()),
    precip: values,
  };
}

describe('rainNowcast', () => {
  const now = new Date('2026-08-08T12:05:00Z');

  it('announces incoming rain with minutes until arrival', () => {
    const { times, precip } = steps('2026-08-08T12:00:00Z', [0, 0, 0.5, 1.2]);
    const msg = rainNowcast(times, precip, now);
    expect(msg).toMatch(/Rain is likely to reach this spot in about 25 minutes/);
  });

  it('announces easing rain when currently raining', () => {
    const { times, precip } = steps('2026-08-08T12:00:00Z', [1.0, 0.8, 0.0, 0]);
    const msg = rainNowcast(times, precip, now);
    expect(msg).toMatch(/ease off in about 25 minutes/);
  });

  it('stays silent when nothing changes', () => {
    const dry = steps('2026-08-08T12:00:00Z', [0, 0, 0, 0]);
    expect(rainNowcast(dry.times, dry.precip, now)).toBeNull();
    const wet = steps('2026-08-08T12:00:00Z', [1, 1, 1, 1]);
    expect(rainNowcast(wet.times, wet.precip, now)).toBeNull();
  });
});
