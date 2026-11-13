import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardName,
  engagedWith,
  boardView,
  instanceId,
  investigatorId,
  isInPlay,
  newGame,
  PlayTable,
  takeHorror,
  trait,
  zoneOf,
  type Command,
  type GameState,
  type HostRestriction,
  type InstanceId,
} from './index';
import { investigatorOf, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const study = instanceId('study');
const attic = instanceId('attic');
const parlor = instanceId('parlor');
const ghoul = instanceId('ghoul');
const location = blankLocation('location');
const hunterGhoul = blankEnemy('hunter_ghoul', { keywords: [{ name: 'hunter' }] });
const eliteHunter = blankEnemy('elite_hunter', {
  keywords: [{ name: 'hunter' }],
  traits: [trait('Elite')],
});
const plainGhoul = blankEnemy('plain_ghoul');
const eliteGhoul = blankEnemy('elite_ghoul', { traits: [trait('Elite')] });

/** Barricade's "Non-Elite enemies cannot move into attached location". */
const barricade: readonly HostRestriction[] = [
  { cannot: 'enemiesMoveInto', of: 'host', exceptTraits: [trait('Elite')] },
];
const barricadeOnHall: Command = {
  type: 'AttachPlayerCard',
  hostId: hall,
  name: cardName('Barricade'),
  typeCode: 'event',
  restrictions: barricade,
};

/** The ID the engine gave the only player card attached in `state`. */
function onlyPlayerCardId(state: GameState): InstanceId {
  const [only] = Object.keys(state.playerCards);
  if (only === undefined) throw new Error('a player card is attached');
  return instanceId(only);
}

describe('AttachPlayerCard', () => {
  it('attaches the named player card to the location, with its restrictions as card data', () => {
    const { context, state } = newGame().withLocation(hall, location).start();

    const after = stateAfter(context, state, barricadeOnHall);

    const id = onlyPlayerCardId(after);
    expect(zoneOf(after, id)).toEqual(attachedTo(hall));
    expect(after.playerCards[after.cards[id]!.code]).toEqual({
      code: id,
      name: 'Barricade',
      typeCode: 'event',
      traits: [],
      restrictions: barricade,
    });
  });

  it('attaches a second card to the same location, each with its own restrictions', () => {
    const { context, state } = newGame().withLocation(hall, location).start();
    const lockedOff: Command = {
      type: 'AttachPlayerCard',
      hostId: hall,
      name: cardName('Ward'),
      typeCode: 'asset',
      restrictions: [{ cannot: 'investigate', of: 'host' }],
    };

    const after = stateAfter(context, state, barricadeOnHall, lockedOff);

    expect(boardView(context, after).location(hall)).toMatchObject({
      attachments: ['Barricade', 'Ward'],
      forbidden: ['investigate'],
    });
  });

  it.each([
    { name: 'a host out of play', hostId: ghoul, attached: 'Handcuffs' },
    { name: 'a host that is no enemy or location', hostId: instanceId('curse'), attached: 'Ward' },
  ])('refuses $name', ({ hostId, attached }) => {
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, plainGhoul, { kind: 'setAside' })
      .withCard(instanceId('curse'), blankTreachery('curse'), {
        kind: 'threatArea',
        investigatorId: alice,
      })
      .start();

    const rejection = rejectionFrom(context, state, {
      type: 'AttachPlayerCard',
      hostId,
      name: cardName(attached),
      typeCode: 'asset',
      restrictions: [],
    });

    expect(rejection.code).toBe('invalidAttachmentHost');
  });

  it('refuses a blank name', () => {
    const { context, state } = newGame().withLocation(hall, location).start();

    const rejection = rejectionFrom(context, state, {
      type: 'AttachPlayerCard',
      hostId: hall,
      name: cardName(' '),
      typeCode: 'event',
      restrictions: [],
    });

    expect(rejection.code).toBe('unnamedAttachment');
  });

  it('leaves play with its host', () => {
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withCard(ghoul, plainGhoul, atLocation(hall))
      .start();

    const after = stateAfter(
      context,
      state,
      {
        type: 'AttachPlayerCard',
        hostId: ghoul,
        name: cardName('Handcuffs'),
        typeCode: 'asset',
        restrictions: [],
      },
      { type: 'DefeatEnemy', enemyId: ghoul },
    );

    expect(isInPlay(after, after.cards[onlyPlayerCardId(after)]!)).toBe(false);
  });

  it('goes back to its owner, out of the game, once discarded', () => {
    const { context, state } = newGame().withLocation(hall, location).start();
    const attached = stateAfter(context, state, barricadeOnHall);

    const after = stateAfter(context, attached, {
      type: 'DiscardCard',
      cardId: onlyPlayerCardId(attached),
    });

    expect(zoneOf(after, onlyPlayerCardId(after))).toEqual({ kind: 'outOfGame' });
  });
});

describe('a location closed to enemies (Barricade)', () => {
  /** study – hall – attic in a row: the hunter at the study, Alice in the attic past the hall. */
  const row = newGame()
    .withLocation(study, location)
    .withLocation(hall, location)
    .withLocation(attic, location)
    .withConnection(study, hall)
    .withConnection(hall, attic)
    .withInvestigator(alice, { locationId: attic });

  it.each([
    { name: 'keeps a hunter out, so it stays', enemy: hunterGhoul, zone: atLocation(study) },
    { name: 'lets an Elite hunter in', enemy: eliteHunter, zone: atLocation(hall) },
  ])('$name', ({ enemy, zone }) => {
    const { context, state } = row.withCard(ghoul, enemy, atLocation(study)).start();

    const after = stateAfter(context, state, barricadeOnHall, { type: 'MoveHunters' });

    expect(zoneOf(after, ghoul)).toEqual(zone);
  });

  it('sends a hunter along the other equally short way, round the hall', () => {
    // study – hall – attic and study – parlor – attic: two ways of two steps to Alice.
    const { context, state } = row
      .withLocation(parlor, location)
      .withConnection(study, parlor)
      .withConnection(parlor, attic)
      .withCard(ghoul, hunterGhoul, atLocation(study))
      .start();

    const after = stateAfter(context, state, barricadeOnHall, { type: 'MoveHunters' });

    expect(zoneOf(after, ghoul)).toEqual(atLocation(parlor));
  });

  it('lets the hunter in again once Barricade is discarded', () => {
    const { context, state } = row.withCard(ghoul, hunterGhoul, atLocation(study)).start();
    const barricaded = stateAfter(context, state, barricadeOnHall);

    const after = stateAfter(
      context,
      barricaded,
      { type: 'DiscardCard', cardId: onlyPlayerCardId(barricaded) },
      { type: 'MoveHunters' },
    );

    expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
  });

  it.each<{ name: string; command: Command }>([
    { name: 'moving it there', command: { type: 'MoveEnemy', enemyId: ghoul, to: hall } },
    {
      name: 'moving it towards Alice',
      command: { type: 'MoveEnemyTowards', enemyId: ghoul, towards: attic },
    },
  ])('keeps a card effect from $name', ({ command }) => {
    const { context, state } = row.withCard(ghoul, plainGhoul, atLocation(study)).start();

    const after = stateAfter(context, state, barricadeOnHall, command);

    expect(zoneOf(after, ghoul)).toEqual(atLocation(study));
  });

  describe('when Alice moves in from the study, engaged with the ghoul', () => {
    /** study – hall, Alice at the study; the ghoul engaged with her is added by each test. */
    const engaged = newGame()
      .withLocation(study, location)
      .withLocation(hall, location)
      .withConnection(study, hall)
      .withInvestigator(alice, { locationId: study });
    const aliceIntoHall: Command = { type: 'MoveInvestigator', investigatorId: alice, to: hall };

    it.each([
      { name: 'leaves a non-Elite ghoul behind', enemy: plainGhoul, zone: atLocation(study) },
      { name: 'takes an Elite ghoul along', enemy: eliteGhoul, zone: engagedWith(alice) },
    ])('$name', ({ enemy, zone }) => {
      const { context, state } = engaged.withCard(ghoul, enemy, engagedWith(alice)).start();

      const after = stateAfter(context, state, barricadeOnHall, aliceIntoHall);

      expect(zoneOf(after, ghoul)).toEqual(zone);
    });

    it('has the ghoul left behind engage Bob, still at the study', () => {
      const { context, state } = engaged
        .withInvestigator(bob, { locationId: study })
        .withCard(ghoul, plainGhoul, engagedWith(alice))
        .start();

      const after = stateAfter(context, state, barricadeOnHall, aliceIntoHall);

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(bob));
    });
  });
});

describe('BoardView of an attached player card', () => {
  it('lists it with the attachments of the location, none on another', () => {
    const table = PlayTable.start(
      newGame().withLocation(hall, location).withLocation(study, location),
    );

    table.play(barricadeOnHall);

    expect(table.board.location(hall).attachments).toEqual(['Barricade']);
    expect(table.board.location(study).attachments).toBeUndefined();
  });

  it('still finds the cards of the table, so a card action can be taken', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall', { actions: [{ effects: [takeHorror(1)] }] }), {
          revealed: true,
        })
        .withInvestigator(alice, { locationId: hall })
        .withTurnOf(alice),
    );
    table.play(barricadeOnHall);

    table.useCardAction(alice, hall);

    expect(investigatorOf(table.state, alice).sanity.horror).toBe(1);
  });
});
