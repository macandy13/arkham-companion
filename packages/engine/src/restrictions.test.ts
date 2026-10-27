import { describe, expect, it } from 'vitest';
import {
  attachedTo,
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  setAside,
} from './index';
import { rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const parlor = instanceId('parlor');
const lockedDoor = instanceId('locked_door');

/** A location whose unrevealed side prints "You cannot move into the parlor". */
const parlorCard = blankLocation('parlor', {
  restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }],
});
/** A treachery whose attached location cannot be investigated. */
const lockedDoorCard = blankTreachery('locked_door', {
  restrictions: [{ cannot: 'investigate', of: 'host' }],
});

/** Alice in the revealed hall, connected to the parlor, revealed or not. */
const aliceNextToParlor = (revealed: boolean) =>
  newGame()
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withLocation(parlor, parlorCard, { revealed })
    .withConnection(hall, parlor)
    .withInvestigator(alice, { locationId: hall });

describe('a location nobody may move into while it is unrevealed (the Parlor)', () => {
  it.each([
    { move: 'the move action', command: { asAction: true } as const },
    { move: 'a card effect that ignores connections', command: { ignoreConnections: true } },
  ])('rejects $move into it while unrevealed', ({ command }) => {
    const { context, state } = aliceNextToParlor(false).start();

    expect(
      rejectionFrom(context, state, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: parlor,
        ...command,
      }),
    ).toEqual({ code: 'restricted', cannot: 'moveInto', locationId: parlor });
  });

  it('lets alice in once it is revealed', () => {
    const { context, state } = aliceNextToParlor(true).start();

    const moved = stateAfter(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: parlor,
    });

    expect(moved.investigators[0]?.locationId).toBe(parlor);
  });

  it.each([
    { side: 'unrevealed', revealed: false, forbidden: ['moveInto'] },
    { side: 'revealed', revealed: true, forbidden: undefined },
  ])('shows the move forbidden on its $side side', ({ revealed, forbidden }) => {
    const table = PlayTable.start(aliceNextToParlor(revealed));

    expect(table.board.location(parlor).forbidden).toEqual(forbidden);
  });
});

describe('a treachery whose attached location cannot be investigated (Locked Door)', () => {
  /** Alice in the revealed hall, with the locked door attached to it or set aside. */
  const aliceInHallWithLockedDoor = (zone: typeof setAside) =>
    newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(lockedDoor, lockedDoorCard, zone);

  it('rejects investigating the hall while the door is attached to it', () => {
    const { context, state } = aliceInHallWithLockedDoor(attachedTo(hall)).start();

    expect(rejectionFrom(context, state, { type: 'Investigate', investigatorId: alice })).toEqual({
      code: 'restricted',
      cannot: 'investigate',
      locationId: hall,
    });
    expect(
      PlayTable.start(aliceInHallWithLockedDoor(attachedTo(hall))).board.location(hall),
    ).toMatchObject({ forbidden: ['investigate'] });
  });

  it('lets alice investigate the hall while the door is set aside', () => {
    const { context, state } = aliceInHallWithLockedDoor(setAside).start();

    const investigating = stateAfter(context, state, {
      type: 'Investigate',
      investigatorId: alice,
    });

    expect(investigating.pending).toMatchObject([{ kind: 'skillTestResult' }]);
    expect(
      PlayTable.start(aliceInHallWithLockedDoor(setAside)).board.location(hall).forbidden,
    ).toBeUndefined();
  });
});
