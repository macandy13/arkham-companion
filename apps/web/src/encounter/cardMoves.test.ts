import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  type CardStats,
  type Zone,
} from '@arkham/engine';
import { cardMoves } from './cardMoves';

const study = instanceId('study');
const hallway = instanceId('hallway');
const alder = investigatorId('alder');
const brook = investigatorId('brook');
const drawn = instanceId('drawn');

describe('cardMoves', () => {
  /** Brook's turn; Alder and Brook in the Study, the Hallway empty; `card` lies in `zone`. */
  const brooksTurnWith = (card: CardStats, zone: Zone) =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withLocation(hallway, blankLocation('hallway'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withInvestigator(brook, { locationId: study })
        .withCard(drawn, card, zone)
        .withTurnOf(brook),
    );

  it('spawns an enemy from the discard pile at each location, unengaged or engaged with Brook or Alder there, or sets it aside', () => {
    const table = brooksTurnWith(blankEnemy('ghoul'), { kind: 'encounterDiscard' });

    expect(cardMoves(table.board, table.board.encounterCard(drawn))).toEqual([
      { to: 'location', location: study },
      { to: 'location', location: study, engagedWith: brook },
      { to: 'location', location: study, engagedWith: alder },
      { to: 'location', location: hallway },
      { to: 'setAside' },
    ]);
  });

  it.each([
    {
      where: 'unengaged in the Hallway',
      zone: { kind: 'atLocation', locationId: hallway } as const,
      spawns: [
        { to: 'location', location: study },
        { to: 'location', location: study, engagedWith: brook },
        { to: 'location', location: study, engagedWith: alder },
      ],
    },
    {
      where: 'engaged with Brook in the Study',
      zone: { kind: 'engaged', investigatorId: brook } as const,
      spawns: [
        { to: 'location', location: study },
        { to: 'location', location: study, engagedWith: alder },
        { to: 'location', location: hallway },
      ],
    },
  ])('leaves out the spawn where an enemy $where already is', ({ zone, spawns }) => {
    const table = brooksTurnWith(blankEnemy('ghoul'), zone);

    expect(cardMoves(table.board, table.board.encounterCard(drawn))).toEqual([
      ...spawns,
      { to: 'discard' },
      { to: 'setAside' },
    ]);
  });

  it('puts a treachery into each threat area but the one it is in, onto the discard pile or aside', () => {
    const table = brooksTurnWith(blankTreachery('frozen_in_fear'), {
      kind: 'threatArea',
      investigatorId: alder,
    });

    expect(cardMoves(table.board, table.board.encounterCard(drawn))).toEqual([
      { to: 'threatArea', investigator: brook },
      { to: 'discard' },
      { to: 'setAside' },
    ]);
  });
});
