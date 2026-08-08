import { describe, expect, it } from 'vitest';
import { bindingsToCandidates } from './wikidata';

const item = (qid: string) => ({ value: `http://www.wikidata.org/entity/${qid}` });

describe('bindingsToCandidates', () => {
  it('builds a fact from description, inception, architect and namesake', () => {
    const [fact] = bindingsToCandidates([
      {
        item: item('Q123'),
        itemLabel: { value: 'Mylius-Brunnen' },
        itemDescription: { value: 'fountain in Ludwigsburg' },
        coord: { value: 'Point(9.1857 48.8925)' },
        inception: { value: '1907-01-01T00:00:00Z' },
        architectLabel: { value: 'Karl Beisbarth' },
        namedAfterLabel: { value: 'Hermann Mylius' },
      },
    ]);
    expect(fact.title).toBe('Mylius-Brunnen');
    expect(fact.text).toBe(
      'Fountain in Ludwigsburg. Dates from 1907. Designed by Karl Beisbarth. Named after Hermann Mylius.',
    );
    expect(fact.coords).toEqual({ lat: 48.8925, lon: 9.1857 });
    expect(fact.sourceUrl).toBe('https://www.wikidata.org/wiki/Q123');
  });

  it('skips items with no real label or nothing to say', () => {
    const facts = bindingsToCandidates([
      { item: item('Q1'), itemLabel: { value: 'Q1' }, itemDescription: { value: 'thing' } },
      { item: item('Q2'), itemLabel: { value: 'Named but empty' } },
    ]);
    expect(facts).toHaveLength(0);
  });

  it('deduplicates repeated bindings for the same item', () => {
    const binding = {
      item: item('Q9'),
      itemLabel: { value: 'Schloss' },
      itemDescription: { value: 'palace' },
    };
    expect(bindingsToCandidates([binding, binding])).toHaveLength(1);
  });

  it('ignores QID-echo labels for architect and namesake', () => {
    const [fact] = bindingsToCandidates([
      {
        item: item('Q5'),
        itemLabel: { value: 'Denkmal' },
        itemDescription: { value: 'memorial' },
        architectLabel: { value: 'Q999' },
      },
    ]);
    expect(fact.text).toBe('Memorial.');
  });
});
