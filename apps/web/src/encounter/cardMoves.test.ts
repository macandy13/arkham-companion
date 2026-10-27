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

  it.each([
    {
      where: 'on the discard pile',
      zone: { kind: 'encounterDiscard' } as const,
      moves: [{ to: 'setAside' }],
    },
    {
      where: 'unengaged in the Hallway',
      zone: { kind: 'atLocation', locationId: hallway } as const,
      moves: [{ to: 'discard' }, { to: 'setAside' }],
    },
    {
      where: 'engaged with Brook',
      zone: { kind: 'engaged', investigatorId: brook } as const,
      moves: [{ to: 'discard' }, { to: 'setAside' }],
    },
  ])(
    'moves an enemy $where only to the discard pile or aside, never into a threat area',
    ({ zone, moves }) => {
      const table = brooksTurnWith(blankEnemy('ghoul'), zone);

      expect(cardMoves(table.board, table.board.encounterCard(drawn))).toEqual(moves);
    },
  );

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
