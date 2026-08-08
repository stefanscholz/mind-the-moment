import { describe, expect, it } from 'vitest';
import { departureFact } from './transport';

const stop = { name: 'Ludwigsburg', coords: { lat: 48.8925, lon: 9.1857 } };

describe('departureFact', () => {
  it('formats a departure with platform and delay', () => {
    const fact = departureFact(stop, {
      when: '2026-08-08T18:42:00+02:00',
      delay: 300,
      direction: 'Stuttgart Hbf',
      platform: '4',
      line: { name: 'S4' },
    });
    expect(fact).not.toBeNull();
    expect(fact!.kind).toBe('time');
    expect(fact!.text).toContain('the S4 to Stuttgart Hbf');
    expect(fact!.text).toContain('from platform 4');
    expect(fact!.text).toContain('running 5 minutes late');
    expect(fact!.coords).toEqual(stop.coords);
  });

  it('omits the delay note when on time', () => {
    const fact = departureFact(stop, {
      when: '2026-08-08T18:42:00+02:00',
      delay: 0,
      direction: 'Bietigheim',
      line: { name: 'RB17' },
    });
    expect(fact!.text).not.toContain('late');
  });

  it('returns null for cancelled departures (when: null)', () => {
    expect(
      departureFact(stop, { when: null, direction: 'X', line: { name: 'S5' } }),
    ).toBeNull();
  });
});
