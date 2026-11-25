import { describe, expect, it } from 'vitest';
import { blankEnemy, cardCode, cardDbFrom, trait } from '.';
import { parseSpawn } from './spawn_instruction';

describe('parseSpawn', () => {
  const nearest = { measure: { kind: 'distance' }, extreme: 'fewest' };
  const farthest = { measure: { kind: 'distance' }, extreme: 'most' };
  const location = { ref: 'eachInPlay', typeCode: 'location' };

  it.each([
    { text: 'Engaged with prey', reads: [{ kind: 'engagedWithPrey' }] },
    { text: 'Cellar.', reads: [{ select: { among: { ...location, name: 'Cellar' } } }] },
    {
      text: 'Any [[Arkham]] location',
      reads: [{ select: { among: { ...location, trait: trait('[[Arkham]]') } } }],
    },
    {
      text: 'Farthest empty location',
      reads: [{ select: { among: { ...location, empty: true }, best: farthest } }],
    },
    { text: 'Location nearest to you', reads: [{ select: { among: location, best: nearest } }] },
    {
      text: 'Location with the most clues',
      reads: [
        {
          select: {
            among: location,
            best: { measure: { kind: 'tokens', token: 'clue' }, extreme: 'most' },
          },
        },
      ],
    },
    {
      text: 'Any location connected to yours',
      reads: [{ select: { among: { ...location, connectedTo: { ref: 'windowLocation' } } } }],
    },
    {
      text: 'Attic or Cellar (whichever is nearest to you)',
      reads: [{ select: { among: { ...location, name: ['Attic', 'Cellar'] }, best: nearest } }],
    },
    {
      text: 'Any location (empty, if able)',
      reads: [{ select: { among: { ...location, empty: true } } }, { select: { among: location } }],
    },
    {
      text: 'Your House. Otherwise, Rivertown.',
      reads: [
        { select: { among: { ...location, name: 'Your House' } } },
        { select: { among: { ...location, name: 'Rivertown' } } },
      ],
    },
  ])('reads "$text"', ({ text, reads }) => {
    expect(parseSpawn(text)).toMatchObject(reads);
  });

  it('is read into the card data as it loads', () => {
    const spawner = blankEnemy('spawner', { keywords: [{ name: 'spawn', detail: 'Cellar' }] });

    const loaded = cardDbFrom([spawner]).get(cardCode('spawner'));

    expect(loaded?.spawnAt).toMatchObject([{ select: { among: { name: 'Cellar' } } }]);
  });
});
