/**
 * Timing corner cases, each played as a short game on a `PlayTable`: what
 * waits for what when a step of a sequence asks the players something. The
 * rules finish a nested sequence, its choices included, before the
 * interrupted one goes on (docs/rules.md, "Timing of forced effects"). The
 * unit tests of each rule sit with the rule; this suite keeps the
 * interactions together, one game per case, so a new corner case is one more
 * `describe` here.
 */
import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAct,
  blankEnemy,
  blankLocation,
  blankTreachery,
  byName,
  confirmOptions,
  decisionId,
  encounterDeck,
  encounterDiscard,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  perInvestigator,
  PlayTable,
  threatAreaOf,
  blankAgenda,
  fixed,
  type Command,
} from './index';

const alice = investigatorId('alice');
const hall = instanceId('hall');

describe('an attack of opportunity before the move that provoked it', () => {
  const cellar = instanceId('cellar');
  /** Hall and cellar, connected; alice in the hall on her turn, engaged with a ghoul dealing 1 damage. */
  const game = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withLocation(cellar, blankLocation('cellar'))
    .withConnection(hall, cellar)
    .withInvestigator(alice, { locationId: hall })
    .withCard(instanceId('ghoul'), blankEnemy('ghoul', { damage: 1 }), engagedWith(alice))
    .withTurnOf(alice);

  it('keeps alice in the hall until the attack is resolved, then moves her', () => {
    const table = PlayTable.start(game);

    table.moveTo(alice, byName('cellar'));

    expect(table.board.decisions).toMatchObject([
      { prompt: 'decision.attackOfOpportunity', about: 'ghoul' },
    ]);
    expect(table.board.investigator(alice).at).toBe('hall');

    table.takeAttackOfOpportunity(byName('ghoul'));

    expect(table.board.investigator(alice)).toMatchObject({ at: 'cellar', damage: 1 });
  });
});

describe('a surge after its card`s revelation', () => {
  /**
   * The hall with alice. Each test puts a surge card on top of the encounter
   * deck with two plain treacheries below it, so drawing two cards leaves one
   * and the discard pile is not shuffled back in.
   */
  const aliceInHall = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall });
  const belowTheSurge = (game: typeof aliceInHall) =>
    game
      .withCard(instanceId('next_card'), blankTreachery('next_card'), encounterDeck)
      .withCard(instanceId('bottom_card'), blankTreachery('bottom_card'), encounterDeck);
  const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

  it('draws the surge card only once the revelation test is resolved', () => {
    const testingSurge = blankTreachery('testing_surge', {
      keywords: [{ name: 'surge' }],
      revelationTest: { skill: 'willpower', difficulty: 3 },
    });
    const table = PlayTable.start(
      belowTheSurge(aliceInHall.withCard(instanceId('surging_card'), testingSurge, encounterDeck)),
    );

    table.play(draw);

    expect(table.board.decisions).toMatchObject([
      { prompt: 'decision.revelationTest', about: 'testing_surge' },
    ]);
    expect(table.board.namesIn({ kind: 'resolving' })).toEqual(['testing_surge']);
    expect(table.board.namesIn(encounterDeck)).toEqual(['next_card', 'bottom_card']);

    table.resolveTest('fail');

    expect(table.board.namesIn(encounterDiscard)).toEqual(['next_card', 'testing_surge']);
    expect(table.board.namesIn(encounterDeck)).toEqual(['bottom_card']);
  });

  it('draws nothing more once the revelation defeated alice, while bob plays on', () => {
    const bob = investigatorId('bob');
    // The revelation deals the drawer 8 damage, alice's whole health.
    const deadlySurge = blankTreachery('deadly_surge', {
      keywords: [{ name: 'surge' }],
      abilities: [
        {
          window: { kind: 'revealed' },
          effects: [
            {
              type: 'AdjustInvestigator',
              investigatorId: { ref: 'windowInvestigator' },
              stat: 'damage',
              delta: 8,
            },
          ],
        },
      ],
    });
    const table = PlayTable.start(
      belowTheSurge(
        newGame()
          .withLocation(hall, blankLocation('hall'))
          .withInvestigator(alice, { locationId: hall, health: { max: 8, damage: 0 } })
          // Bob keeps the scenario going, so the surge stops because alice is out, not because the game ended.
          .withInvestigator(bob, { locationId: hall })
          .withCard(instanceId('surging_card'), deadlySurge, encounterDeck),
      ),
    );

    table.play(draw);

    expect(table.board.perInvestigator('status')).toEqual({ alice: 'defeated', bob: 'active' });
    expect(table.board.ended).toBe(false);
    expect(table.board.namesIn(encounterDiscard)).toEqual(['deadly_surge']);
    expect(table.board.namesIn(encounterDeck)).toEqual(['next_card', 'bottom_card']);
  });
});

describe('hunters moving one at a time', () => {
  const crossroads = instanceId('crossroads');
  const leftPath = instanceId('left_path');
  const rightPath = instanceId('right_path');
  const den = instanceId('den');
  const hunter = { keywords: [{ name: 'hunter' as const }] };
  /**
   * Two routes from the crossroads to alice's den, one by the left path and
   * one by the right: the forked hunter at the crossroads has two equally
   * short routes to her, the second hunter on the left path one.
   */
  const game = newGame()
    .withLocation(crossroads, blankLocation('crossroads'))
    .withLocation(leftPath, blankLocation('left_path'))
    .withLocation(rightPath, blankLocation('right_path'))
    .withLocation(den, blankLocation('den'))
    .withConnection(crossroads, leftPath)
    .withConnection(crossroads, rightPath)
    .withConnection(leftPath, den)
    .withConnection(rightPath, den)
    .withInvestigator(alice, { locationId: den })
    .withCard(
      instanceId('forked_hunter'),
      blankEnemy('forked_hunter', hunter),
      atLocation(crossroads),
    )
    .withCard(
      instanceId('second_hunter'),
      blankEnemy('second_hunter', hunter),
      atLocation(leftPath),
    );

  it('settles the chosen hunter`s route before the other hunter moves', () => {
    const table = PlayTable.start(game);

    table.play({ type: 'MoveHunters' });

    expect(table.board.decisions).toMatchObject([
      { prompt: 'decision.chooseHunterOrder', options: ['forked_hunter', 'second_hunter'] },
    ]);

    table.answerOnly('forked_hunter');

    expect(table.board.decisions).toMatchObject([
      { about: 'forked_hunter', options: ['left_path', 'right_path'] },
    ]);
    expect(table.board.enemy(byName('second_hunter')).at).toBe('left_path');

    table.answer(byName('forked_hunter'), 'right_path');

    expect(table.board.enemies).toEqual([
      { name: 'forked_hunter', at: 'right_path' },
      { name: 'second_hunter', at: 'den', engagedWith: alice },
    ]);
  });
});

describe('the last act whose reverse side asks something', () => {
  const lastAct = blankAct('last_act', { stage: { number: 2 }, clues: perInvestigator(3) });
  /** Two acts and the hall with alice. */
  const game = newGame()
    .withAct(instanceId('first_act'), blankAct('first_act', { clues: perInvestigator(2) }))
    .withAct(instanceId('last_act'), lastAct)
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall });

  it('keeps the last act in play until the lead investigator picks the resolution', () => {
    /** The last act's reverse side asks "burn the house?"; each answer ends the scenario. */
    const table = PlayTable.start(
      game.withHooks({
        onActAdvance: {
          [lastAct.code]: (): Command[] => [
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
      }),
    );

    table.play({ type: 'AdvanceAct' });
    table.play({ type: 'AdvanceAct' });

    expect(table.board).toMatchObject({
      act: { name: 'last_act' },
      ended: false,
      decisions: [{ prompt: 'decision.burnTheHouse' }],
    });

    table.answerOnly('spare it');

    expect(table.board).toMatchObject({ act: undefined, ended: true, resolution: 'R2' });
  });
});

describe('a forced effect that asks two questions', () => {
  /** The hall with alice, who has no resources. */
  const game = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall, resources: 0 });

  it('asks the second question only once the first is answered', () => {
    const gainResource: Command = {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'resources',
      delta: 1,
    };
    /** After doom is placed, the scenario offers alice a resource twice, one question at a time. */
    const table = PlayTable.start(
      game.withHooks({
        afterDoomPlaced: () =>
          ['firstOffer', 'secondOffer'].map((offer): Command => ({
            type: 'RequestDecision',
            decision: {
              id: decisionId(offer),
              kind: 'confirm',
              prompt: `decision.${offer}`,
              decider: { kind: 'lead' },
              options: confirmOptions([gainResource]),
            },
          })),
      }),
    );

    table.play({ type: 'PlaceDoom', cardId: hall, amount: 1 });

    expect(table.board.decisions).toMatchObject([{ prompt: 'decision.firstOffer' }]);

    table.answerOnly('yes');

    expect(table.board.decisions).toMatchObject([{ prompt: 'decision.secondOffer' }]);
    expect(table.board.investigator(alice).resources).toBe(1);

    table.answerOnly('yes');

    expect(table.board.decisions).toEqual([]);
    expect(table.board.investigator(alice).resources).toBe(2);
  });
});

describe('a defeat during the investigator`s own turn', () => {
  const bob = investigatorId('bob');
  const frozen = blankTreachery('frozen', {
    entersThreatArea: true,
    turnEndTest: { skill: 'willpower', difficulty: 3 },
  });
  /** The hall with alice on her turn, a treachery testing her at the end of her turn, and bob. */
  const game = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall, health: { max: 3, damage: 0 } })
    .withInvestigator(bob, { locationId: hall })
    .withCard(instanceId('frozen'), frozen, threatAreaOf(alice))
    .withTurnOf(alice);

  it('ends her turn without its end-of-turn test, and bob takes his', () => {
    const table = PlayTable.start(game);

    table.takeDamage(alice, 3);

    expect(table.board).toMatchObject({ turn: undefined, decisions: [] });
    expect(table.board.investigator(alice)).toMatchObject({ status: 'defeated' });
    expect(table.board.namesIn(encounterDiscard)).toEqual(['frozen']);

    table.startTurn(bob);

    expect(table.board.turn).toBe(bob);
  });
});

describe('enemy attacks after one of them defeated the investigator', () => {
  const bob = investigatorId('bob');
  /** The hall with alice (3 health) engaged with a ghoul dealing 3 damage and a rat; bob keeps the game going. */
  const game = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall, health: { max: 3, damage: 0 } })
    .withInvestigator(bob, { locationId: hall })
    .withCard(instanceId('ghoul'), blankEnemy('ghoul', { damage: 3 }), engagedWith(alice))
    .withCard(instanceId('rat'), blankEnemy('rat', { damage: 1 }), engagedWith(alice));

  it('drops her remaining attack, and both enemies engage bob in the hall', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.startTurn(bob);
    table.endTurn(bob);
    table.nextPhase();
    expect(table.board.attacksDue).toEqual([
      { enemy: 'ghoul', investigator: alice },
      { enemy: 'rat', investigator: alice },
    ]);

    table.resolveEnemyAttacks();

    expect(table.board.investigator(alice).status).toBe('defeated');
    expect(table.board.attacksDue).toEqual([]);
    expect(table.board.enemies).toEqual([
      { name: 'ghoul', at: 'hall', engagedWith: bob, exhausted: true },
      { name: 'rat', at: 'hall', engagedWith: bob },
    ]);
  });
});

describe('a surge with an empty encounter deck', () => {
  const surgingRat = blankEnemy('surging_rat', { keywords: [{ name: 'surge' }] });
  const clinging = blankTreachery('clinging_treachery', { entersThreatArea: true });
  /**
   * The hall with alice; the surging rat is the last card of the deck and a
   * treachery that stays in the drawer's threat area lies in the discard pile.
   */
  const game = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall })
    .withCard(instanceId('surging_rat'), surgingRat, encounterDeck)
    .withCard(instanceId('clinging_treachery'), clinging, encounterDiscard);

  it('shuffles the discard pile back in and draws the surge card from it', () => {
    const table = PlayTable.start(game);

    table.play({ type: 'DrawEncounter', investigatorId: alice });

    expect(table.board.enemy(byName('surging_rat')).engagedWith).toBe(alice);
    expect(table.board.investigator(alice).threatArea).toEqual(['clinging_treachery']);
    expect(table.board.namesIn(encounterDeck)).toEqual([]);
  });
});

describe('doom reaching the threshold outside the mythos phase', () => {
  /** The hall with alice, an agenda with threshold 2 and 1 doom, and the agenda after it. */
  const game = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall })
    .withAgenda(instanceId('first_agenda'), blankAgenda('first_agenda', fixed(2)))
    .withAgenda(
      instanceId('second_agenda'),
      blankAgenda('second_agenda', fixed(9), { stage: { number: 2 } }),
    );

  it('advances the agenda only at the next mythos phase`s threshold check', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();

    table.placeDoom(2);

    expect(table.board).toMatchObject({
      phase: 'enemy',
      agenda: { name: 'first_agenda', doom: 2 },
    });

    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });
    expect(table.board.agenda).toEqual({ name: 'first_agenda', doom: 2, threshold: 2 });

    // Mythos step 1.2 adds its doom before the check, so the agenda carries 3.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'checkDoomThreshold' });
    expect(table.board.decisions).toMatchObject([{ about: 'first_agenda' }]);
  });
});

describe('a per-investigator threshold after an investigator is eliminated', () => {
  const bob = investigatorId('bob');
  /** The hall with alice (3 health) and bob, who has 4 clues; an act needing 2 clues per investigator, then the next act. */
  const game = newGame()
    .withAct(instanceId('first_act'), blankAct('first_act', { clues: perInvestigator(2) }))
    .withAct(instanceId('next_act'), blankAct('next_act', { stage: { number: 2 } }))
    .withLocation(hall, blankLocation('hall'))
    .withInvestigator(alice, { locationId: hall, health: { max: 3, damage: 0 } })
    .withInvestigator(bob, { locationId: hall, clues: 4 })
    .withTurnOf(bob);

  it('still counts the defeated investigator', () => {
    const table = PlayTable.start(game);

    table.takeDamage(alice, 3);

    expect(table.board.investigator(alice).status).toBe('defeated');
    expect(table.board.act).toEqual({ name: 'first_act', clues: 4 });

    table.spendCluesToAdvanceAct([[bob, 4]]);

    expect(table.board.act?.name).toBe('next_act');
  });
});
