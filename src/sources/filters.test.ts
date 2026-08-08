import { describe, expect, it } from 'vitest';
import { isAddressTitle, isBoringDescription } from './filters';
import { describeElement } from './overpass';
import { bindingsToCandidates } from './wikidata';

describe('isAddressTitle', () => {
  it('catches German and English address-style names', () => {
    expect(isAddressTitle('Marktstraße 12')).toBe(true);
    expect(isAddressTitle('Hauptstr. 5a')).toBe(true);
    expect(isAddressTitle('Schlossgasse 3')).toBe(true);
    expect(isAddressTitle('King Street 3')).toBe(true);
  });

  it('leaves real names alone', () => {
    expect(isAddressTitle('Residenzschloss Ludwigsburg')).toBe(false);
    expect(isAddressTitle('Myliusstraße')).toBe(false);
    expect(isAddressTitle('Altes Rathaus')).toBe(false);
  });
});

describe('isBoringDescription', () => {
  it('catches address-register filler in both languages', () => {
    expect(isBoringDescription('building in Ludwigsburg')).toBe(true);
    expect(isBoringDescription('Wohnhaus in Ludwigsburg')).toBe(true);
    expect(isBoringDescription('Kulturdenkmal in Baden-Württemberg')).toBe(true);
    expect(isBoringDescription('cultural heritage monument in Germany')).toBe(true);
    expect(isBoringDescription('Wohn- und Geschäftshaus')).toBe(true);
  });

  it('keeps substantive descriptions', () => {
    expect(isBoringDescription('baroque palace, seat of the Dukes of Württemberg')).toBe(false);
    expect(isBoringDescription('fountain in Ludwigsburg')).toBe(false);
    expect(isBoringDescription('former tobacco factory')).toBe(false);
  });
});

describe('wikidata boring-item filtering', () => {
  const item = (qid: string) => ({ value: `http://www.wikidata.org/entity/${qid}` });

  it('drops address-labeled items outright', () => {
    expect(
      bindingsToCandidates([
        {
          item: item('Q1'),
          itemLabel: { value: 'Marktstraße 12' },
          itemDescription: { value: 'baroque town house' },
        },
      ]),
    ).toHaveLength(0);
  });

  it('drops "building in X" items with nothing else to say', () => {
    expect(
      bindingsToCandidates([
        {
          item: item('Q2'),
          itemLabel: { value: 'Ehemaliges Gasthaus' },
          itemDescription: { value: 'building in Ludwigsburg' },
          inception: { value: '1890-01-01T00:00:00Z' },
        },
      ]),
    ).toHaveLength(0);
  });

  it('keeps a boring description when a person is attached', () => {
    const [fact] = bindingsToCandidates([
      {
        item: item('Q3'),
        itemLabel: { value: 'Villa Franck' },
        itemDescription: { value: 'building in Ludwigsburg' },
        architectLabel: { value: 'Karl Beisbarth' },
      },
    ]);
    expect(fact).toBeDefined();
    expect(fact.text).toBe('Designed by Karl Beisbarth.');
  });
});

describe('overpass weak-signal filtering', () => {
  it('drops an address-named building with only a date', () => {
    expect(describeElement({ name: 'Marktstraße 12', start_date: '1900' })).toBeNull();
  });

  it('drops a named historic building with no other substance', () => {
    expect(describeElement({ name: 'Wohnhaus', historic: 'building' })).toBeNull();
  });

  it('keeps a named building once two period signals stack up', () => {
    const d = describeElement({
      name: 'Altes Rathaus',
      historic: 'building',
      start_date: '1720',
    });
    expect(d).not.toBeNull();
  });
});
