import { describe, expect, it } from 'vitest';
import { buildReferences, parseReferenceSide } from './index';

// Hand-written fake data – never real card text.
describe('parseReferenceSide', () => {
  it.each([
    { line: '[skull] -1. Fake rule.', written: 'without a colon' },
    { line: '[skull]: -1. Fake rule.', written: 'with a colon' },
  ])('reads a token row written $written', ({ line }) => {
    expect(parseReferenceSide(`Easy / Standard\n${line}`)).toEqual({ skull: '-1. Fake rule.' });
  });

  it('names each symbol token as the engine does, elder_thing as elderThing', () => {
    const side = '[cultist] -2. A.\n[tablet] -3. B.\n[elder_thing] -4. C.';

    expect(parseReferenceSide(side)).toEqual({
      cultist: '-2. A.',
      tablet: '-3. B.',
      elderThing: '-4. C.',
    });
  });

  it.each([
    { text: 'Hard / Expert', reason: 'the heading' },
    { text: '[elder_sign] +1. Not on a reference card.', reason: 'another token' },
    { text: undefined, reason: 'no text' },
  ])('leaves out $reason', ({ text }) => {
    expect(parseReferenceSide(text)).toEqual({});
  });
});

describe('buildReferences', () => {
  it('keeps the scenario cards by code, front for Easy / Standard and back for Hard / Expert', () => {
    const cards = [
      {
        code: '9001',
        type_code: 'scenario',
        text: 'Easy / Standard\n[skull] -1. Front.',
        back_text: 'Hard / Expert\n[skull] -2. Back.',
      },
      { code: '9002', type_code: 'agenda', text: '[skull] -9. Not a scenario.' },
    ];

    expect(buildReferences(cards)).toEqual({
      '9001': { easyStandard: { skull: '-1. Front.' }, hardExpert: { skull: '-2. Back.' } },
    });
  });

  it('rejects non-array input', () => {
    expect(() => buildReferences({})).toThrow('Expected an array of cards');
  });
});
