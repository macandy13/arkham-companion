/**
 * Timing corner cases, each played as a short game through the public
 * commands: what waits for what when a step of a sequence asks the players
 * something. The rules finish a nested sequence, its choices included,
 * before the interrupted one goes on (docs/rules.md, "Timing of forced
 * effects"). The unit tests of each rule sit with the rule; this suite keeps
 * the interactions together, one game per case, so a new corner case is one
 * more `describe` here.
 */
import { describe, expect, it } from 'vitest';
import {
  blankAct,
  blankEnemy,
  blankLocation,
  blankTreachery,
  confirmOptions,
  decisionId,
  encounterDeck,
  encounterDiscard,
  engagedWith,
  atLocation,
  instanceId,
  investigatorId,
  newGame,
  perInvestigator,
  type Command,
  type GameState,
  type InstanceId,
  type Zone,
} from './index';
import { answer, investigatorOf, pendingIds, stateAfter, withScenario } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const cellar = instanceId('cellar');

/** The zone a card is in. */
function whereIs(state: GameState, cardId: InstanceId): Zone | undefined {
  return state.cards[cardId]?.zone;
}

describe('an attack of opportunity before the move that provoked it', () => {
  const ghoul = instanceId('ghoul');
  /** Hall and cellar, connected; alice in the hall, engaged with a ghoul dealing 1 damage. */
  const table = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withLocation(cellar, blankLocation('cellar'))
    .withConnection(hall, cellar)
    .withInvestigator(alice, { locationId: hall })
    .withCard(ghoul, blankEnemy('ghoul', { damage: 1 }), engagedWith(alice));

  it('keeps alice in the hall until the attack is resolved, then moves her', () => {
    const { context, state } = table.start();
    const aliceTurn = stateAfter(
      context,
      state,
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: alice },
    );

    const attacked = stateAfter(context, aliceTurn, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
      asAction: true,
    });
    const moved = stateAfter(context, attacked, answer('attackOfOpportunity:ghoul', 'attack'));

    expect(pendingIds(attacked)).toEqual(['attackOfOpportunity:ghoul']);
    expect(investigatorOf(attacked, alice).locationId).toBe(hall);
    expect(investigatorOf(moved, alice).locationId).toBe(cellar);
    expect(investigatorOf(moved, alice).health.damage).toBe(1);
  });
});

describe('a surge after a revelation that asks something', () => {
  const surgingCard = instanceId('surging_card');
  const nextCard = instanceId('next_card');
  const bottomCard = instanceId('bottom_card');
  /**
   * The hall with alice. Each test fills the encounter deck with a surge card,
   * a plain treachery below it and one more at the bottom, so drawing both
   * leaves a card and the discard pile is not shuffled back in.
   */
  const aliceInHall = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall });
  const plainTreachery = blankTreachery('plain_treachery');
  const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

  it('draws the surge card only once the revelation test is resolved', () => {
    const testingSurge = blankTreachery('testing_surge', {
      keywords: [{ name: 'surge' }],
      revelationTest: { skill: 'willpower', difficulty: 3 },
    });
    const { context, state } = aliceInHall
      .withCard(surgingCard, testingSurge, encounterDeck)
      .withCard(nextCard, plainTreachery, encounterDeck)
      .withCard(bottomCard, plainTreachery, encounterDeck)
      .start();

    const testing = stateAfter(context, state, draw);
    const resolved = stateAfter(context, testing, answer('revelation:surging_card', 'fail'));

    expect(pendingIds(testing)).toEqual(['revelation:surging_card']);
    expect(whereIs(testing, surgingCard)).toEqual({ kind: 'resolving' });
    expect(whereIs(testing, nextCard)).toEqual(encounterDeck);
    expect(whereIs(resolved, surgingCard)).toEqual(encounterDiscard);
    expect(whereIs(resolved, nextCard)).toEqual(encounterDiscard);
  });

  it('draws nothing more once the revelation defeated alice', () => {
    const deadlySurge = blankTreachery('deadly_surge', { keywords: [{ name: 'surge' }] });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'))
      .withInvestigator(alice, { locationId: hall, health: { max: 8, damage: 0 } })
      .withCard(surgingCard, deadlySurge, encounterDeck)
      .withCard(nextCard, plainTreachery, encounterDeck)
      .withCard(bottomCard, plainTreachery, encounterDeck)
      .withEffects({
        // The revelation asks alice to confirm 8 damage, her whole health.
        [deadlySurge.code]: {
          onReveal: () => [
            {
              type: 'RequestDecision',
              decision: {
                id: decisionId('deadly'),
                kind: 'confirm',
                prompt: 'decision.deadly',
                decider: { kind: 'investigator', investigatorId: alice },
                options: confirmOptions([
                  { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 8 },
                ]),
              },
            },
          ],
        },
      })
      .start();

    const asked = stateAfter(context, state, draw);
    const defeated = stateAfter(context, asked, answer('deadly', 'yes'));

    expect(investigatorOf(defeated, alice).status).toBe('defeated');
    expect(whereIs(defeated, surgingCard)).toEqual(encounterDiscard);
    expect(whereIs(defeated, nextCard)).toEqual(encounterDeck);
  });
});

describe('hunters moving one at a time', () => {
  const forked = instanceId('forked_hunter');
  const second = instanceId('second_hunter');
  const hunterGhoul = blankEnemy('hunter_ghoul', { keywords: [{ name: 'hunter' }] });
  const crossroads = instanceId('crossroads');
  const leftPath = instanceId('left_path');
  const rightPath = instanceId('right_path');
  const den = instanceId('den');
  /**
   * Two routes from the crossroads to alice's den, one by the left path and
   * one by the right: the forked hunter at the crossroads has two equally
   * short routes to her, the second hunter on the left path one.
   */
  const table = newGame()
    .withLocation(crossroads, blankLocation('crossroads'))
    .withLocation(leftPath, blankLocation('left_path'))
    .withLocation(rightPath, blankLocation('right_path'))
    .withLocation(den, blankLocation('den'))
    .withConnection(crossroads, leftPath)
    .withConnection(crossroads, rightPath)
    .withConnection(leftPath, den)
    .withConnection(rightPath, den)
    .withInvestigator(alice, { locationId: den })
    .withCard(forked, hunterGhoul, atLocation(crossroads))
    .withCard(second, hunterGhoul, atLocation(leftPath));

  it('settles the chosen hunter`s route before the other hunter moves', () => {
    const { context, state } = table.start();

    const orderAsked = stateAfter(context, state, { type: 'MoveHunters' });
    const routeAsked = stateAfter(context, orderAsked, answer('hunterOrder', forked));
    const moved = stateAfter(
      context,
      routeAsked,
      answer('hunter:forked_hunter:location', 'right_path'),
    );

    expect(pendingIds(orderAsked)).toEqual(['hunterOrder']);
    expect(pendingIds(routeAsked)).toEqual(['hunter:forked_hunter:location']);
    expect(whereIs(routeAsked, second)).toEqual(atLocation(leftPath));
    expect(whereIs(moved, forked)).toEqual(atLocation(rightPath));
    expect(whereIs(moved, second)).toEqual(engagedWith(alice));
  });
});

describe('the last act whose reverse side asks something', () => {
  const firstAct = instanceId('first_act');
  const lastAct = instanceId('last_act');
  const lastActCard = blankAct('last_act', { stage: { number: 2 }, clues: perInvestigator(3) });
  /** Two acts and the hall with alice. */
  const table = newGame()
    .withAct(firstAct, blankAct('first_act', { clues: perInvestigator(2) }))
    .withAct(lastAct, lastActCard)
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall });

  it('keeps the last act in play until the lead investigator picks the resolution', () => {
    const { context, state } = table.start();
    /** The last act's reverse side asks "burn the house?"; each answer ends the scenario. */
    const burnTheHouse = withScenario(context, {
      hooks: {
        onActAdvance: {
          [lastActCard.code]: (): Command[] => [
            {
              type: 'RequestDecision',
              decision: {
                id: decisionId('burn_the_house'),
                kind: 'chooseOption',
                prompt: 'decision.burnTheHouse',
                decider: { kind: 'lead' },
                options: [
                  {
                    id: 'burn',
                    label: 'burn it',
                    commands: [{ type: 'EndScenario', resolution: 'R1' }],
                  },
                  {
                    id: 'spare',
                    label: 'spare it',
                    commands: [{ type: 'EndScenario', resolution: 'R2' }],
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const asked = stateAfter(burnTheHouse, state, { type: 'AdvanceAct' }, { type: 'AdvanceAct' });
    const ended = stateAfter(burnTheHouse, asked, answer('burn_the_house', 'spare'));

    expect(pendingIds(asked)).toEqual(['burn_the_house']);
    expect(asked.act.current).toBe(lastAct);
    expect(asked.meta.ended).toBeUndefined();
    expect(ended.meta).toMatchObject({ ended: true, resolution: 'R2' });
    expect(ended.act.current).toBeUndefined();
  });
});

describe('a forced effect that asks two questions', () => {
  /** The hall with alice, who has no resources. */
  const table = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall, resources: 0 });

  it('asks the second question only once the first is answered', () => {
    const { context, state } = table.start();
    const gainResource: Command = {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'resources',
      delta: 1,
    };
    /** After doom is placed, the scenario offers alice a resource twice, one question at a time. */
    const offerTwice = withScenario(context, {
      hooks: {
        afterDoomPlaced: () =>
          ['first_offer', 'second_offer'].map((id): Command => ({
            type: 'RequestDecision',
            decision: {
              id: decisionId(id),
              kind: 'confirm',
              prompt: 'decision.applyForcedEffect',
              decider: { kind: 'lead' },
              options: confirmOptions([gainResource]),
            },
          })),
      },
    });

    const firstAsked = stateAfter(offerTwice, state, {
      type: 'PlaceDoom',
      cardId: hall,
      amount: 1,
    });
    const secondAsked = stateAfter(offerTwice, firstAsked, answer('first_offer', 'yes'));
    const done = stateAfter(offerTwice, secondAsked, answer('second_offer', 'yes'));

    expect(pendingIds(firstAsked)).toEqual(['first_offer']);
    expect(pendingIds(secondAsked)).toEqual(['second_offer']);
    expect(investigatorOf(secondAsked, alice).resources).toBe(1);
    expect(done.pending).toEqual([]);
    expect(investigatorOf(done, alice).resources).toBe(2);
  });
});
