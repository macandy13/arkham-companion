import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { moveByCardTargets } from './moveByCard';

const study = instanceId('study');
const hall = instanceId('hall');
const attic = instanceId('attic');
/** Unrevealed, a parlor no one may move into, like The Gathering's. */
const parlor = instanceId('parlor');
const alder = investigatorId('alder');

describe('moveByCardTargets', () => {
  it("offers every location in play, the unconnected attic too, but alder's own and the barred parlor", () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(attic, blankLocation('attic'), { revealed: true })
        .withLocation(
          parlor,
          blankLocation('barred_parlor', {
            restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }],
          }),
        )
        .withConnection(study, hall)
        .withInvestigator(alder, { locationId: study }),
    );

    expect(moveByCardTargets(table.board, alder)).toEqual([hall, attic]);
  });

  it('leaves out the unrevealed cistern while alder holds fewer than its 3 clues to enter', () => {
    const cistern = instanceId('cistern');
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(
          cistern,
          blankLocation('cistern', { enterCost: { spend: 'groupClues', amount: fixed(3) } }),
        )
        .withInvestigator(alder, { locationId: study, clues: 2 }),
    );

    expect(moveByCardTargets(table.board, alder)).toEqual([hall]);
  });
});
