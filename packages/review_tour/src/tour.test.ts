import { describe, expect, it } from 'vitest';
import { parseTour } from './tour.ts';

function body(tour: unknown): string {
  return `Why this PR exists.\n\n<!-- review-tour\n${JSON.stringify(tour)}\n-->\n`;
}

describe('parseTour', () => {
  it('reads the block from anywhere in the body', () => {
    const tour = parseTour(
      body({
        problem: 'Two commands dealt the same attack.',
        concept: 'One command for every attack.',
        questions: [{ text: 'Keep the old name?', stop: 1, picked: 'no' }],
        stops: [
          {
            title: 'The new command',
            tag: 'API',
            text: 'Its kind says which attack.',
            code: [
              {
                file: 'packages/engine/src/commands.ts',
                ranges: [{ from: 10, to: 12, label: 'the type' }],
                highlight: [11],
              },
            ],
            picture: 'shots/board.spec.ts/board.png',
          },
        ],
        evidence: [
          {
            claim: 'An attack of opportunity leaves the enemy ready.',
            test: 'attacks.test.ts › ready',
          },
        ],
        rest: ['Tests gain a `kind`.'],
      }),
    );

    expect(tour).toEqual({
      problem: 'Two commands dealt the same attack.',
      concept: 'One command for every attack.',
      questions: [{ text: 'Keep the old name?', stop: 1, picked: 'no' }],
      stops: [
        {
          title: 'The new command',
          tag: 'API',
          text: 'Its kind says which attack.',
          code: [
            {
              file: 'packages/engine/src/commands.ts',
              ranges: [{ from: 10, to: 12, label: 'the type' }],
              highlight: [11],
            },
          ],
          picture: 'shots/board.spec.ts/board.png',
        },
      ],
      evidence: [
        {
          claim: 'An attack of opportunity leaves the enemy ready.',
          test: 'attacks.test.ts › ready',
        },
      ],
      rest: ['Tests gain a `kind`.'],
    });
  });

  it('is undefined for a body without a block', () => {
    expect(parseTour('Why this PR exists.')).toBeUndefined();
  });

  it('skips a mention of the block inside a line', () => {
    const tour = parseTour(
      `The body holds \`<!-- review-tour {…} -->\`.\n${body({ concept: 'A.' })}`,
    );

    expect(tour?.concept).toBe('A.');
  });

  it('reads missing lists as empty and leaves missing optional fields out', () => {
    const tour = parseTour(
      body({
        concept: 'A rename.',
        stops: [{ title: 'The rename', text: 'Nothing else changes.' }],
      }),
    );

    expect(tour).toEqual({
      concept: 'A rename.',
      questions: [],
      stops: [{ title: 'The rename', text: 'Nothing else changes.', code: [] }],
      evidence: [],
      rest: [],
    });
  });

  it.each([
    ['not JSON', '<!-- review-tour { concept: 1 } -->', 'not valid JSON'],
    ['no concept', body({ stops: [] }), 'concept must be a non-empty string'],
    [
      'a before without an example',
      body({ concept: 'A.', evidence: [{ claim: 'It works.', test: 't › it', before: 'old()' }] }),
      'evidence[0].before needs an example of the new usage next to it',
    ],
    [
      'evidence without a proof',
      body({ concept: 'A.', evidence: [{ claim: 'It works.' }] }),
      'evidence[0] must show its claim by a test, an example or a picture',
    ],
    [
      'an empty problem',
      body({ problem: ' ', concept: 'A.' }),
      'problem must be a non-empty string',
    ],
    ['stops not a list', body({ concept: 'A.', stops: {} }), 'stops must be a list'],
    [
      'a stop without text',
      body({ concept: 'A.', stops: [{ title: 'T' }] }),
      'stops[0].text must be a non-empty string',
    ],
    [
      'a code ref without ranges',
      body({
        concept: 'A.',
        stops: [{ title: 'T', text: 'X.', code: [{ file: 'a.ts', ranges: [] }] }],
      }),
      'stops[0].code[0].ranges must name at least one range',
    ],
    [
      'a range ending before it starts',
      body({
        concept: 'A.',
        stops: [{ title: 'T', text: 'X.', code: [{ file: 'a.ts', ranges: [{ from: 9, to: 3 }] }] }],
      }),
      'stops[0].code[0].ranges[0] ends (3) before it starts (9)',
    ],
    [
      'a question pointing at stop 0',
      body({ concept: 'A.', questions: [{ text: 'Q?', stop: 0 }] }),
      'questions[0].stop must be a whole number from 1',
    ],
    [
      'a question pointing past the last stop',
      body({
        concept: 'A.',
        questions: [{ text: 'Q?', stop: 2 }],
        stops: [{ title: 'T', text: 'X.' }],
      }),
      'questions[0].stop is 2, but the tour has 1 stops',
    ],
  ])('rejects %s', (_case, text, message) => {
    expect(() => parseTour(text)).toThrow(message);
  });
});
