import { describe, expect, it } from 'vitest';
import { normaliseCard } from './schema';
import { entersThreatArea, parseKeywords } from './keywords';

// Hand-written fake texts in ArkhamDB's markup – never real card text.
describe('parseKeywords', () => {
  it('reads plain keyword sentences from one line', () => {
    expect(parseKeywords('Hunter. Retaliate.\nFake body.', [])).toEqual([
      { name: 'hunter' },
      { name: 'retaliate' },
    ]);
  });

  it('reads keywords wrapped in bold markup', () => {
    expect(parseKeywords('<b>Surge.</b>\n<b>Peril.</b>', [])).toEqual([
      { name: 'surge' },
      { name: 'peril' },
    ]);
  });

  it('reads the number of victory', () => {
    expect(parseKeywords('Victory 2.', [])).toEqual([{ name: 'victory', value: 2 }]);
  });

  it('reads spawn and prey with their text, with and without bold', () => {
    expect(parseKeywords('<b>Spawn</b> - Fake Room.\nPrey - Highest [agility].', [])).toEqual([
      { name: 'spawn', detail: 'Fake Room' },
      { name: 'prey', detail: 'Highest [agility]' },
    ]);
  });

  it('reads patrol written with a location in parentheses', () => {
    expect(parseKeywords('Patrol (Fake Hall).', [])).toEqual([
      { name: 'patrol', detail: 'Fake Hall' },
    ]);
  });

  it('strips trait markup before reading the text', () => {
    expect(parseKeywords('Spawn - [[Fake]] location.', [])).toEqual([
      { name: 'spawn', detail: 'Fake location' },
    ]);
  });

  it('reads massive, aloof and alert case-insensitively', () => {
    expect(parseKeywords('MASSIVE. aloof. Alert.', [])).toEqual([
      { name: 'massive' },
      { name: 'aloof' },
      { name: 'alert' },
    ]);
  });

  it('takes elite from the traits', () => {
    expect(parseKeywords('Hunter.', ['Monster', 'Elite'])).toEqual([
      { name: 'hunter' },
      { name: 'elite' },
    ]);
  });

  it('ignores a keyword word inside a sentence of the body', () => {
    expect(parseKeywords('Fake rule: gain Surge. when it rains.', [])).toEqual([]);
  });

  it('ignores a line that mixes keywords and other text', () => {
    expect(parseKeywords('Hunter. Fake sentence.', [])).toEqual([]);
  });

  it('ignores keywords inside italic reminder text', () => {
    expect(parseKeywords('Hunter. <i>(Surge.)</i>\n<i>Peril.</i>', [])).toEqual([
      { name: 'hunter' },
    ]);
  });

  it('returns nothing for a missing text', () => {
    expect(parseKeywords(undefined, [])).toEqual([]);
  });
});

describe('entersThreatArea', () => {
  it('is true when the text puts the card into the threat area', () => {
    expect(entersThreatArea('Revelation - Put Fake into play in your threat area.')).toBe(true);
  });

  it('is false for text that only mentions the threat area', () => {
    expect(entersThreatArea('Revelation - Discard each Fake in your threat area.')).toBe(false);
  });

  it('is false for a missing text', () => {
    expect(entersThreatArea(undefined)).toBe(false);
  });
});

describe('normaliseCard keywords', () => {
  const base = { code: '99100', name: 'Fake', type_code: 'enemy', pack_code: 'fake', position: 1 };

  it('fills keywords and the threat area flag from text and traits', () => {
    const card = normaliseCard({
      ...base,
      traits: 'Monster. Elite.',
      text: 'Hunter.\nVictory 1.\nRevelation - Put Fake into play in your threat area.',
    });

    expect(card.keywords).toEqual([
      { name: 'hunter' },
      { name: 'victory', value: 1 },
      { name: 'elite' },
    ]);
    expect(card.entersThreatArea).toBe(true);
  });

  it('defaults to no keywords without text', () => {
    const card = normaliseCard(base);

    expect(card.keywords).toEqual([]);
    expect(card.entersThreatArea).toBe(false);
  });
});
