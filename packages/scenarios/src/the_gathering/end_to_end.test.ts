/**
 * The Gathering, played end to end: Roland Banks, Daisy Walker and Wendy
 * Adams, a fixed seed, eleven rounds to resolution 1. An integration narrative rather than a
 * rules test – it shows the engine features working together in a real
 * scenario (setup, the phase assistant, turns and actions, skill tests,
 * clues, undoing a mis-tapped move, the act 1 hook, doom and the agenda, encounter draws and revelation
 * tests, spawn instructions, engagement, hunters, attacks, attacks of opportunity, upkeep, undoing a whole mythos phase,
 * resigning, the reverse sides of agenda 2 and acts 2 and 3, and the end of the scenario) as one
 * session report: game-language steps on a `TestTable`, phase by phase and
 * turn by turn, with the facts a player would check at the table asserted
 * where they happen.
 *
 * Each later engine PR extends this story with its feature (see M1.E in
 * docs/tasks/M1-engine.md). Rules rest in the unit tests; this test keeps
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
import { replay, type EngineContext } from '@arkham/engine';
import { BURN_THE_HOUSE_DECISION, theGathering, theGatheringCards } from '../index';
import { daisyWalker, rolandBanks, wendyAdams } from '../investigators';
import { TestTable } from './test_table';

const ctx: EngineContext = { cards: theGatheringCards, hooks: theGathering.hooks };
const roland = rolandBanks.id;
const daisy = daisyWalker.id;
const wendy = wendyAdams.id;

const icyGhoul = 'Icy Ghoul';
const swarmOfRats = 'Swarm of Rats';
const ghoulMinion = 'Ghoul Minion';
const ravenousGhoul = 'Ravenous Ghoul';

describe('The Gathering end to end: Roland, Daisy and Wendy, seed 24', () => {
  it('plays from setup to resolution 1: act 1 opens the house, enemies spawn, hunt, attack and are defeated, Wendy resigns, the ghouls rise, act 2 brings the Ghoul Priest and its defeat lets the group burn the house', () => {
    // Setup
    const table = TestTable.setUp({
      scenario: theGathering,
      ctx,
      investigators: [
        { ...rolandBanks, seat: 0 },
        { ...daisyWalker, seat: 1 },
        { ...wendyAdams, seat: 2 },
      ],
      seed: 24,
    });

    expect(table.board()).toMatchInlineSnapshot(`
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
    expect(table.namesIn({ kind: 'encounterDeck' }).slice(0, 12)).toEqual([
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

    expect(table.turn()).toBe('Roland Banks');
    expect(table.actionsLeft()).toEqual({ roland: 1, daisy: 3, wendy: 3 });

    table.endTurn(roland);

    // Round 1 – investigation: Daisy's turn. She commits Deduction to her
    // investigation (intellect 5), which discovers 1 additional clue on a success.
    table.startTurn(daisy);
    table.investigate(daisy, { clues: 2 });
    table.endTurn(daisy);

    expect(table.investigatorClues()).toEqual({ roland: 2, daisy: 2, wendy: 0 });

    // Round 1 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.investigate(wendy);
    table.investigate(wendy);
    // Still in her turn, the Study's 6 clues pay act 1 (2 per investigator) –
    // advancing the act is no action. Its hook opens the house.
    table.spendCluesToAdvanceAct({ roland: 2, daisy: 2, wendy: 2 });

    expect(table.act()).toBe('The Barrier');
    expect(table.locationsOn('house')).toEqual(['Hallway', 'Attic', 'Cellar', 'Parlor']);
    expect(table.investigatorLocations()).toEqual({
      roland: 'Hallway',
      daisy: 'Hallway',
      wendy: 'Hallway',
    });
    expect(table.investigatorClues()).toEqual({ roland: 0, daisy: 0, wendy: 0 });
    expect(table.namesIn({ kind: 'outOfGame' })).toEqual(['Study', 'Trapped']);

    table.endTurn(wendy);

    // Round 1 – enemy phase: no enemy is in play yet
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });

    expect(table.attacksDue()).toEqual([]);

    // Round 1 – upkeep: 4.2 resets Roland's counter, 4.4 each investigator
    // gains a resource, 4.6 the round ends
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });

    expect(table.actionsLeft()).toEqual({ roland: 3, daisy: 3, wendy: 3 });
    expect(table.investigatorResources()).toEqual({ roland: 6, daisy: 6, wendy: 6 });

    // Round 2 – mythos: 1.2 doom, 1.3 below the threshold, 1.4 Roland draws the
    // Icy Ghoul, which spawns in the Cellar, and Daisy draws Crypt Chill: its
    // revelation test stops the phase at Daisy's step 1.4 until the players enter the result.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });

    expect(table.enemies()).toEqual([{ name: icyGhoul, at: 'Cellar' }]);
    expect(table.decisions()).toEqual([
      {
        prompt: 'decision.revelationTest',
        kind: 'skillTestResult',
        about: 'Crypt Chill',
        for: daisy,
        test: { skill: 'willpower', difficulty: 4 },
        options: ['pass', 'fail'],
      },
    ]);
    // Crypt Chill is discarded only once its revelation has resolved.
    expect(table.namesIn({ kind: 'resolving' })).toEqual(['Crypt Chill']);
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual([]);

    // With willpower 3 Daisy fails and, having no asset to discard, takes 2 damage.
    table.answer('Crypt Chill', 'fail');
    table.takeDamage(daisy, 2);

    expect(table.namesIn({ kind: 'resolving' })).toEqual([]);
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual(['Crypt Chill']);

    // 1.4 continues: Wendy draws Ancient Evils, 1 doom on the agenda. The
    // mythos phase has run all its steps; the next "Next" moves on.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    table.placeDoom(1);

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 2 });
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual(['Ancient Evils', 'Crypt Chill']);

    // Round 2 – investigation: Roland's turn (the Attic's shroud is 1)
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(roland);
    // A mis-tapped move to the Parlor is taken back.
    table.moveTo(roland, 'Parlor');

    expect(table.investigatorLocations()).toMatchObject({ roland: 'Parlor' });

    table.undo();

    expect(table.investigatorLocations()).toMatchObject({ roland: 'Hallway' });

    table.moveTo(roland, 'Attic');
    table.investigate(roland);
    table.investigate(roland);
    table.endTurn(roland);

    // Round 2 – investigation: Wendy's turn (the group lets her go before Daisy)
    table.startTurn(wendy);
    table.moveTo(wendy, 'Cellar');
    // Entering a location with a ready enemy engages it, which is no action;
    // `MoveInvestigator` does not do that yet (M1.8 follow-up), so the script engages it.
    table.engage(wendy, icyGhoul);
    table.endTurn(wendy);

    // Round 2 – investigation: Daisy's turn (intellect 5 against the Cellar's shroud 4)
    table.startTurn(daisy);
    table.moveTo(daisy, 'Cellar');
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.investigatorLocations()).toEqual({
      roland: 'Attic',
      daisy: 'Cellar',
      wendy: 'Cellar',
    });
    expect(table.cluesOn('Attic')).toBe(4);
    expect(table.cluesOn('Cellar')).toBe(5);

    // Round 2 – enemy phase: 3.2 no hunter, 3.3 the Icy Ghoul attacks Wendy
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.attacksDue()).toEqual([{ enemy: icyGhoul, investigator: wendy }]);

    table.resolveEnemyAttacks();

    expect(table.wounds(wendy)).toEqual({ damage: 2, horror: 1 });

    // Round 2 – upkeep
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });

    // Round 3 – mythos: 1.2 brings the doom to the threshold, and the agenda
    // question comes at 1.3, the only regular moment the agenda can advance.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'checkDoomThreshold' });

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 3 });
    expect(table.decisions()).toEqual([
      {
        prompt: 'decision.advanceAgenda',
        kind: 'confirm',
        about: "What's Going On?!",
        options: ['yes', 'no'],
      },
    ]);
    expect(table.enemies()).toEqual([{ name: icyGhoul, at: 'Cellar', engagedWith: wendy }]);

    // Nothing else can happen while the question is open.
    expect(() => table.nextPhase()).toThrow(
      expect.objectContaining({ rejection: expect.objectContaining({ code: 'decisionPending' }) }),
    );

    // The players answer yes. The reverse side lets the lead investigator choose,
    // but the agenda has no reverse-side hook yet, so Roland simply takes the 2
    // horror by hand.
    table.answer("What's Going On?!", 'yes');
    table.takeHorror(roland, 2);

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 0 });
    expect(table.decisions()).toEqual([]);

    // 1.4: Roland draws the Swarm of Rats, Daisy a Ghoul Minion, Wendy Ancient Evils.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    table.placeDoom(1);

    expect(table.enemies()).toEqual([
      { name: icyGhoul, at: 'Cellar', engagedWith: wendy },
      { name: swarmOfRats, at: 'Attic', engagedWith: roland },
      { name: ghoulMinion, at: 'Cellar', engagedWith: daisy },
    ]);

    // Round 3 – investigation: Roland's turn (agility 2 plus a good chaos token against the rats' evade 3)
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    table.startTurn(roland);
    table.evade(roland, swarmOfRats);
    table.moveTo(roland, 'Hallway');
    table.moveTo(roland, 'Cellar');
    table.adjustActions(roland, -3);

    // The counter tells the players that a fourth action is beyond Roland's three.
    expect(() => table.adjustActions(roland, -1)).toThrow(
      expect.objectContaining({
        rejection: expect.objectContaining({ code: 'invalidActionAdjustment' }),
      }),
    );
    expect(table.actionsLeft().roland).toBe(0);

    table.endTurn(roland);

    // Round 3 – investigation: Daisy's turn (the minion's fight is 2)
    table.startTurn(daisy);
    table.fight(daisy, ghoulMinion);
    table.fight(daisy, ghoulMinion);
    table.endTurn(daisy);

    expect(table.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Ghoul Minion');

    // Round 3 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.fight(wendy, icyGhoul);
    table.fight(wendy, icyGhoul);
    table.endTurn(wendy);

    // Round 3 – enemy phase: the evaded rats are exhausted and stay; the Icy Ghoul attacks again
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();

    expect(table.wounds(wendy)).toEqual({ damage: 4, horror: 2 });

    // Round 3 – upkeep: 4.3 readies the rats; nobody is in the Attic, so they stay unengaged.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });

    expect(table.enemies()).toEqual([
      { name: icyGhoul, at: 'Cellar', engagedWith: wendy, damage: 2 },
      { name: swarmOfRats, at: 'Attic' },
    ]);

    // Round 4 – mythos: Roland draws Grasping Hands, an agility (3) test
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'drawEncounterCard' });

    // With agility 2 he fails by 1 and takes 1 damage.
    table.answer('Grasping Hands', 'fail');
    table.takeDamage(roland, 1);
    // 1.4 continues: Daisy draws a Ghoul Minion, Wendy the Flesh-Eater.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });

    expect(table.enemies()).toEqual([
      { name: 'Flesh-Eater', at: 'Attic' },
      { name: icyGhoul, at: 'Cellar', engagedWith: wendy, damage: 2 },
      { name: swarmOfRats, at: 'Attic' },
      { name: ghoulMinion, at: 'Cellar', engagedWith: daisy },
    ]);

    // Round 4 – investigation: Roland's turn. He takes the Icy Ghoul over and
    // commits Vicious Blow to his attack: the players confirm 2 damage.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    table.startTurn(roland);
    table.engage(roland, icyGhoul);
    table.fight(roland, icyGhoul, { damage: 2 });

    expect(table.namesIn({ kind: 'victoryDisplay' })).toEqual(['Icy Ghoul']);

    // His third action is the resource action.
    table.gainResources(roland, 1);
    table.endTurn(roland);

    // Round 4 – investigation: Daisy's turn. Her ability grants an additional
    // action for Tome abilities: she reads her Old Book of Lore with it, then
    // fights twice. The players count those three actions off her four.
    table.startTurn(daisy);
    table.adjustActions(daisy, 1);
    table.fight(daisy, ghoulMinion);
    table.fight(daisy, ghoulMinion);
    table.adjustActions(daisy, -3);

    expect(table.actionsLeft().daisy).toBe(1);

    table.endTurn(daisy);

    // Round 4 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.investigate(wendy);
    table.investigate(wendy);
    table.endTurn(wendy);

    expect(table.cluesOn('Cellar')).toBe(3);

    // Round 4 – enemy phase: with everyone in the Cellar the rats hunt them; nobody is attacked.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'enemy' });

    expect(table.attacksDue()).toEqual([]);
    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 2 });
    expect(table.enemies()).toEqual([
      { name: 'Flesh-Eater', at: 'Attic' },
      { name: swarmOfRats, at: 'Hallway' },
    ]);

    // Round 4 – upkeep
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'upkeep' });

    // Round 5 – mythos: Roland draws Rotting Remains, a willpower (3) test
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos', step: 'drawEncounterCard' });

    // With willpower 3 he passes and takes no horror.
    table.answer('Rotting Remains', 'pass');
    // 1.4 continues: Daisy draws the Ravenous Ghoul, Wendy Frozen in Fear.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos' });

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 3 });
    expect(table.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([
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

    // Round 5 – investigation: Wendy's turn
    table.startTurn(wendy);
    table.investigate(wendy);
    table.endTurn(wendy);

    // Round 5 – enemy phase: 3.2 the rats reach the Cellar, where three investigators
    // are and none is their prey, so the engine asks whom they engage.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'huntersMove' });

    expect(table.decisions()).toEqual([
      {
        prompt: 'decision.chooseEngagement',
        kind: 'chooseInvestigator',
        about: swarmOfRats,
        options: ['Roland Banks', 'Daisy Walker', 'Wendy Adams'],
      },
    ]);
    expect(table.enemies()).toEqual([
      { name: 'Flesh-Eater', at: 'Attic' },
      { name: swarmOfRats, at: 'Cellar' },
      { name: ravenousGhoul, at: 'Cellar', engagedWith: daisy },
    ]);

    // The players choose Roland; 3.3 then lists both attacks in player order.
    table.answer(swarmOfRats, 'Roland Banks');
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.attacksDue()).toEqual([
      { enemy: swarmOfRats, investigator: roland },
      { enemy: ravenousGhoul, investigator: daisy },
    ]);

    table.resolveEnemyAttacks();

    expect(table.wounds(roland)).toEqual({ damage: 2, horror: 2 });
    expect(table.wounds(daisy)).toEqual({ damage: 3, horror: 1 });

    // Round 5 – upkeep
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'upkeep' });

    expect(table.investigatorResources()).toEqual({ roland: 11, daisy: 10, wendy: 10 });

    // Round 6 – mythos: Roland draws Rotting Remains again and passes with willpower 3;
    // the Swarms of Rats Daisy and Wendy draw spawn engaged with them.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer('Rotting Remains', 'pass');
    // Answering only resolves the revelation; the paused phase goes on with the
    // next "Next", which runs Daisy's and Wendy's draws. That finishes the
    // mythos steps but stays in the phase, so the players see what was drawn
    // before the investigation phase begins.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos' });

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 4 });
    expect(table.enemies()).toEqual([
      { name: 'Flesh-Eater', at: 'Attic' },
      { name: swarmOfRats, at: 'Cellar', engagedWith: daisy },
      { name: swarmOfRats, at: 'Cellar', engagedWith: roland },
      { name: swarmOfRats, at: 'Cellar', engagedWith: wendy },
      { name: ravenousGhoul, at: 'Cellar', engagedWith: daisy },
    ]);

    // Round 6 – investigation: each investigator defeats the rats engaged with them
    // (1 health); Roland then takes the Cellar's last 2 clues. By name alone the
    // table cannot tell the three Swarms of Rats apart, so each fight names the
    // swarm by the investigator it is engaged with.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'investigation' });
    table.startTurn(roland);

    expect(() => table.fight(roland, swarmOfRats)).toThrow(/3 enemies match/);

    table.fight(roland, { name: swarmOfRats, engagedWith: roland });
    table.investigate(roland);
    table.investigate(roland);
    table.endTurn(roland);
    // Daisy then fights the Ravenous Ghoul: the Cellar has no clues left, and
    // fighting is the one useful action that provokes no attack of opportunity.
    // With combat 2 against its fight 3 she misses twice.
    table.startTurn(daisy);
    table.fight(daisy, { name: swarmOfRats, engagedWith: daisy });
    table.failFight(daisy, ravenousGhoul);
    table.failFight(daisy, ravenousGhoul);
    table.endTurn(daisy);
    table.startTurn(wendy);
    table.fight(wendy, { name: swarmOfRats, engagedWith: wendy });
    table.endTurn(wendy);

    // Round 6 – enemy phase and upkeep: only the Ravenous Ghoul is left to attack
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.attacksDue()).toEqual([{ enemy: ravenousGhoul, investigator: daisy }]);

    table.resolveEnemyAttacks();
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'upkeep' });

    // Round 7 – mythos: one command, one undo group. Raising the doom, drawing
    // Grasping Hands and its revelation test are one chain, so taking the
    // command back removes all of it, and running it again gives the same events.
    const eventsBefore = table.events.length;
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });
    const drawn = table.events.slice(eventsBefore);

    expect(table.decisions()).toEqual([
      {
        prompt: 'decision.revelationTest',
        kind: 'skillTestResult',
        about: 'Grasping Hands',
        for: roland,
        test: { skill: 'agility', difficulty: 3 },
        options: ['pass', 'fail'],
      },
    ]);

    table.undo();

    expect(table.phase()).toEqual({ round: 6, phase: 'upkeep' });
    expect(table.decisions()).toEqual([]);

    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });

    expect(table.events.slice(eventsBefore)).toEqual(drawn);
    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 5 });

    // Roland passes (agility 2 and a +1 token), so the Grasping Hands do nothing.
    table.answer('Grasping Hands', 'pass');
    // 1.4 continues: Daisy's Grasping Hands (agility 3, she passes), then Wendy
    // draws Dissonant Voices, which stays in play in her threat area.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer('Grasping Hands', 'pass');
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos' });

    expect(table.namesIn({ kind: 'threatArea', investigatorId: wendy })).toContain(
      'Dissonant Voices',
    );

    // Round 7 – investigation: Roland goes for the Attic's clues. Entering
    // engages the Flesh-Eater (no action); he searches and takes the 9th clue the group needs.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'investigation' });
    table.startTurn(roland);
    table.moveTo(roland, 'Hallway');
    table.moveTo(roland, 'Attic');
    table.engage(roland, 'Flesh-Eater');
    table.startInvestigating(roland);

    // Searching while engaged with the ready Flesh-Eater provokes its attack of
    // opportunity on Roland (1 damage, 2 horror). It comes before the search
    // itself, so there is no investigate test yet.
    expect(table.decisions()).toEqual([
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
    table.takeAttackOfOpportunity('Flesh-Eater', { horror: 0 });

    expect(table.decisions()).toEqual([
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

    table.passInvestigateTest(roland);

    // The attack does not exhaust the Flesh-Eater, so it attacks again in the enemy phase.
    expect(table.wounds(roland)).toEqual({ damage: 3, horror: 2 });
    expect(table.enemy('Flesh-Eater')).toEqual({
      name: 'Flesh-Eater',
      at: 'Attic',
      engagedWith: roland,
    });

    table.endTurn(roland);
    // Daisy, at 4 of 5 health, evades the Ravenous Ghoul rather than risk its
    // next attack, then takes the resource action.
    table.startTurn(daisy);
    table.evade(daisy, ravenousGhoul);

    expect(table.enemy(ravenousGhoul)).toEqual({
      name: ravenousGhoul,
      at: 'Cellar',
      exhausted: true,
    });

    table.gainResources(daisy, 1);
    table.endTurn(daisy);
    table.startTurn(wendy);
    table.endTurn(wendy);

    // The Barrier needs 3 clues per investigator, 9 for three: the group holds them now.
    // Act 2 has no reverse-side hook yet (the Ghoul Priest and Lita Chantler), so the script
    // stops before advancing it (follow-up in M1.12).
    expect(table.investigatorClues()).toEqual({ roland: 5, daisy: 1, wendy: 3 });
    expect(table.act()).toBe('The Barrier');

    // Round 7 – enemy phase: the exhausted Ravenous Ghoul does not attack, the Flesh-Eater does
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'enemy', step: 'enemiesAttack' });

    expect(table.attacksDue()).toEqual([{ enemy: 'Flesh-Eater', investigator: roland }]);

    table.resolveEnemyAttacks();
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'upkeep' });

    expect(table.board()).toMatchInlineSnapshot(`
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
        Roland Banks – Attic; damage 4/9, horror 4/5, 5 clues, 13 resources, actions left 3; threat area: none
        Daisy Walker – Cellar; damage 4/5, horror 2/9, 1 clues, 13 resources, actions left 3; threat area: none
        Wendy Adams – Cellar; damage 4/7, horror 2/7, 3 clues, 12 resources, actions left 3; threat area: Frozen in Fear, Dissonant Voices
      Encounter deck: 8 cards; discard: 13 cards, top: Grasping Hands
      Set aside: 2 cards
      Victory display: Icy Ghoul
      Pending decisions: none"
    `);

    // Round 8 – mythos: Roland draws Dissonant Voices and Daisy a Ghoul Minion;
    // Wendy passes her willpower test against Crypt Chill.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer('Crypt Chill', 'pass');

    // Round 8 – investigation: Wendy, with Frozen in Fear and Dissonant Voices on
    // her, resigns. Her 3 clues go to the Cellar and both treacheries are discarded.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'investigation' });
    table.startTurn(wendy);
    table.resign(wendy);

    expect(table.turn()).toBe('none');
    expect(table.investigatorClues()).toEqual({ roland: 5, daisy: 1, wendy: 0 });
    expect(table.cluesOn('Cellar')).toBe(3);
    expect(table.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([]);
    expect(table.namesIn({ kind: 'encounterDiscard' }).slice(0, 2)).toEqual([
      'Dissonant Voices',
      'Frozen in Fear',
    ]);

    // The phase ends without waiting for Wendy. Roland empties his .38 Special
    // into the Flesh-Eater (2 damage a shot) and searches the Attic again.
    table.startTurn(roland);
    table.fight(roland, 'Flesh-Eater', { damage: 2 });
    table.fight(roland, 'Flesh-Eater', { damage: 2 });
    table.investigate(roland);
    table.endTurn(roland);
    // Daisy, one damage from defeat, slips away from both ghouls and searches the Cellar.
    table.startTurn(daisy);
    table.evade(daisy, ravenousGhoul);
    table.evade(daisy, ghoulMinion);
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.namesIn({ kind: 'victoryDisplay' })).toEqual(['Icy Ghoul', 'Flesh-Eater']);
    expect(table.investigatorClues()).toEqual({ roland: 6, daisy: 2, wendy: 0 });

    // Round 8 – enemy phase and upkeep: both ghouls are exhausted, nobody is
    // attacked; readied in upkeep, they engage Daisy again in the Cellar.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'upkeep' });

    // Round 9 – mythos: the 7th doom advances Rise of the Ghouls. Its reverse
    // side shuffles the discard back into the deck and turns cards over until
    // a Ghoul enemy comes up: the top card is a Ghoul Minion, which Roland, the
    // lead investigator, draws.
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'mythos', step: 'checkDoomThreshold' });
    table.answer('Rise of the Ghouls', 'yes');

    expect(table.agenda()).toEqual({ name: "They're Getting Out!", doom: 0 });
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual([]);
    expect(table.enemy({ name: ghoulMinion, engagedWith: roland })).toEqual({
      name: ghoulMinion,
      at: 'Attic',
      engagedWith: roland,
    });

    // 1.4: Rotting Remains for both; willpower 3 against 3, both pass.
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer('Rotting Remains', 'pass');
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer('Rotting Remains', 'pass');

    // Round 9 – investigation: The Barrier asks for the investigators in the
    // Hallway at the end of the round. Roland shoots the new Ghoul Minion,
    // takes another Attic clue and walks to the Hallway; Daisy evades both
    // ghouls again and follows him.
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, { name: ghoulMinion, engagedWith: roland }, { damage: 2 });
    table.investigate(roland);
    table.moveTo(roland, 'Hallway');
    table.endTurn(roland);
    table.startTurn(daisy);
    table.evade(daisy, ghoulMinion);
    table.evade(daisy, ravenousGhoul);
    table.moveTo(daisy, 'Hallway');
    table.endTurn(daisy);
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'upkeep' });

    // The round has ended with both in the Hallway holding 9 clues, the 3 per
    // investigator act 2 asks for (Wendy still counts). Its reverse side
    // reveals the Parlor, puts Lita Chantler there and spawns the Ghoul Priest
    // in the Hallway; its prey (highest combat) is Roland.
    expect(table.investigatorLocations()).toEqual({
      roland: 'Hallway',
      daisy: 'Hallway',
      wendy: 'Cellar',
    });
    table.spendCluesToAdvanceAct({ roland: 7, daisy: 2 });
    table.answer('Ghoul Priest', 'Roland Banks');

    expect(table.act()).toBe('What Have You Done?');
    expect(table.cardsAt('Parlor')).toEqual(['Lita Chantler']);
    expect(table.enemy('Ghoul Priest')).toEqual({
      name: 'Ghoul Priest',
      at: 'Hallway',
      engagedWith: roland,
    });

    // Round 10 – mythos: Roland draws Frozen in Fear, Daisy Grasping Hands
    // (agility 2 and a +1 token against 3: she passes).
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer('Grasping Hands', 'pass');

    // Round 10 – investigation: the Ghoul Priest has 5 health per investigator,
    // 15. Frozen in Fear makes Roland's first fight cost an extra action, so he
    // fights twice with his .45 Automatic and Vicious Blow (3 damage each);
    // Daisy fights three times with her bare hands.
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'investigation' });
    table.startTurn(roland);
    table.adjustActions(roland, -1);
    table.fight(roland, 'Ghoul Priest', { damage: 3 });
    table.fight(roland, 'Ghoul Priest', { damage: 3 });
    table.endTurn(roland);
    table.startTurn(daisy);
    table.fight(daisy, 'Ghoul Priest');
    table.fight(daisy, 'Ghoul Priest');
    table.fight(daisy, 'Ghoul Priest');
    table.endTurn(daisy);

    expect(table.enemy('Ghoul Priest')).toMatchObject({ damage: 9 });

    // Round 10 – enemy phase: the Priest hits Roland for 2 damage and 2
    // horror; his Guard Dog soaks the horror.
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks({ horror: 0 });

    expect(table.wounds(roland)).toEqual({ damage: 6, horror: 4 });

    // Round 11 – mythos: Roland draws a Swarm of Rats, Daisy Ancient Evils (1 doom).
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 11, phase: 'mythos' });
    table.placeDoom(1);

    // Round 11 – investigation: Roland's two shots defeat the Ghoul Priest. It
    // goes to the victory display, which meets act 3's objective: the act
    // advances by itself and asks Roland, the lead, whether to burn the house.
    expect(table.nextPhase()).toEqual({ round: 11, phase: 'investigation' });
    table.startTurn(roland);
    table.adjustActions(roland, -1);
    table.fight(roland, 'Ghoul Priest', { damage: 3 });
    table.fight(roland, 'Ghoul Priest', { damage: 3 });

    expect(table.namesIn({ kind: 'victoryDisplay' })).toEqual([
      'Icy Ghoul',
      'Flesh-Eater',
      'Ghoul Priest',
    ]);
    expect(table.decisions()).toEqual([
      {
        prompt: 'scenario.theGathering.burnTheHouse.prompt',
        kind: 'chooseOption',
        options: [
          'scenario.theGathering.burnTheHouse.burn',
          'scenario.theGathering.burnTheHouse.spare',
        ],
      },
    ]);

    // They burn it down: resolution 1. The game is over; only corrections remain.
    table.play({ type: 'ResolveDecision', decisionId: BURN_THE_HOUSE_DECISION, optionId: 'burn' });

    expect(table.state.meta).toMatchObject({ ended: true, resolution: 'R1' });
    expect(() => table.endTurn(roland)).toThrow(
      expect.objectContaining({ rejection: expect.objectContaining({ code: 'scenarioEnded' }) }),
    );

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});

describe('The Gathering with one to three investigators, seed 24', () => {
  const seated = [rolandBanks, daisyWalker, wendyAdams];

  /** Round 1 with every investigator investigating once, then on to the mythos phase of round 2. */
  function playOneRound(count: number): TestTable {
    const investigators = seated.slice(0, count).map((inv, seat) => ({ ...inv, seat }));
    const table = TestTable.setUp({ scenario: theGathering, ctx, investigators, seed: 24 });
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

      expect(table.phase().round).toBe(2);
      expect(replay(table.events)).toEqual(table.state);
      expect(playOneRound(count).events).toEqual(table.events);
    },
  );
});
