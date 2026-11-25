import { describe, expect, it } from 'vitest';
import { blankEnemy, cardCode, cardDbFrom, trait } from '.';
import { parsePrey } from './prey_instruction';

describe('parsePrey', () => {
  const investigators = { ref: 'eachInvestigator' };

  it.each([
    {
      text: 'Highest [combat]',
      reads: {
        select: {
          among: investigators,
          best: { measure: { kind: 'stat', stat: 'combat' }, extreme: 'most' },
        },
        only: false,
      },
    },
    {
      text: 'Lowest remaining health.',
      reads: {
        select: { best: { measure: { kind: 'stat', stat: 'remainingHealth' }, extreme: 'fewest' } },
        only: false,
      },
    },
    {
      text: 'Nearest to another [[Cultist]] enemy',
      reads: {
        select: {
          best: {
            measure: {
              kind: 'distanceToOther',
              of: { ref: 'eachEnemy', trait: trait('[[Cultist]]') },
            },
            extreme: 'fewest',
          },
        },
        only: false,
      },
    },
    {
      text: 'Investigator at a [[Woods]] location',
      reads: {
        select: { among: { ...investigators, atLocationWith: { trait: trait('[[Woods]]') } } },
        only: false,
      },
    },
    {
      text: 'Bearer only',
      reads: { select: { among: { ...investigators, bearerOf: { ref: 'self' } } }, only: true },
    },
    {
      text: 'Daisy Walker only.',
      reads: { select: { among: { ...investigators, name: 'Daisy Walker' } }, only: true },
    },
  ])('reads "$text"', ({ text, reads }) => {
    expect(parsePrey(text)).toMatchObject(reads);
  });

  it('is read into the card data as it loads', () => {
    const hunter = blankEnemy('hunter', { keywords: [{ name: 'prey', detail: 'Most clues' }] });

    const loaded = cardDbFrom([hunter]).get(cardCode('hunter'));

    expect(loaded?.preyOn).toMatchObject({
      select: { best: { measure: { kind: 'stat', stat: 'clues' }, extreme: 'most' } },
    });
  });
});
