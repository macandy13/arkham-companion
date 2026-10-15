/**
 * The Gathering, played end to end: Roland Banks, Daisy Walker and Wendy
 * Adams, a fixed seed, five rounds. An integration narrative rather than a
 * rules test – it shows the engine features working together in a real
 * scenario (setup, movement, clues, the act 1 hook, doom and the agenda,
 * encounter draws, spawn instructions, engagement, hunters, attacks, defeat
 * and upkeep) as one session report: game-language steps on a `TestTable`,
 * phase by phase and turn by turn, with the facts a player would check at
 * the table asserted where they happen.
 *
 * Each later engine PR extends this story with its feature (see M1.E in
 * docs/tasks/M1-engine.md): decisions are answered instead of stepped
 * around, the phase and turn commands replace the comment headers, a step is
 * undone. Rules rest in the unit tests; this test keeps them honest together.
 *
 * Every investigation turn takes at most 3 actions. Skill tests are resolved
 * at the table (the engine gets their hand-off in M1.10), so a test's outcome
 * is stated in a comment and its consequence applied by hand.
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
        Roland Banks – Study; damage 0/9, horror 0/5, 0 clues, 5 resources; threat area: none
        Daisy Walker – Study; damage 0/5, horror 0/9, 0 clues, 5 resources; threat area: none
        Wendy Adams – Study; damage 0/7, horror 0/7, 0 clues, 5 resources; threat area: none
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

    // Round 1 – no mythos phase in the first round

    // Round 1 – investigation: Roland's turn
    table.investigate(roland);
    table.investigate(roland);

    // Round 1 – investigation: Daisy's turn
    table.investigate(daisy);
    table.investigate(daisy);

    // Round 1 – investigation: Wendy's turn
    table.investigate(wendy);
    table.investigate(wendy);

    // The Study's 6 clues pay act 1 (2 per investigator); its hook opens the house.
    table.spendCluesToAdvanceAct({ roland: 2, daisy: 2, wendy: 2 });

    // Round and phase stay at 0 / setup until the phase assistant (M1.10) advances them.
    expect(table.board()).toMatchInlineSnapshot(`
      "Round 0, setup phase
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
        Roland Banks – Hallway; damage 0/9, horror 0/5, 0 clues, 5 resources; threat area: none
        Daisy Walker – Hallway; damage 0/5, horror 0/9, 0 clues, 5 resources; threat area: none
        Wendy Adams – Hallway; damage 0/7, horror 0/7, 0 clues, 5 resources; threat area: none
      Encounter deck: 26 cards; discard: 0 cards
      Set aside: 2 cards
      Victory display: none
      Pending decisions: none"
    `);
    expect(table.act()).toBe('The Barrier');
    expect(table.locationsOn('house')).toEqual(['Hallway', 'Attic', 'Cellar', 'Parlor']);
    expect(table.namesIn({ kind: 'outOfGame' })).toEqual(['Study', 'Trapped']);
    expect(table.investigatorClues()).toEqual({ roland: 0, daisy: 0, wendy: 0 });

    // Round 1 – upkeep
    table.upkeep();

    expect(table.investigatorResources()).toEqual({ roland: 6, daisy: 6, wendy: 6 });

    // Round 2 – mythos phase
    table.placeMythosDoom();
    table.drawEncounterCard(roland);

    expect(table.enemyLines()).toEqual(['Icy Ghoul: Cellar, unengaged']);

    // Daisy draws Crypt Chill and takes a willpower (4) test: with willpower 3
    // she fails and, having no asset to discard, takes 2 damage.
    table.drawEncounterCard(daisy);
    table.takeDamage(daisy, 2);
    // Wendy draws Ancient Evils: 1 doom on the agenda.
    table.drawEncounterCard(wendy);
    table.placeDoom(1);

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 2 });
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual(['Ancient Evils', 'Crypt Chill']);

    // Round 2 – investigation: Roland's turn
    table.moveTo(roland, 'Attic');
    table.investigate(roland);
    table.investigate(roland);

    // Round 2 – investigation: Wendy's turn (the group lets her go before Daisy)
    table.moveTo(wendy, 'Cellar');
    // Entering a location with a ready enemy engages it; `MoveInvestigator` does
    // not do that yet (M1.8 follow-up), so the script engages explicitly.
    table.engage(wendy, icyGhoul);

    // Round 2 – investigation: Daisy's turn
    table.moveTo(daisy, 'Cellar');
    table.investigate(daisy);

    expect(table.investigatorLocations()).toEqual({
      roland: 'Attic',
      daisy: 'Cellar',
      wendy: 'Cellar',
    });
    expect(table.cluesOn('Attic')).toBe(4);
    expect(table.cluesOn('Cellar')).toBe(5);

    // Round 2 – enemy phase
    table.moveHunters();
    table.resolveEnemyAttacks();

    expect(table.wounds(wendy)).toEqual({ damage: 2, horror: 1 });

    // Round 2 – upkeep
    table.upkeep();

    // Round 3 – mythos phase
    table.placeMythosDoom();

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 3 });
    expect(table.pendingDecisions()).toEqual(["confirm about What's Going On?!: yes, no"]);
    expect(table.board()).toMatchInlineSnapshot(`
      "Round 0, setup phase
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
        Roland Banks – Attic; damage 0/9, horror 0/5, 2 clues, 7 resources; threat area: none
        Daisy Walker – Cellar; damage 2/5, horror 0/9, 1 clues, 7 resources; threat area: none
        Wendy Adams – Cellar; damage 2/7, horror 1/7, 0 clues, 7 resources; threat area: none
      Encounter deck: 23 cards; discard: 2 cards, top: Ancient Evils
      Set aside: 2 cards
      Victory display: none
      Pending decisions:
        advanceAgenda:01105#1 (confirm): yes (What's Going On?!), no"
    `);

    // Nothing else can happen while the question is open.
    expect(() => table.moveTo(roland, 'Hallway')).toThrow(
      expect.objectContaining({ rejection: expect.objectContaining({ code: 'decisionPending' }) }),
    );
    expect(table.investigatorLocations().roland).toBe('Attic');

    // The players answer yes. The reverse side lets the lead investigator choose,
    // but the agenda has no reverse-side hook yet, so Roland simply takes the 2
    // horror by hand.
    table.answer("What's Going On?!", 'yes');
    table.takeHorror(roland, 2);

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 0 });
    expect(table.pendingDecisions()).toEqual([]);
    expect(table.events.map((event) => event.type)).toContain('DecisionResolved');

    table.drawEncounterCard(roland);

    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with wendy',
      'Swarm of Rats: Attic, engaged with roland',
    ]);

    table.drawEncounterCard(daisy);
    // Wendy draws Ancient Evils: 1 doom on the new agenda.
    table.drawEncounterCard(wendy);
    table.placeDoom(1);

    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with wendy',
      'Swarm of Rats: Attic, engaged with roland',
      'Ghoul Minion: Cellar, engaged with daisy',
    ]);

    // Round 3 – investigation: Roland's turn
    table.evade(roland, swarmOfRats);
    table.moveTo(roland, 'Hallway');
    table.moveTo(roland, 'Cellar');

    // Round 3 – investigation: Daisy's turn
    table.fight(daisy, ghoulMinion);
    table.fight(daisy, ghoulMinion);

    expect(table.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Ghoul Minion');

    // Round 3 – investigation: Wendy's turn
    table.fight(wendy, icyGhoul);
    table.fight(wendy, icyGhoul);

    // Round 3 – enemy phase
    table.moveHunters();
    table.resolveEnemyAttacks();

    expect(table.wounds(wendy)).toEqual({ damage: 4, horror: 2 });

    // Round 3 – upkeep
    table.upkeep();

    // Upkeep readied the rats; nobody is in the Attic, so they stay unengaged.
    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with wendy, 2 damage',
      'Swarm of Rats: Attic, unengaged',
    ]);

    // Round 4 – mythos phase
    table.placeMythosDoom();
    // Roland draws Grasping Hands and takes an agility (3) test: with agility 2
    // he fails by 1 and takes 1 damage.
    table.drawEncounterCard(roland);
    table.takeDamage(roland, 1);
    table.drawEncounterCard(daisy);
    table.drawEncounterCard(wendy);

    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Icy Ghoul: Cellar, engaged with wendy, 2 damage',
      'Swarm of Rats: Attic, unengaged',
      'Ghoul Minion: Cellar, engaged with daisy',
    ]);

    // Round 4 – investigation: Roland's turn
    table.engage(roland, icyGhoul);
    table.fight(roland, icyGhoul);
    table.fight(roland, icyGhoul);

    expect(table.namesIn({ kind: 'victoryDisplay' })).toEqual(['Icy Ghoul']);

    // Round 4 – investigation: Daisy's turn
    table.fight(daisy, ghoulMinion);
    table.fight(daisy, ghoulMinion);

    // Round 4 – investigation: Wendy's turn
    table.investigate(wendy);
    table.investigate(wendy);

    expect(table.cluesOn('Cellar')).toBe(3);

    // Round 4 – enemy phase: with everyone in the Cellar the rats hunt them.
    table.moveHunters();
    table.resolveEnemyAttacks();

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 2 });
    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Swarm of Rats: Hallway, unengaged',
    ]);

    // Round 4 – upkeep
    table.upkeep();

    // Round 5 – mythos phase
    table.placeMythosDoom();
    // Roland draws Rotting Remains and takes a willpower (3) test: with
    // willpower 3 he passes and takes no horror.
    table.drawEncounterCard(roland);
    table.drawEncounterCard(daisy);
    table.drawEncounterCard(wendy);

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 3 });
    expect(table.namesIn({ kind: 'threatArea', investigatorId: wendy })).toEqual([
      'Frozen in Fear',
    ]);

    // Round 5 – investigation: Roland's and Daisy's turns pass without actions

    // Round 5 – investigation: Wendy's turn
    table.investigate(wendy);

    // Round 5 – enemy phase: the rats reach the Cellar, where three investigators
    // are and none is their prey, so the engine asks whom they engage.
    table.moveHunters();

    expect(table.pendingDecisions()).toEqual([
      'chooseInvestigator about Swarm of Rats: roland, daisy, wendy',
    ]);
    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Swarm of Rats: Cellar, unengaged',
      'Ravenous Ghoul: Cellar, engaged with daisy',
    ]);

    // The players choose Roland.
    table.answer(swarmOfRats, roland);

    expect(table.pendingDecisions()).toEqual([]);
    expect(table.enemyLines()).toContain('Swarm of Rats: Cellar, engaged with roland');

    table.resolveEnemyAttacks();

    expect(table.wounds(roland)).toEqual({ damage: 2, horror: 2 });
    expect(table.wounds(daisy)).toEqual({ damage: 3, horror: 1 });

    // Round 5 – upkeep
    table.upkeep();

    expect(table.investigatorResources()).toEqual({ roland: 10, daisy: 10, wendy: 10 });

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
