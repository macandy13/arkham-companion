/**
 * The Gathering, played end to end: Roland Banks, Daisy Walker and Wendy
 * Adams, a fixed seed, five rounds. An integration narrative rather than a
 * rules test – it shows the engine features working together in a real
 * scenario (setup, the phase assistant, turns and actions, skill tests,
 * clues, undoing a mis-tapped move, the act 1 hook, doom and the agenda, encounter draws and revelation
 * tests, spawn instructions, engagement, hunters, attacks and upkeep) as one
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
 * round end), and stops wherever the players have to answer. Each
 * investigation turn is started and ended explicitly, in the order the group
 * chooses; the players count actions off each investigator's counter
 * themselves, where the script shows it. Skill tests are resolved at the table: the engine asks for the
 * result (`skillTestResult`), and the comments say why it is a pass or fail.
 * What a failed revelation costs is card text, so the script applies it by hand.
 */
import { describe, expect, it } from 'vitest';
import { replay, type EngineContext } from '@arkham/engine';
import { theGathering, theGatheringCards } from '../index';
import { daisyWalker, rolandBanks, wendyAdams } from '../investigators';
import { TestTable } from './test_table';

const ctx: EngineContext = { cards: theGatheringCards, hooks: theGathering.hooks };
const roland = rolandBanks.id;
const daisy = daisyWalker.id;
const wendy = wendyAdams.id;

const icyGhoul = 'Icy Ghoul';
const swarmOfRats = 'Swarm of Rats';
const ghoulMinion = 'Ghoul Minion';

describe('The Gathering end to end: Roland, Daisy and Wendy, seed 24', () => {
  it('plays five rounds from setup: act 1 opens the house, the agenda advances, enemies spawn, hunt, attack and are defeated', () => {
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
    expect(table.nextPhase()).toBe('investigation');

    expect(table.phase().round).toBe(1);

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

    expect(table.board()).toMatchInlineSnapshot(`
      "Round 1, investigation phase
      Turn: Wendy Adams
      Turns taken: Roland Banks, Daisy Walker
      Agenda: What's Going On?! – doom 0/3
      Act: The Barrier – needs 9 clues
      Map Study:
        no locations
      Map House:
        Hallway [01112#1] – revealed, 0 clues
          investigators: Roland Banks, Daisy Walker, Wendy Adams
          connects to: Attic, Cellar, Parlor
        Attic [01113#1] – unrevealed
          connects to: Hallway
        Cellar [01114#1] – unrevealed
          connects to: Hallway
        Parlor [01115#1] – unrevealed
          connects to: Hallway
      Investigators:
        Roland Banks – Hallway; damage 0/9, horror 0/5, 0 clues, 5 resources, actions left 1; threat area: none
        Daisy Walker – Hallway; damage 0/5, horror 0/9, 0 clues, 5 resources, actions left 3; threat area: none
        Wendy Adams – Hallway; damage 0/7, horror 0/7, 0 clues, 5 resources, actions left 3; threat area: none
      Encounter deck: 26 cards; discard: 0 cards
      Set aside: 2 cards
      Victory display: none
      Pending decisions: none"
    `);
    expect(table.act()).toBe('The Barrier');
    expect(table.locationsOn('house')).toEqual(['Hallway', 'Attic', 'Cellar', 'Parlor']);
    expect(table.namesIn({ kind: 'outOfGame' })).toEqual(['Study', 'Trapped']);

    table.endTurn(wendy);

    // Round 1 – enemy phase: no enemy is in play yet
    expect(table.nextPhase()).toBe('enemy');

    expect(table.attacksDue()).toEqual([]);

    // Round 1 – upkeep: 4.2 resets Roland's counter, 4.4 each investigator
    // gains a resource, 4.6 the round ends
    expect(table.nextPhase()).toBe('upkeep');

    expect(table.actionsLeft()).toEqual({ roland: 3, daisy: 3, wendy: 3 });
    expect(table.investigatorResources()).toEqual({ roland: 6, daisy: 6, wendy: 6 });

    // Round 2 – mythos: 1.2 doom, 1.3 below the threshold, 1.4 Roland draws the
    // Icy Ghoul, which spawns in the Cellar, and Daisy draws Crypt Chill: its
    // revelation test stops the phase until the players enter the result.
    expect(table.nextPhase()).toBe('mythos');

    expect(table.phase().round).toBe(2);
    expect(table.enemyLines()).toEqual(['Icy Ghoul: Cellar, unengaged']);
    expect(table.pendingDecisions()).toEqual([
      'Revelation of Crypt Chill: willpower (4) pass / fail [skillTestResult]',
    ]);
    // Crypt Chill is discarded only once its revelation has resolved.
    expect(table.namesIn({ kind: 'resolving' })).toEqual(['Crypt Chill']);
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual([]);

    // With willpower 3 Daisy fails and, having no asset to discard, takes 2 damage.
    table.answer('Crypt Chill', 'fail');
    table.takeDamage(daisy, 2);

    expect(table.namesIn({ kind: 'resolving' })).toEqual([]);
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual(['Crypt Chill']);

    // 1.4 continues: Wendy draws Ancient Evils, 1 doom on the agenda.
    expect(table.nextPhase()).toBe('mythos');
    table.placeDoom(1);

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 2 });
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual(['Ancient Evils', 'Crypt Chill']);

    // Round 2 – investigation: Roland's turn (the Attic's shroud is 1)
    expect(table.nextPhase()).toBe('investigation');
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
    expect(table.nextPhase()).toBe('enemy');

    expect(table.attacksDue()).toEqual(['Icy Ghoul attacks wendy']);

    table.resolveEnemyAttacks();

    expect(table.wounds(wendy)).toEqual({ damage: 2, horror: 1 });

    // Round 2 – upkeep
    expect(table.nextPhase()).toBe('upkeep');

    // Round 3 – mythos: 1.2 brings the doom to the threshold, and the agenda
    // question comes at 1.3, the only regular moment the agenda can advance.
    expect(table.nextPhase()).toBe('mythos');

    expect(table.phase().round).toBe(3);
    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 3 });
    expect(table.pendingDecisions()).toEqual([
      "Advance agenda What's Going On?! yes / no [confirm]",
    ]);
    expect(table.board()).toMatchInlineSnapshot(`
      "Round 3, mythos phase
      Steps left: 1.4 (Roland Banks), 1.4 (Daisy Walker), 1.4 (Wendy Adams)
      Agenda: What's Going On?! – doom 3/3
      Act: The Barrier – needs 9 clues
      Map Study:
        no locations
      Map House:
        Hallway [01112#1] – revealed, 0 clues
          connects to: Attic, Cellar, Parlor
        Attic [01113#1] – revealed, 4 clues
          investigators: Roland Banks
          connects to: Hallway
        Cellar [01114#1] – revealed, 5 clues
          investigators: Daisy Walker, Wendy Adams
          Icy Ghoul [01119#1] – engaged with Wendy Adams
          connects to: Hallway
        Parlor [01115#1] – unrevealed
          connects to: Hallway
      Investigators:
        Roland Banks – Attic; damage 0/9, horror 0/5, 2 clues, 7 resources, actions left 3; threat area: none
        Daisy Walker – Cellar; damage 2/5, horror 0/9, 1 clues, 7 resources, actions left 3; threat area: none
        Wendy Adams – Cellar; damage 2/7, horror 1/7, 0 clues, 7 resources, actions left 3; threat area: none
      Encounter deck: 23 cards; discard: 2 cards, top: Ancient Evils
      Set aside: 2 cards
      Victory display: none
      Pending decisions:
        Advance agenda What's Going On?! yes / no [confirm]"
    `);

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
    expect(table.pendingDecisions()).toEqual([]);

    // 1.4: Roland draws the Swarm of Rats, Daisy a Ghoul Minion, Wendy Ancient Evils.
    expect(table.nextPhase()).toBe('mythos');
    table.placeDoom(1);

    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with wendy',
      'Swarm of Rats: Attic, engaged with roland',
      'Ghoul Minion: Cellar, engaged with daisy',
    ]);

    // Round 3 – investigation: Roland's turn (agility 2 plus a good chaos token against the rats' evade 3)
    expect(table.nextPhase()).toBe('investigation');
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
    expect(table.nextPhase()).toBe('enemy');
    table.resolveEnemyAttacks();

    expect(table.wounds(wendy)).toEqual({ damage: 4, horror: 2 });

    // Round 3 – upkeep: 4.3 readies the rats; nobody is in the Attic, so they stay unengaged.
    expect(table.nextPhase()).toBe('upkeep');

    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with wendy, 2 damage',
      'Swarm of Rats: Attic, unengaged',
    ]);

    // Round 4 – mythos: Roland draws Grasping Hands, an agility (3) test
    expect(table.nextPhase()).toBe('mythos');

    expect(table.phase().round).toBe(4);

    // With agility 2 he fails by 1 and takes 1 damage.
    table.answer('Grasping Hands', 'fail');
    table.takeDamage(roland, 1);
    // 1.4 continues: Daisy draws a Ghoul Minion, Wendy the Flesh-Eater.
    expect(table.nextPhase()).toBe('mythos');

    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Icy Ghoul: Cellar, engaged with wendy, 2 damage',
      'Swarm of Rats: Attic, unengaged',
      'Ghoul Minion: Cellar, engaged with daisy',
    ]);

    // Round 4 – investigation: Roland's turn. He takes the Icy Ghoul over and
    // commits Vicious Blow to his attack: the players confirm 2 damage.
    expect(table.nextPhase()).toBe('investigation');
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
    expect(table.nextPhase()).toBe('enemy');

    expect(table.attacksDue()).toEqual([]);
    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 2 });
    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Swarm of Rats: Hallway, unengaged',
    ]);

    // Round 4 – upkeep
    expect(table.nextPhase()).toBe('upkeep');

    // Round 5 – mythos: Roland draws Rotting Remains, a willpower (3) test
    expect(table.nextPhase()).toBe('mythos');

    // With willpower 3 he passes and takes no horror.
    table.answer('Rotting Remains', 'pass');
    // 1.4 continues: Daisy draws the Ravenous Ghoul, Wendy Frozen in Fear.
    expect(table.nextPhase()).toBe('mythos');

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 3 });
    expect(table.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([
      'Frozen in Fear',
    ]);

    // Round 5 – investigation: Roland's and Daisy's turns pass without actions
    expect(table.nextPhase()).toBe('investigation');
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
    expect(table.nextPhase()).toBe('enemy');

    expect(table.pendingDecisions()).toEqual([
      'Whom does Swarm of Rats engage? Roland Banks / Daisy Walker / Wendy Adams [chooseInvestigator]',
    ]);
    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Swarm of Rats: Cellar, unengaged',
      'Ravenous Ghoul: Cellar, engaged with daisy',
    ]);

    // The players choose Roland; 3.3 then lists both attacks in player order.
    table.answer(swarmOfRats, 'Roland Banks');
    expect(table.nextPhase()).toBe('enemy');

    expect(table.attacksDue()).toEqual([
      'Swarm of Rats attacks roland',
      'Ravenous Ghoul attacks daisy',
    ]);

    table.resolveEnemyAttacks();

    expect(table.wounds(roland)).toEqual({ damage: 2, horror: 2 });
    expect(table.wounds(daisy)).toEqual({ damage: 3, horror: 1 });

    // Round 5 – upkeep
    expect(table.nextPhase()).toBe('upkeep');

    expect(table.investigatorResources()).toEqual({ roland: 11, daisy: 10, wendy: 10 });

    // Round 6 – mythos: Roland passes his willpower test against Rotting Remains again;
    // Daisy and Wendy each draw another Swarm of Rats.
    expect(table.nextPhase()).toBe('mythos');
    table.answer('Rotting Remains', 'pass');
    expect(table.nextPhase()).toBe('mythos');

    // Round 6 – investigation: Wendy, with Frozen in Fear and a Swarm of Rats on her,
    // resigns. Her 3 clues go to the Cellar, the rats stay there unengaged and her
    // treachery is discarded.
    expect(table.nextPhase()).toBe('investigation');
    table.startTurn(wendy);
    table.resign(wendy);

    expect(table.turn()).toBe('none');
    expect(table.investigatorClues()).toEqual({ roland: 2, daisy: 1, wendy: 0 });
    expect(table.cluesOn('Cellar')).toBe(5);
    expect(table.enemyLines()).toContain('Swarm of Rats: Cellar, unengaged');
    expect(table.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([]);
    expect(table.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Frozen in Fear');

    // The phase ends without waiting for Wendy.
    table.startTurn(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.endTurn(daisy);
    expect(table.nextPhase()).toBe('enemy');

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
