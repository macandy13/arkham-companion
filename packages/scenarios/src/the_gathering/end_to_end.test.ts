/**
 * The Gathering, played end to end: Roland Banks, Daisy Walker and Wendy
 * Adams, a fixed seed, eleven rounds to resolution 1. An integration narrative rather than a
 * rules test – it shows the engine features working together in a real
 * scenario (setup, the phase assistant, turns and actions, skill tests,
 * clues, undoing a mis-tapped move, act 1's reverse side, doom and the agenda, encounter draws and revelation
 * tests, spawn instructions, engagement, hunters, attacks, attacks of opportunity, upkeep, undoing a whole mythos phase,
 * resigning, the reverse sides of agenda 2 and acts 2 and 3, and the end of the scenario) as one
 * session report: game-language steps on a `PlayTable`, phase by phase and
 * turn by turn, with the facts a player would check at the table asserted
 * where they happen.
 *
 * Each later engine PR extends this story with its feature (see M1.E in
 * docs/tasks/done/M1-engine.md). Rules rest in the unit tests; this test keeps
 * them honest together.
 *
 * The phase assistant (`nextPhase`) runs the steps of each phase, numbered as
 * in the Rules Reference (1.2 doom, 1.3 threshold check, 1.4 encounter draws,
 * 3.2 hunters, 3.3 attacks, 4.2 reset actions, 4.3 ready, 4.4 resources, 4.6
 * round end), and stops wherever the players have to answer; each "Next"
 * asserts where it stopped (round, phase and the step a decision or an
 * attack holds it at). The board is read back as structured data (enemies,
 * decisions, attacks due), with full-board snapshots only at setup and at the
 * end of round 7. Each investigation turn is started and ended explicitly, in the order the group
 * chooses; the players count actions off each investigator's counter
 * themselves, where the script shows it. Skill tests are resolved at the table: the engine asks for the
 * result (`skillTestResult`), and the comments say why it is a pass or fail.
 * What a failed revelation costs is card text, so the script applies it by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  byName,
  campaign,
  campaignId,
  cardDbWith,
  enemyMatching,
  investigatorId,
  mapId,
  PlayTable,
  replay,
  scenario,
  type ScenarioContext,
} from '@arkham/engine';
import { answer } from '@arkham/engine/test/utils';
import {
  BURN_THE_HOUSE_DECISION,
  WHATS_GOING_ON_DECISION,
  theGathering,
  theGatheringCards,
  nightOfTheZealot,
  theGatheringResolutions,
  theMidnightMasks,
  theMidnightMasksCardDefs,
} from '../index';
import { daisyWalker, rolandBanks, wendyAdams, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(theGatheringCards, zealotInvestigatorCards),
  scenario: theGathering,
};
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');
const wendy = investigatorId('wendy');
/** Roland, Daisy and Wendy in seat order. */
const zealotSeats = [
  { id: roland, code: rolandBanks.code },
  { id: daisy, code: daisyWalker.code },
  { id: wendy, code: wendyAdams.code },
];

const icyGhoul = 'Icy Ghoul';
const swarmOfRats = 'Swarm of Rats';
const ghoulMinion = 'Ghoul Minion';
const ravenousGhoul = 'Ravenous Ghoul';

describe('The Gathering end to end: Roland, Daisy and Wendy, seed 24', () => {
  it('plays from setup to resolution 1: act 1 opens the house, enemies spawn, hunt, attack and are defeated, Wendy resigns, the ghouls rise, act 2 brings the Ghoul Priest and its defeat lets the group burn the house', () => {
    // Setup
    const table = PlayTable.setUp(ctx, { investigators: zealotSeats, seed: 24 });

    expect(table.formatted()).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: What's Going On?! – doom 0/3
      Act: Trapped – needs 6 clues
      Map Study:
        Study [01111#1] – revealed, 6 clues
          investigators: Roland Banks, Daisy Walker, Wendy Adams
          connects to: none
      Investigators:
        Roland Banks – Study; damage 0/9, horror 0/5, 0 clues, 5 resources, actions left 3; threat area: none
        Daisy Walker – Study; damage 0/5, horror 0/9, 0 clues, 5 resources, actions left 3; threat area: none
        Wendy Adams – Study; damage 0/7, horror 0/7, 0 clues, 5 resources, actions left 3; threat area: none
      Encounter deck: 26 cards; discard: 0 cards
      Set aside: 6 cards
      Victory display: none
      Pending decisions: none"
    `);
    // The seed fixes the encounter deck; the draws below follow this order.
    expect(table.board.namesIn({ kind: 'encounterDeck' }).slice(0, 12)).toEqual([
      ...['Icy Ghoul', 'Crypt Chill', 'Ancient Evils'],
      ...['Swarm of Rats', 'Ghoul Minion', 'Ancient Evils'],
      ...['Grasping Hands', 'Ghoul Minion', 'Flesh-Eater'],
      ...['Rotting Remains', 'Ravenous Ghoul', 'Frozen in Fear'],
    ]);

    // Round 1 – the first round has no mythos phase
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });

    // Round 1 – investigation: Roland's turn (intellect 3 against the Study's shroud 2)
    table.startTurn(roland);
    table.investigate(roland);
    table.investigate(roland);
    // The players count both actions off Roland's counter.
    table.adjustActions(roland, -2);

    expect(table.board.turn).toBe(roland);
    expect(table.board.perInvestigator('actions')).toEqual({ roland: 1, daisy: 3, wendy: 3 });

    table.endTurn(roland);

    // Round 1 – investigation: Daisy's turn. She commits Deduction to her
    // investigation (intellect 5), which discovers 1 additional clue on a success.
    table.startTurn(daisy);
    table.investigate(daisy, { clues: 2 });
    table.endTurn(daisy);

    expect(table.board.perInvestigator('clues')).toEqual({ roland: 2, daisy: 2, wendy: 0 });

    // Round 1 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.investigate(wendy);
    table.investigate(wendy);
    // Still in her turn, the Study's 6 clues pay act 1 (2 per investigator) –
    // advancing the act is no action. Its reverse side opens the house.
    table.spendCluesToAdvanceAct([
      [roland, 2],
      [daisy, 2],
      [wendy, 2],
    ]);

    expect(table.board.act?.name).toBe('The Barrier');
    expect(table.board.locationsOn(mapId('house'))).toEqual([
      'Hallway',
      'Attic',
      'Cellar',
      'Parlor',
    ]);
    expect(table.board.perInvestigator('at')).toEqual({
      roland: 'Hallway',
      daisy: 'Hallway',
      wendy: 'Hallway',
    });
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 0, daisy: 0, wendy: 0 });
    expect(table.board.namesIn({ kind: 'outOfGame' })).toEqual(['Study', 'Trapped']);

    table.endTurn(wendy);

    // Round 1 – enemy phase: no enemy is in play yet
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });

    expect(table.board.attacksDue).toEqual([]);

    // Round 1 – upkeep: 4.2 resets Roland's counter, 4.4 each investigator
    // gains a resource, 4.6 the round ends
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });

    expect(table.board.perInvestigator('actions')).toEqual({ roland: 3, daisy: 3, wendy: 3 });
    expect(table.board.perInvestigator('resources')).toEqual({ roland: 6, daisy: 6, wendy: 6 });

    // Round 2 – mythos: 1.2 doom, 1.3 below the threshold, 1.4 Roland draws the
    // Icy Ghoul, which spawns in the Cellar, and Daisy draws Crypt Chill: its
    // revelation test stops the phase at Daisy's step 1.4 until the players enter the result.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });

    expect(table.board.enemies).toEqual([{ name: icyGhoul, at: 'Cellar', health: 4 }]);
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Crypt Chill',
        for: daisy,
        test: { skill: 'willpower', difficulty: 4 },
        options: ['pass', 'fail'],
      },
    ]);
    // Crypt Chill is discarded only once its revelation has resolved.
    expect(table.board.namesIn({ kind: 'resolving' })).toEqual(['Crypt Chill']);
    expect(table.board.namesIn({ kind: 'encounterDiscard' })).toEqual([]);

    // Willpower 3 and a +1 token reach the difficulty of 4: Daisy passes.
    table.answer(byName('Crypt Chill'), 'pass');

    expect(table.board.namesIn({ kind: 'resolving' })).toEqual([]);
    expect(table.board.namesIn({ kind: 'encounterDiscard' })).toEqual(['Crypt Chill']);

    // 1.4 continues: Wendy draws Ancient Evils, 1 doom on the agenda. The
    // mythos phase has run all its steps; the next "Next" moves on.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    table.placeDoom(1);

    expect(table.board.agenda).toMatchObject({ name: "What's Going On?!", doom: 2, threshold: 3 });
    expect(table.board.namesIn({ kind: 'encounterDiscard' })).toEqual([
      'Ancient Evils',
      'Crypt Chill',
    ]);

    // Round 2 – investigation: Roland's turn (the Attic's shroud is 1)
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(roland);
    // A mis-tapped move to the Parlor is taken back.
    table.moveTo(roland, byName('Parlor'));

    expect(table.board.perInvestigator('at')).toMatchObject({ roland: 'Parlor' });

    table.undo();

    expect(table.board.perInvestigator('at')).toMatchObject({ roland: 'Hallway' });

    // Entering the Attic costs him 1 horror.
    table.moveTo(roland, byName('Attic'));
    expect(table.board.investigator(roland)).toMatchObject({ horror: 1 });
    table.investigate(roland);
    table.investigate(roland);
    table.endTurn(roland);

    // Round 2 – investigation: Wendy's turn (the group lets her go before Daisy)
    table.startTurn(wendy);
    // Entering the Cellar costs her 1 damage and engages the ready Icy Ghoul
    // waiting there, which is no action.
    table.moveTo(wendy, byName('Cellar'));
    expect(table.board.investigator(wendy)).toMatchObject({ damage: 1 });
    expect(table.board.enemy(byName(icyGhoul))).toMatchObject({ at: 'Cellar', engagedWith: wendy });
    table.endTurn(wendy);

    // Round 2 – investigation: Daisy's turn (intellect 5 against the Cellar's shroud 4)
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Cellar'));
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.board.perInvestigator('at')).toEqual({
      roland: 'Attic',
      daisy: 'Cellar',
      wendy: 'Cellar',
    });
    expect(table.board.location(byName('Attic')).clues).toBe(4);
    expect(table.board.location(byName('Cellar')).clues).toBe(5);

    // Round 2 – enemy phase: 3.2 no hunter, 3.3 the Icy Ghoul attacks Wendy
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.board.attacksDue).toEqual([{ enemy: icyGhoul, investigator: wendy }]);

    table.resolveEnemyAttacks();

    expect(table.board.investigator(wendy)).toMatchObject({ damage: 3, horror: 1 });

    // Round 2 – upkeep
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });

    // Round 3 – mythos: 1.2 brings the doom to the threshold, and the agenda
    // question comes at 1.3, the only regular moment the agenda can advance.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'checkDoomThreshold' });

    expect(table.board.agenda).toMatchObject({ name: "What's Going On?!", doom: 3, threshold: 3 });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.advanceAgenda',
        kind: 'confirm',
        about: "What's Going On?!",
        options: ['yes', 'no'],
      },
    ]);
    expect(table.board.enemies).toEqual([
      { name: icyGhoul, at: 'Cellar', health: 4, engagedWith: wendy },
    ]);

    // Nothing else can happen while the question is open.
    expect(() => table.nextPhase()).toThrow(
      expect.objectContaining({ rejection: expect.objectContaining({ code: 'decisionPending' }) }),
    );

    // The players answer yes. The reverse side lets the lead investigator choose.
    table.answer(byName("What's Going On?!"), 'yes');

    expect(table.board.decisions).toEqual([
      {
        prompt: 'scenario.theGathering.whatsGoingOn.prompt',
        kind: 'chooseOption',
        options: [
          'scenario.theGathering.whatsGoingOn.discard',
          'scenario.theGathering.whatsGoingOn.horror',
        ],
      },
    ]);

    // Roland, already shaken by the Attic, picks the random discard from each
    // hand, done at the table; nobody takes horror.
    table.play(answer(WHATS_GOING_ON_DECISION, 'discard'));

    expect(table.board.investigator(roland)).toMatchObject({ horror: 1 });
    expect(table.board.agenda).toMatchObject({ name: 'Rise of the Ghouls', doom: 0, threshold: 7 });
    expect(table.board.decisions).toEqual([]);

    // 1.4: Roland draws the Swarm of Rats, Daisy a Ghoul Minion, Wendy Ancient Evils.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    table.placeDoom(1);

    expect(table.board.enemies).toEqual([
      { name: icyGhoul, at: 'Cellar', health: 4, engagedWith: wendy },
      { name: swarmOfRats, at: 'Attic', health: 1, engagedWith: roland },
      { name: ghoulMinion, at: 'Cellar', health: 2, engagedWith: daisy },
    ]);

    // Round 3 – investigation: Roland's turn (agility 2 plus a good chaos token against the rats' evade 3)
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    table.startTurn(roland);
    table.evade(roland, byName(swarmOfRats));
    table.moveTo(roland, byName('Hallway'));
    table.moveTo(roland, byName('Cellar'));
    expect(table.board.investigator(roland)).toMatchObject({ damage: 1, horror: 1 });
    table.adjustActions(roland, -3);

    // The counter tells the players that a fourth action is beyond Roland's three.
    expect(() => table.adjustActions(roland, -1)).toThrow(
      expect.objectContaining({
        rejection: expect.objectContaining({ code: 'invalidActionAdjustment' }),
      }),
    );
    expect(table.board.investigator(roland).actions).toBe(0);

    table.endTurn(roland);

    // Round 3 – investigation: Daisy's turn (the minion's fight is 2)
    table.startTurn(daisy);
    table.fight(daisy, byName(ghoulMinion));
    table.fight(daisy, byName(ghoulMinion));
    table.endTurn(daisy);

    expect(table.board.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Ghoul Minion');

    // Round 3 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.fight(wendy, byName(icyGhoul));
    table.fight(wendy, byName(icyGhoul));
    table.endTurn(wendy);

    // Round 3 – enemy phase: the evaded rats are exhausted and stay; the Icy Ghoul attacks again
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();

    expect(table.board.investigator(wendy)).toMatchObject({ damage: 5, horror: 2 });

    // Round 3 – upkeep: 4.3 readies the rats; nobody is in the Attic, so they stay unengaged.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });

    expect(table.board.enemies).toEqual([
      { name: icyGhoul, at: 'Cellar', health: 4, engagedWith: wendy, damage: 2 },
      { name: swarmOfRats, at: 'Attic', health: 1 },
    ]);

    // Round 4 – mythos: Roland draws Grasping Hands, an agility (3) test
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Grasping Hands',
        for: roland,
        test: { skill: 'agility', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);

    // With agility 2 he fails by 1, so he takes 1 damage.
    table.resolveTest({ failedBy: 1 });
    expect(table.board.investigator(roland)).toMatchObject({ damage: 2 });
    // 1.4 continues: Daisy draws a Ghoul Minion, Wendy the Flesh-Eater.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });

    expect(table.board.enemies).toEqual([
      { name: 'Flesh-Eater', at: 'Attic', health: 4 },
      { name: icyGhoul, at: 'Cellar', health: 4, engagedWith: wendy, damage: 2 },
      { name: swarmOfRats, at: 'Attic', health: 1 },
      { name: ghoulMinion, at: 'Cellar', health: 2, engagedWith: daisy },
    ]);

    // Round 4 – investigation: Roland's turn. He takes the Icy Ghoul over and
    // commits Vicious Blow to his attack: the players confirm 2 damage.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    table.startTurn(roland);
    table.engage(roland, byName(icyGhoul));
    table.fight(roland, byName(icyGhoul), { damage: 2 });

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual(['Icy Ghoul']);

    // His third action is the resource action.
    table.gainResources(roland, 1);
    table.endTurn(roland);

    // Round 4 – investigation: Daisy's turn. Her ability grants an additional
    // action for Tome abilities: she reads her Old Book of Lore with it, then
    // fights twice. The players count those three actions off her four.
    table.startTurn(daisy);
    table.adjustActions(daisy, 1);
    table.fight(daisy, byName(ghoulMinion));
    table.fight(daisy, byName(ghoulMinion));
    table.adjustActions(daisy, -3);

    expect(table.board.investigator(daisy).actions).toBe(1);

    table.endTurn(daisy);

    // Round 4 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.investigate(wendy);
    table.investigate(wendy);
    table.endTurn(wendy);

    expect(table.board.location(byName('Cellar')).clues).toBe(3);

    // Round 4 – enemy phase: with everyone in the Cellar the rats hunt them; nobody is attacked.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'enemy' });

    expect(table.board.attacksDue).toEqual([]);
    expect(table.board.agenda).toMatchObject({ name: 'Rise of the Ghouls', doom: 2, threshold: 7 });
    expect(table.board.enemies).toEqual([
      { name: 'Flesh-Eater', at: 'Attic', health: 4 },
      { name: swarmOfRats, at: 'Hallway', health: 1 },
    ]);

    // Round 4 – upkeep
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'upkeep' });

    // Round 5 – mythos: Roland draws Rotting Remains, a willpower (3) test
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Rotting Remains',
        for: roland,
        test: { skill: 'willpower', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);

    // With willpower 3 he passes and takes no horror.
    table.answer(byName('Rotting Remains'), 'pass');
    // 1.4 continues: Daisy draws the Ravenous Ghoul, Wendy Frozen in Fear.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos' });

    expect(table.board.agenda).toMatchObject({ name: 'Rise of the Ghouls', doom: 3, threshold: 7 });
    expect(table.board.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([
      'Frozen in Fear',
    ]);

    // Round 5 – investigation: Roland's and Daisy's turns pass without actions
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'investigation' });
    table.startTurn(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.endTurn(daisy);

    // The phase cannot end before Wendy has had her turn.
    expect(() => table.nextPhase()).toThrow(
      expect.objectContaining({ rejection: expect.objectContaining({ code: 'turnsNotTaken' }) }),
    );

    // Round 5 – investigation: Wendy's turn. At its end Frozen in Fear asks
    // for its willpower (3) test; she fails, so it stays.
    table.startTurn(wendy);
    table.investigate(wendy);
    table.endTurn(wendy);
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Frozen in Fear',
        for: wendy,
        test: { skill: 'willpower', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);
    table.answer(byName('Frozen in Fear'), 'fail');

    // Round 5 – enemy phase: 3.2 the rats reach the Cellar, where three investigators
    // are and none is their prey, so the engine asks whom they engage.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'huntersMove' });

    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.chooseEngagement',
        kind: 'chooseInvestigator',
        about: swarmOfRats,
        options: ['Roland Banks', 'Daisy Walker', 'Wendy Adams'],
      },
    ]);
    expect(table.board.enemies).toEqual([
      { name: 'Flesh-Eater', at: 'Attic', health: 4 },
      { name: swarmOfRats, at: 'Cellar', health: 1 },
      { name: ravenousGhoul, at: 'Cellar', health: 3, engagedWith: daisy },
    ]);

    // The players choose Roland; 3.3 then lists both attacks in player order.
    table.answer(byName(swarmOfRats), 'Roland Banks');
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.board.attacksDue).toEqual([
      { enemy: swarmOfRats, investigator: roland },
      { enemy: ravenousGhoul, investigator: daisy },
    ]);

    table.resolveEnemyAttacks();

    expect(table.board.investigator(roland)).toMatchObject({ damage: 3, horror: 1 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 2, horror: 1 });

    // Round 5 – upkeep
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'upkeep' });

    expect(table.board.perInvestigator('resources')).toEqual({ roland: 11, daisy: 10, wendy: 10 });

    // Round 6 – mythos: Roland draws Rotting Remains again and passes with willpower 3;
    // the Swarms of Rats Daisy and Wendy draw spawn engaged with them.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Rotting Remains',
        for: roland,
        test: { skill: 'willpower', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);
    table.answer(byName('Rotting Remains'), 'pass');
    // Answering only resolves the revelation; the paused phase goes on with the
    // next "Next", which runs Daisy's and Wendy's draws. That finishes the
    // mythos steps but stays in the phase, so the players see what was drawn
    // before the investigation phase begins.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos' });

    expect(table.board.agenda).toMatchObject({ name: 'Rise of the Ghouls', doom: 4, threshold: 7 });
    expect(table.board.enemies).toEqual([
      { name: 'Flesh-Eater', at: 'Attic', health: 4 },
      { name: swarmOfRats, at: 'Cellar', health: 1, engagedWith: daisy },
      { name: swarmOfRats, at: 'Cellar', health: 1, engagedWith: roland },
      { name: swarmOfRats, at: 'Cellar', health: 1, engagedWith: wendy },
      { name: ravenousGhoul, at: 'Cellar', health: 3, engagedWith: daisy },
    ]);

    // Round 6 – investigation: each investigator defeats the rats engaged with them
    // (1 health); Roland then takes the Cellar's last 2 clues. By name alone the
    // table cannot tell the three Swarms of Rats apart, so each fight names the
    // swarm by the investigator it is engaged with.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'investigation' });
    table.startTurn(roland);

    expect(() => table.fight(roland, byName(swarmOfRats))).toThrow(/3 enemies match/);

    table.fight(roland, enemyMatching(byName(swarmOfRats), { engagedWith: roland }));
    table.investigate(roland);
    table.investigate(roland);
    table.endTurn(roland);
    // Daisy then fights the Ravenous Ghoul: the Cellar has no clues left, and
    // fighting is the one useful action that provokes no attack of opportunity.
    // With combat 2 against its fight 3 she misses twice.
    table.startTurn(daisy);
    table.fight(daisy, enemyMatching(byName(swarmOfRats), { engagedWith: daisy }));
    table.fight(daisy, byName(ravenousGhoul), { result: 'fail' });
    table.fight(daisy, byName(ravenousGhoul), { result: 'fail' });
    table.endTurn(daisy);
    table.startTurn(wendy);
    table.fight(wendy, enemyMatching(byName(swarmOfRats), { engagedWith: wendy }));
    table.endTurn(wendy);
    table.answer(byName('Frozen in Fear'), 'fail');

    // Round 6 – enemy phase and upkeep: only the Ravenous Ghoul is left to attack
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.board.attacksDue).toEqual([{ enemy: ravenousGhoul, investigator: daisy }]);

    table.resolveEnemyAttacks();
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'upkeep' });

    // Round 7 – mythos: one command, one undo group. Raising the doom, drawing
    // Grasping Hands and its revelation test are one chain, so taking the
    // command back removes all of it, and running it again gives the same events.
    const eventsBefore = table.events.length;
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });
    const drawn = table.events.slice(eventsBefore);

    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Grasping Hands',
        for: roland,
        test: { skill: 'agility', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);

    table.undo();

    expect(table.board).toMatchObject({ round: 6, phase: 'upkeep' });
    expect(table.board.decisions).toEqual([]);

    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });

    expect(table.events.slice(eventsBefore)).toEqual(drawn);
    expect(table.board.agenda).toMatchObject({ name: 'Rise of the Ghouls', doom: 5, threshold: 7 });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Grasping Hands',
        for: roland,
        test: { skill: 'agility', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);

    // Roland passes (agility 2 and a +1 token), so the Grasping Hands do nothing.
    table.answer(byName('Grasping Hands'), 'pass');
    // 1.4 continues: Daisy's Grasping Hands (agility 3, she passes), then Wendy
    // draws Dissonant Voices, which stays in play in her threat area.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Grasping Hands',
        for: daisy,
        test: { skill: 'agility', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);
    table.answer(byName('Grasping Hands'), 'pass');
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos' });

    expect(table.board.namesIn({ kind: 'threatArea', investigatorId: wendy })).toContain(
      'Dissonant Voices',
    );

    // Round 7 – investigation: Roland goes for the Attic's clues. Entering
    // engages the Flesh-Eater (no action); he searches and takes the 9th clue the group needs.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'investigation' });
    table.startTurn(roland);
    table.moveTo(roland, byName('Hallway'));
    table.moveTo(roland, byName('Attic'));
    expect(table.board.enemy(byName('Flesh-Eater'))).toMatchObject({
      at: 'Attic',
      engagedWith: roland,
    });
    table.investigate(roland, { result: 'open' });

    // Searching while engaged with the ready Flesh-Eater provokes its attack of
    // opportunity on Roland (1 damage, 2 horror). It comes before the search
    // itself, so there is no investigate test yet.
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.attackOfOpportunity',
        kind: 'confirm',
        about: 'Flesh-Eater',
        for: roland,
        options: ['attack', 'does not provoke'],
        defaults: { attack: { damage: 1, horror: 2 } },
      },
    ]);

    // At 2 of 5 sanity, Roland lets his Beat Cop (an ally the app does not
    // model) soak the 2 horror, so the players lower the horror to 0. Only
    // then does the search go ahead with its intellect test.
    table.takeAttackOfOpportunity(byName('Flesh-Eater'), { horror: 0 });

    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.investigate',
        kind: 'skillTestResult',
        about: 'Attic',
        for: roland,
        test: { skill: 'intellect', difficulty: 1 },
        options: ['pass', 'fail'],
        defaults: { pass: { amount: 1 } },
      },
    ]);

    table.resolveTest('pass', { for: roland });

    // The attack does not exhaust the Flesh-Eater, so it attacks again in the enemy phase.
    expect(table.board.investigator(roland)).toMatchObject({ damage: 4, horror: 2 });
    expect(table.board.enemy(byName('Flesh-Eater'))).toEqual({
      name: 'Flesh-Eater',
      at: 'Attic',
      health: 4,
      engagedWith: roland,
    });

    table.endTurn(roland);
    // Daisy, at 3 of 5 damage, evades the Ravenous Ghoul rather than risk its
    // next attack, then takes the resource action.
    table.startTurn(daisy);
    table.evade(daisy, byName(ravenousGhoul));

    expect(table.board.enemy(byName(ravenousGhoul))).toEqual({
      name: ravenousGhoul,
      at: 'Cellar',
      health: 3,
      exhausted: true,
    });

    table.gainResources(daisy, 1);
    table.endTurn(daisy);
    table.startTurn(wendy);
    table.endTurn(wendy);
    table.answer(byName('Frozen in Fear'), 'fail');

    // The Barrier needs 3 clues per investigator, 9 for three: the group holds them now.
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 5, daisy: 1, wendy: 3 });
    expect(table.board.act?.name).toBe('The Barrier');

    // Round 7 – enemy phase: the exhausted Ravenous Ghoul does not attack, the Flesh-Eater does
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.board.attacksDue).toEqual([{ enemy: 'Flesh-Eater', investigator: roland }]);

    table.resolveEnemyAttacks();
    // Upkeep readies the Ravenous Ghoul in the Cellar. Its prey is the lowest
    // remaining health, and Daisy and Wendy both have 2 left, so the players
    // choose: it goes back to Daisy.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'upkeep', step: 'readyExhausted' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.chooseEngagement',
        kind: 'chooseInvestigator',
        about: ravenousGhoul,
        options: ['Daisy Walker', 'Wendy Adams'],
      },
    ]);
    table.answer(byName(ravenousGhoul), 'Daisy Walker');
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'upkeep' });

    // The round has ended, and with it Dissonant Voices: it is back on top of the discard.
    expect(table.formatted()).toMatchInlineSnapshot(`
      "Round 7, upkeep phase
      Agenda: Rise of the Ghouls – doom 5/7
      Act: The Barrier – needs 9 clues
      Map Study:
        no locations
      Map House:
        Hallway [01112#1] – revealed, 0 clues
          connects to: Attic, Cellar, Parlor
        Attic [01113#1] – revealed, 3 clues
          investigators: Roland Banks
          Flesh-Eater [01118#1] – engaged with Roland Banks
          connects to: Hallway
        Cellar [01114#1] – revealed, 0 clues
          investigators: Daisy Walker, Wendy Adams
          Ravenous Ghoul [01161#1] – engaged with Daisy Walker
          connects to: Hallway
        Parlor [01115#1] – unrevealed
          connects to: Hallway
      Investigators:
        Roland Banks – Attic; damage 5/9, horror 4/5, 5 clues, 13 resources, actions left 3; threat area: none
        Daisy Walker – Cellar; damage 3/5, horror 2/9, 1 clues, 13 resources, actions left 3; threat area: none
        Wendy Adams – Cellar; damage 5/7, horror 2/7, 3 clues, 12 resources, actions left 3; threat area: Frozen in Fear
      Encounter deck: 8 cards; discard: 14 cards, top: Dissonant Voices
      Set aside: 2 cards
      Victory display: Icy Ghoul
      Pending decisions: none"
    `);

    // Round 8 – mythos: Roland draws Dissonant Voices and Daisy a Ghoul Minion;
    // Wendy passes her willpower test against Crypt Chill.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Crypt Chill',
        for: wendy,
        test: { skill: 'willpower', difficulty: 4 },
        options: ['pass', 'fail'],
      },
    ]);
    table.answer(byName('Crypt Chill'), 'pass');

    // Round 8 – investigation: Wendy, with Frozen in Fear still on her, resigns.
    // Her 3 clues go to the Cellar and Frozen in Fear is discarded.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'investigation' });
    table.startTurn(wendy);
    table.resign(wendy);

    expect(table.board.turn).toBeUndefined();
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 5, daisy: 1, wendy: 0 });
    expect(table.board.location(byName('Cellar')).clues).toBe(3);
    expect(table.board.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([]);
    expect(table.board.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Frozen in Fear');

    // The phase ends without waiting for Wendy. Roland empties his .38 Special
    // into the Flesh-Eater (2 damage a shot) and searches the Attic again.
    table.startTurn(roland);
    table.fight(roland, byName('Flesh-Eater'), { damage: 2 });
    table.fight(roland, byName('Flesh-Eater'), { damage: 2 });
    table.investigate(roland);
    table.endTurn(roland);
    // Daisy, two damage from defeat, slips away from both ghouls and searches the Cellar.
    table.startTurn(daisy);
    table.evade(daisy, byName(ravenousGhoul));
    table.evade(daisy, byName(ghoulMinion));
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual(['Icy Ghoul', 'Flesh-Eater']);
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 6, daisy: 2, wendy: 0 });

    // Round 8 – enemy phase and upkeep: both ghouls are exhausted, nobody is
    // attacked; readied in upkeep, they engage Daisy again in the Cellar.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'upkeep' });

    // Round 9 – mythos: the 7th doom advances Rise of the Ghouls. Its reverse
    // side shuffles the discard back into the deck and turns cards over until
    // a Ghoul enemy comes up: six cards go to the discard before a Ghoul Minion,
    // which Roland, the lead investigator, draws.
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'mythos', step: 'checkDoomThreshold' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.advanceAgenda',
        kind: 'confirm',
        about: 'Rise of the Ghouls',
        options: ['yes', 'no'],
      },
    ]);
    table.answer(byName('Rise of the Ghouls'), 'yes');

    expect(table.board.agenda).toMatchObject({
      name: "They're Getting Out!",
      doom: 0,
      threshold: 10,
    });
    expect(table.board.namesIn({ kind: 'encounterDiscard' })).toEqual([
      'Grasping Hands',
      'Swarm of Rats',
      'Frozen in Fear',
      'Ancient Evils',
      'Swarm of Rats',
      'Grasping Hands',
    ]);
    expect(table.board.enemy(enemyMatching(byName(ghoulMinion), { engagedWith: roland }))).toEqual({
      name: ghoulMinion,
      at: 'Attic',
      health: 2,
      engagedWith: roland,
    });

    // 1.4: both draw Obscuring Fog, which attaches to the drawer's location
    // (+2 shroud) until that location is investigated successfully.
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'mythos' });
    expect(table.board.location(byName('Attic')).attachments).toEqual(['Obscuring Fog']);
    expect(table.board.location(byName('Cellar')).attachments).toEqual(['Obscuring Fog']);

    // Round 9 – investigation: The Barrier asks for the investigators in the
    // Hallway at the end of the round. Roland shoots the new Ghoul Minion,
    // takes another Attic clue and walks to the Hallway; Daisy evades both
    // ghouls again and follows him.
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, enemyMatching(byName(ghoulMinion), { engagedWith: roland }), { damage: 2 });
    // The fog raises the Attic's shroud from 1 to 3; his successful search
    // clears it.
    table.investigate(roland, { result: 'open' });
    expect(table.board.decisions).toMatchObject([
      { about: 'Attic', test: { skill: 'intellect', difficulty: 3 } },
    ]);
    table.resolveTest('pass', { for: roland });
    expect(table.board.location(byName('Attic')).attachments).toBeUndefined();
    table.moveTo(roland, byName('Hallway'));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.evade(daisy, byName(ghoulMinion));
    table.evade(daisy, byName(ravenousGhoul));
    table.moveTo(daisy, byName('Hallway'));
    table.endTurn(daisy);
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'upkeep' });

    // The round has ended with both in the Hallway holding 9 clues, the 3 per
    // investigator act 2 asks for (Wendy still counts). Its reverse side
    // reveals the Parlor (on the house map, unrevealed, since act 1), puts Lita
    // Chantler there and spawns the Ghoul Priest in the Hallway. The players
    // pick whom it engages by its prey (highest combat): Roland.
    expect(table.board.perInvestigator('at')).toEqual({
      roland: 'Hallway',
      daisy: 'Hallway',
      wendy: 'Cellar',
    });
    table.spendCluesToAdvanceAct([
      [roland, 7],
      [daisy, 2],
    ]);
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.chooseEngagement',
        kind: 'chooseInvestigator',
        about: 'Ghoul Priest',
        options: ['Roland Banks', 'Daisy Walker'],
      },
    ]);
    // The act's reverse side is still resolving, so it stays current until the answer.
    expect(table.board.act?.name).toBe('The Barrier');
    table.answer(byName('Ghoul Priest'), 'Roland Banks');

    expect(table.board.act?.name).toBe('What Have You Done?');
    expect(table.board.location(byName('Parlor')).cards).toEqual(['Lita Chantler']);
    expect(table.board.enemy(byName('Ghoul Priest'))).toEqual({
      name: 'Ghoul Priest',
      at: 'Hallway',
      health: 15,
      engagedWith: roland,
    });

    // Round 10 – mythos: Roland draws Dissonant Voices, Daisy Rotting Remains
    // (willpower 3 against 3: she passes).
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.cardTest',
        kind: 'skillTestResult',
        about: 'Rotting Remains',
        for: daisy,
        test: { skill: 'willpower', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);
    table.answer(byName('Rotting Remains'), 'pass');
    expect(table.board.namesIn({ kind: 'threatArea', investigatorId: roland })).toEqual([
      'Dissonant Voices',
    ]);

    // Round 10 – investigation: the Ghoul Priest has 5 health per investigator,
    // 15. Roland fights once with his .45 Automatic and Vicious Blow (3
    // damage), then evades the Priest so it cannot attack him at 4 of 5
    // horror. Dissonant Voices keeps him from playing assets and events this round,
    // so his last action is a resource. Daisy hits it three times (combat 2 against
    // 4: she commits her two combat icons and the tokens are kind).
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName('Ghoul Priest'), { damage: 3 });
    table.evade(roland, byName('Ghoul Priest'));
    table.gainResources(roland, 1);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.fight(daisy, byName('Ghoul Priest'));
    table.fight(daisy, byName('Ghoul Priest'));
    table.fight(daisy, byName('Ghoul Priest'));
    table.endTurn(daisy);

    expect(table.board.enemy(byName('Ghoul Priest'))).toEqual({
      name: 'Ghoul Priest',
      at: 'Hallway',
      health: 15,
      damage: 6,
      exhausted: true,
    });

    // Round 10 – enemy phase and upkeep: the exhausted Priest does not attack;
    // readied in 4.3, it engages its prey again, highest combat: Roland.
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'upkeep', step: 'readyExhausted' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.chooseEngagement',
        kind: 'chooseInvestigator',
        about: 'Ghoul Priest',
        options: ['Roland Banks', 'Daisy Walker'],
      },
    ]);
    table.answer(byName('Ghoul Priest'), 'Roland Banks');
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'upkeep' });

    // The round has ended, so Dissonant Voices has left Roland's threat area.
    expect(table.board.enemy(byName('Ghoul Priest'))).toMatchObject({ engagedWith: roland });
    expect(table.board.namesIn({ kind: 'threatArea', investigatorId: roland })).toEqual([]);

    // Round 11 – mythos: 1.2 places the agenda's second doom. Roland draws
    // Rotting Remains (willpower 3 against 3), Daisy Crypt Chill (willpower 3
    // against 4, and a +1 token): both pass.
    expect(table.nextPhase()).toEqual({ round: 11, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.agenda).toMatchObject({
      name: "They're Getting Out!",
      doom: 2,
      threshold: 10,
    });
    table.answer(byName('Rotting Remains'), 'pass');
    expect(table.nextPhase()).toEqual({ round: 11, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Crypt Chill'), 'pass');

    // Round 11 – investigation: Roland shoots the Priest three times, the first
    // two with a Vicious Blow (3, 3 and 2 damage, his .45 Automatic's last
    // ammo): 14 of 15.
    expect(table.nextPhase()).toEqual({ round: 11, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName('Ghoul Priest'), { damage: 3 });
    table.fight(roland, byName('Ghoul Priest'), { damage: 3 });
    table.fight(roland, byName('Ghoul Priest'), { damage: 2 });
    table.endTurn(roland);

    // Daisy misses her first blow. The Priest is ready, so it retaliates: its
    // attack (2 damage, 2 horror) would defeat her at 3 of 5 damage. Roland,
    // in the Hallway with her, plays Dodge (1 resource) and cancels it.
    table.startTurn(daisy);
    table.fight(daisy, byName('Ghoul Priest'), { result: 'fail' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.retaliate',
        kind: 'confirm',
        about: 'Ghoul Priest',
        for: daisy,
        options: ['attack', 'attack cancelled'],
        defaults: { attack: { damage: 2, horror: 2 } },
      },
    ]);
    table.answer(byName('Ghoul Priest'), 'attack cancelled');
    // The open attack blocks every other command, so the cost is noted after it.
    table.spendResources(roland, 1);
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 3, horror: 2 });

    // Her next blow is the Priest's fifteenth damage. It goes to the victory
    // display, which meets act 3's objective: the act advances by itself and
    // asks Roland, the lead, whether to burn the house.
    table.fight(daisy, byName('Ghoul Priest'));

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual([
      'Icy Ghoul',
      'Flesh-Eater',
      'Ghoul Priest',
    ]);
    expect(table.board.decisions).toEqual([
      {
        prompt: 'scenario.theGathering.burnTheHouse.prompt',
        kind: 'chooseOption',
        options: [
          'scenario.theGathering.burnTheHouse.burn',
          'scenario.theGathering.burnTheHouse.spare',
        ],
      },
    ]);
    expect(table.board.act?.name).toBe('What Have You Done?');

    // They burn it down: resolution 1. The game is over; only corrections remain.
    table.play(answer(BURN_THE_HOUSE_DECISION, 'burn'));

    expect(table.state.meta).toMatchObject({ ended: true, resolution: 'R1' });
    expect(() => table.endTurn(daisy)).toThrow(
      expect.objectContaining({ rejection: expect.objectContaining({ code: 'scenarioEnded' }) }),
    );

    // What resolution 1 writes to the campaign log: the house burned down, Roland as the lead earns
    // Lita and suffers 1 mental trauma, and everyone earns the 4 victory points plus 2, Wendy too
    // although she resigned. Nobody was defeated, so there is no other trauma.
    const proposal = campaign.proposeResolution(ctx, table.state, theGatheringResolutions);
    expect(proposal).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: 'houseStillStanding',
          value: { kind: 'flag', value: false },
        },
      },
      { kind: 'byHand', textKey: 'scenario.theGathering.resolution.earnLita' },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: rolandBanks.code, kind: 'mental', amount: 1 },
      },
      { kind: 'command', command: { type: 'AwardXp', code: rolandBanks.code, amount: 6 } },
      { kind: 'command', command: { type: 'AwardXp', code: daisyWalker.code, amount: 6 } },
      { kind: 'command', command: { type: 'AwardXp', code: wendyAdams.code, amount: 6 } },
      { kind: 'byHand', textKey: 'scenario.theGathering.resolution.upgradeDecks' },
    ]);

    // The players confirm it as proposed, and the campaign log moves on to The Midnight Masks.
    const campaignCtx = { cards: ctx.cards };
    const zealotCampaign = campaign.executeCommand(
      campaignCtx,
      campaign.createEmptyLog(),
      campaign.compileStart(nightOfTheZealot, {
        campaignId: campaignId('zealot_campaign'),
        difficulty: 'standard',
        investigators: [rolandBanks.code, daisyWalker.code, wendyAdams.code],
      }),
    ).log;
    const confirmed = campaign.proposedCommands(proposal ?? []);

    const { log } = campaign.applyResolution(campaignCtx, zealotCampaign, table.state, confirmed);

    expect(log.story).toEqual({ houseStillStanding: { kind: 'flag', value: false } });
    expect(log.investigators).toMatchObject([
      { code: rolandBanks.code, mentalTrauma: 1, xpEarned: 6 },
      { code: daisyWalker.code, mentalTrauma: 0, xpEarned: 6 },
      { code: wendyAdams.code, mentalTrauma: 0, xpEarned: 6 },
    ]);
    expect(log.playedScenarios).toEqual([
      { scenarioId: 'the-gathering', outcome: { kind: 'resolution', id: 'R1' } },
    ]);
    expect(campaign.findCurrentScenarioId(log)).toBe('the-midnight-masks');

    // The log now plays The Midnight Masks, so setting up The Gathering from it again is refused.
    expect(() =>
      scenario.compileSetup(ctx, { seed: 24, investigators: zealotSeats, campaign: log }),
    ).toThrow(
      expect.objectContaining({
        rejection: {
          code: 'notNextCampaignScenario',
          scenarioId: 'the-gathering',
          next: 'the-midnight-masks',
        },
      }),
    );

    // The Midnight Masks sets up from the same log: the house burned down, so the investigators
    // start in Rivertown, and Roland starts with 1 horror for his mental trauma.
    const masks = scenario.compileSetup(
      { cards: cardDbWith(ctx.cards, theMidnightMasksCardDefs), scenario: theMidnightMasks },
      { seed: 24, investigators: zealotSeats, campaign: log },
    );
    expect(
      masks.investigators.map(({ id, locationId, sanity }) => ({
        id,
        locationId,
        horror: sanity.horror,
      })),
    ).toEqual([
      { id: roland, locationId: '01125#1', horror: 1 },
      { id: daisy, locationId: '01125#1', horror: 0 },
      { id: wendy, locationId: '01125#1', horror: 0 },
    ]);

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});

describe('The Gathering with one to three investigators, seed 24', () => {
  /** Round 1 with every investigator investigating once, then on to the mythos phase of round 2. */
  function playOneRound(count: number): PlayTable {
    const investigators = zealotSeats.slice(0, count);
    const table = PlayTable.setUp(ctx, { investigators, seed: 24 });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    for (const { id } of investigators) {
      table.startTurn(id);
      table.investigate(id);
      table.endTurn(id);
    }
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });
    // Where round 2's mythos phase stops depends on what the investigators draw.
    expect(table.nextPhase()).toMatchObject({ round: 2, phase: 'mythos' });
    return table;
  }

  it.each([1, 2, 3])(
    'keeps the invariants and replays the same events with %i investigator(s)',
    (count) => {
      const table = playOneRound(count);

      expect(table.board.round).toBe(2);
      expect(replay(table.events)).toEqual(table.state);
      expect(playOneRound(count).events).toEqual(table.events);
    },
  );
});
