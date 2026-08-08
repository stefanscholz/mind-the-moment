import { describe, expect, it } from 'vitest';
import { describeElement, elementsToCandidates } from './overpass';

describe('describeElement', () => {
  it('describes a former use with a date', () => {
    const d = describeElement({
      name: 'Alte Tabakfabrik',
      old_name: 'Zigarrenfabrik Müller',
      start_date: '1898',
      historic: 'building',
    });
    expect(d).not.toBeNull();
    expect(d!.title).toBe('Alte Tabakfabrik');
    expect(d!.text).toContain('formerly known as “Zigarrenfabrik Müller”');
    expect(d!.text).toContain('built in 1898');
  });

  it('reads out a memorial inscription', () => {
    const d = describeElement({
      historic: 'memorial',
      inscription: 'Hier stand das Geburtshaus von …',
    });
    expect(d).not.toBeNull();
    expect(d!.title).toBe('Right next to you');
    expect(d!.text).toContain('A memorial');
    expect(d!.text).toContain('Hier stand das Geburtshaus');
  });

  it('surfaces disused former functions', () => {
    const d = describeElement({
      name: 'Lichtspielhaus',
      'disused:amenity': 'cinema',
    });
    expect(d!.text).toMatch(/no longer in use as a cinema/i);
  });

  it('handles approximate dates', () => {
    const d = describeElement({ name: 'Stadtmauer', start_date: '~1300', historic: 'citywalls' });
    expect(d!.text).toContain('built around 1300');
  });

  it('returns null for a bare unnamed building', () => {
    expect(describeElement({ building: 'yes' })).toBeNull();
  });

  it('returns null for a name with nothing to say', () => {
    expect(describeElement({ name: 'Bäckerei Schmidt' })).toBeNull();
  });
});

describe('elementsToCandidates', () => {
  it('uses node coords and way centers, and links to OSM', () => {
    const [nodeFact, wayFact] = elementsToCandidates([
      {
        type: 'node',
        id: 1,
        lat: 48.89,
        lon: 9.18,
        tags: { historic: 'memorial', inscription: 'Test' },
      },
      {
        type: 'way',
        id: 2,
        center: { lat: 48.9, lon: 9.19 },
        tags: { name: 'Altes Rathaus', historic: 'building', start_date: '1720' },
      },
    ]);
    expect(nodeFact.coords).toEqual({ lat: 48.89, lon: 9.18 });
    expect(nodeFact.sourceUrl).toBe('https://www.openstreetmap.org/node/1');
    expect(wayFact.coords).toEqual({ lat: 48.9, lon: 9.19 });
    expect(wayFact.id).toBe('osm:way:2');
  });

  it('skips elements without describable tags', () => {
    expect(
      elementsToCandidates([{ type: 'node', id: 3, lat: 1, lon: 1, tags: { amenity: 'bench' } }]),
    ).toHaveLength(0);
  });
});
