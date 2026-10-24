import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { gameActions, type GameActions } from './gameActions';

const study = instanceId('study');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const lurker = instanceId('lurker');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

/** Actions that play on `table`, as the store's play on the open game; undo and adjusting do nothing. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    {
      start: async () => {},
      finish: async () => {},
      cancel: async () => {},
    },
  );

describe('gameActions', () => {
  /**
   * Alder's turn in the Study, next to the Hall, with a ghoul engaged with Alder and a lurker
   * engaged with Brook there, for Alder to engage.
   */
  const aldersTurn = () =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withConnection(study, hall)
        .withInvestigator(alder, { locationId: study })
        .withCard(ghoul, blankEnemy('ghoul'), engagedWith(alder))
        .withInvestigator(brook, { locationId: study })
        .withCard(lurker, blankEnemy('lurker'), engagedWith(brook))
        .withTurnOf(alder),
    );

  it.each<{ verb: string; act: (actions: GameActions) => Promise<void> }>([
    { verb: 'moveTo', act: (actions) => actions.moveTo(hall) },
    { verb: 'investigate', act: (actions) => actions.investigate() },
    { verb: 'fight', act: (actions) => actions.fight(ghoul) },
    { verb: 'evade', act: (actions) => actions.evade(ghoul) },
    { verb: 'engage', act: (actions) => actions.engage(lurker) },
  ])('$verb counts off one of alder’s three actions', async ({ act }) => {
    const table = aldersTurn();

    await act(actionsOn(table));

    expect(table.board.investigator(alder)).toMatchObject({ actions: 2 });
  });
});
