import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  blankAsset,
  blankEnemy,
  blankEvent,
  blankLocation,
  blankPlayerAsset,
  blankTreachery,
  boardView,
  cardCode,
  engagedWith,
  instanceId,
  investigatorId,
  isInPlay,
  newGame,
  PlayTable,
  trait,
  zoneKey,
  zoneOf,
  type Command,
  type GameState,
  type InstanceId,
} from './index';
import { rejectionFrom, stateAfter } from '../test/utils';

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

/** Barricade: "Non-Elite enemies cannot move into attached location". */
const barricade = blankEvent('barricade', {
  restrictions: [{ cannot: 'enemiesMoveInto', of: 'host', exceptTraits: [trait('Elite')] }],
});
const barricadeOnHall: Command = { type: 'AttachPlayerCard', hostId: hall, code: barricade.code };

/** The only card attached to `hostId` in `state`. */
function onlyAttachmentOf(state: GameState, hostId: InstanceId): InstanceId {
  const [only, ...more] = state.order[zoneKey(attachedTo(hostId))] ?? [];
  if (only === undefined || more.length > 0) throw new Error(`one card is attached to ${hostId}`);
  return only;
}

describe('AttachPlayerCard', () => {
  it('attaches the player card to the location', () => {
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withCardData(barricade)
      .start();

    const after = stateAfter(context, state, barricadeOnHall);

    expect(after.cards[onlyAttachmentOf(after, hall)]).toMatchObject({
      code: 'barricade',
      faceUp: true,
    });
  });

  it('attaches a second card to the same location, each with its own restrictions', () => {
    const lockedOff = blankPlayerAsset('locked_off', {
      restrictions: [{ cannot: 'investigate', of: 'host' }],
    });
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withCardData(barricade)
      .withCardData(lockedOff)
      .start();

    const after = stateAfter(context, state, barricadeOnHall, {
      type: 'AttachPlayerCard',
      hostId: hall,
      code: lockedOff.code,
    });

    expect(boardView(context, after).location(hall)).toMatchObject({
      attachments: ['barricade', 'locked_off'],
      forbidden: ['investigate'],
    });
  });

  it.each([
    { name: 'a host out of play', hostId: ghoul, card: 'barricade', code: 'invalidAttachmentHost' },
    {
      name: 'a host that is no enemy or location',
      hostId: instanceId('curse'),
      card: 'barricade',
      code: 'invalidAttachmentHost',
    },
    { name: 'a card that is no player card', hostId: hall, card: 'curse', code: 'notAPlayerCard' },
    { name: 'a story asset', hostId: hall, card: 'story_asset', code: 'notAPlayerCard' },
  ])('refuses $name', ({ hostId, card, code }) => {
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withInvestigator(alice, { locationId: hall })
      .withCardData(barricade)
      .withCardData(blankAsset('story_asset'))
      .withCard(ghoul, plainGhoul, { kind: 'setAside' })
      .withCard(instanceId('curse'), blankTreachery('curse'), {
        kind: 'threatArea',
        investigatorId: alice,
      })
      .start();

    const rejection = rejectionFrom(context, state, {
      type: 'AttachPlayerCard',
      hostId,
      code: cardCode(card),
    });

    expect(rejection.code).toBe(code);
  });

  it('leaves play with its host', () => {
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withCard(ghoul, plainGhoul, atLocation(hall))
      .withCardData(barricade)
      .start();

    const after = stateAfter(
      context,
      state,
      { type: 'AttachPlayerCard', hostId: ghoul, code: barricade.code },
      { type: 'DefeatEnemy', enemyId: ghoul },
    );

    expect(isInPlay(after, after.cards[onlyAttachmentOf(after, ghoul)]!)).toBe(false);
  });

  it('goes back to its owner, out of the game, once discarded', () => {
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withCardData(barricade)
      .start();
    const attached = stateAfter(context, state, barricadeOnHall);
    const id = onlyAttachmentOf(attached, hall);

    const after = stateAfter(context, attached, { type: 'DiscardCard', cardId: id });

    expect(zoneOf(after, id)).toEqual({ kind: 'outOfGame' });
  });

  it('leaves a story asset to go to the encounter discard', () => {
    const lantern = instanceId('lantern');
    const { context, state } = newGame()
      .withLocation(hall, location)
      .withCard(lantern, blankAsset('lantern'), attachedTo(hall))
      .start();

    const after = stateAfter(context, state, { type: 'DiscardCard', cardId: lantern });

    expect(zoneOf(after, lantern)).toEqual({ kind: 'encounterDiscard' });
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
    .withInvestigator(alice, { locationId: attic })
    .withCardData(barricade);

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
      { type: 'DiscardCard', cardId: onlyAttachmentOf(barricaded, hall) },
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
      .withInvestigator(alice, { locationId: study })
      .withCardData(barricade);
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
      newGame().withLocation(hall, location).withLocation(study, location).withCardData(barricade),
    );

    table.play(barricadeOnHall);

    expect(table.board.location(hall).attachments).toEqual(['barricade']);
    expect(table.board.location(study).attachments).toBeUndefined();
  });
});
