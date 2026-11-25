import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  perInvestigator,
  PlayTable,
} from './index';
import { rejectionOf } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const tunnel = instanceId('tunnel');
const cistern = instanceId('cistern');

/** A location like Underground Cistern: entering it costs 2 clues per investigator, as a group. */
const guardedCistern = blankLocation('cistern', {
  enterCost: { spend: 'groupClues', amount: perInvestigator(2) },
});

describe('the cost to enter a location', () => {
  /** Alice and Bob in the tunnel next to the unrevealed cistern (4 clues for two), Alice's turn. */
  const beforeTheCistern = ({ aliceClues, bobClues }: { aliceClues: number; bobClues: number }) =>
    PlayTable.start(
      newGame()
        .withLocation(tunnel, blankLocation('tunnel'), { revealed: true })
        .withLocation(cistern, guardedCistern, { revealed: false })
        .withConnection(tunnel, cistern)
        .withInvestigator(alice, { locationId: tunnel, clues: aliceClues })
        .withInvestigator(bob, { locationId: tunnel, clues: bobClues })
        .withTurnOf(alice),
    );

  it('is 2 clues per investigator for alice and bob: 4', () => {
    expect(beforeTheCistern({ aliceClues: 0, bobClues: 0 }).board.enterCost(cistern)).toBe(4);
  });

  it.each([
    { aliceClues: 4, bobClues: 0, aliceLeft: 0, bobLeft: 0 },
    { aliceClues: 3, bobClues: 2, aliceLeft: 0, bobLeft: 1 },
    { aliceClues: 5, bobClues: 1, aliceLeft: 1, bobLeft: 1 },
  ])(
    'is paid by alice first, then bob, as she moves in holding $aliceClues and bob $bobClues',
    ({ aliceClues, bobClues, aliceLeft, bobLeft }) => {
      const table = beforeTheCistern({ aliceClues, bobClues });

      table.moveTo(alice, cistern);

      expect(table.board.investigator(alice)).toMatchObject({ at: 'cistern', clues: aliceLeft });
      expect(table.board.investigator(bob).clues).toBe(bobLeft);
    },
  );

  it('is paid as the players split it', () => {
    const table = beforeTheCistern({ aliceClues: 4, bobClues: 4 });

    table.moveTo(alice, cistern, {
      spend: [
        [alice, 1],
        [bob, 3],
      ],
    });

    expect(table.board.investigator(alice)).toMatchObject({ at: 'cistern', clues: 3 });
    expect(table.board.investigator(bob).clues).toBe(1);
  });

  it('refuses the move while the group holds only 3 of the 4 clues', () => {
    const table = beforeTheCistern({ aliceClues: 2, bobClues: 1 });

    expect(table.board.canEnter(cistern)).toBe(false);
    expect(rejectionOf(() => table.moveTo(alice, cistern))).toEqual({
      code: 'enterCostUnpaid',
      locationId: cistern,
      required: 4,
    });
    expect(table.board.investigator(alice)).toMatchObject({ at: 'tunnel', clues: 2 });
  });

  it('is paid by a card effect that moves alice there too', () => {
    const table = beforeTheCistern({ aliceClues: 4, bobClues: 0 });

    table.play({
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cistern,
      ignoreConnections: true,
    });

    expect(table.board.investigator(alice)).toMatchObject({ at: 'cistern', clues: 0 });
  });

  it('reveals the cistern as alice pays and enters, so bob then enters for free', () => {
    const table = beforeTheCistern({ aliceClues: 4, bobClues: 1 });
    table.moveTo(alice, cistern);

    expect(table.board.location(cistern).revealed).toBe(true);
    expect(table.board.enterCost(cistern)).toBeUndefined();
    table.play({ type: 'MoveInvestigator', investigatorId: bob, to: cistern });

    expect(table.board.investigator(bob)).toMatchObject({ at: 'cistern', clues: 1 });
  });

  it('costs nothing to enter once something else revealed the cistern', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(tunnel, blankLocation('tunnel'), { revealed: true })
        .withLocation(cistern, guardedCistern, { revealed: true })
        .withConnection(tunnel, cistern)
        .withInvestigator(alice, { locationId: tunnel, clues: 1 })
        .withTurnOf(alice),
    );

    table.moveTo(alice, cistern);

    expect(table.board.investigator(alice)).toMatchObject({ at: 'cistern', clues: 1 });
  });

  it('charges nothing for a move the players already paid at the table', () => {
    const table = beforeTheCistern({ aliceClues: 1, bobClues: 0 });

    table.play({ type: 'MoveInvestigator', investigatorId: alice, to: cistern, paidAtTable: true });

    expect(table.board.investigator(alice)).toMatchObject({ at: 'cistern', clues: 1 });
  });

  it('refuses payers named for a move into a location without a cost', () => {
    const table = beforeTheCistern({ aliceClues: 4, bobClues: 0 });
    table.moveTo(alice, cistern);

    expect(rejectionOf(() => table.moveTo(alice, tunnel, { spend: [[alice, 1]] }))).toEqual({
      code: 'noGroupCost',
    });
  });
});
