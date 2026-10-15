/**
 * The Gathering, played end to end: three investigators, a fixed seed, five
 * rounds. An integration narrative rather than a rules test – it shows the
 * engine features working together in a real scenario (setup, movement,
 * clues, the act 1 hook, doom and the agenda, encounter draws, spawn
 * instructions, engagement, hunters, attacks, defeat and upkeep), each round
 * a script of game-language steps (`TestTable`) followed by a few facts a
 * player would check at the table.
 *
 * Each later engine PR extends this story with its feature (see M1.E in
 * docs/tasks/M1-engine.md): decisions are answered instead of stepped
 * around, the phase commands are replaced by the phase assistant, a step is
 * undone. Rules rest in the unit tests; this test keeps them honest together.
 *
 * Every `it` replays the rounds before it from setup, so the tests stay
 * independent; the seed fixes the encounter deck (asserted in the setup test).
 */
import { describe, expect, it } from 'vitest';
import { investigatorId, replay, type EngineContext } from '@arkham/engine';
import { investigators } from '@arkham/engine/test/utils';
import { theGathering, theGatheringCards } from '../index';
import { TestTable } from './test_table';

const ctx: EngineContext = { cards: theGatheringCards, hooks: theGathering.hooks };
const tank = investigatorId('tank');
const seeker = investigatorId('seeker');
const rogue = investigatorId('rogue');

describe('The Gathering end to end: tank, seeker and rogue, seed 24', () => {
  /** A round (or part of one) of the session: steps on the table, in play order. */
  type Script = (table: TestTable) => void;

  /** Sets up The Gathering for tank, seeker and rogue (seed 24) and plays `scripts` in order. */
  function playThrough(...scripts: Script[]): TestTable {
    const table = TestTable.setUp({
      scenario: theGathering,
      ctx,
      investigators: investigators(3),
      seed: 24,
    });
    for (const script of scripts) script(table);
    return table;
  }

  /** No mythos phase in round 1. The Study's 6 clues pay act 1 (2 per investigator). */
  const round1: Script = (table) => {
    table.discoverClues(tank, 2);
    table.discoverClues(seeker, 2);
    table.discoverClues(rogue, 2);
    table.spendCluesToAdvanceAct({ tank: 2, seeker: 2, rogue: 2 });
    table.upkeep();
  };

  /**
   * Draws: Icy Ghoul (tank), Crypt Chill (seeker fails: 2 damage), Ancient
   * Evils (rogue: 1 doom). The tank explores the Attic; seeker and rogue go to
   * the Cellar, where the rogue takes on the Icy Ghoul.
   */
  const round2: Script = (table) => {
    table.placeMythosDoom();
    table.drawEncounterCards();
    table.takeDamage(seeker, 2);
    table.placeDoom(1);

    table.moveTo(tank, 'Attic');
    table.discoverClues(tank, 2);
    table.moveTo(seeker, 'Cellar');
    table.moveTo(rogue, 'Cellar');
    // Moving in does not engage yet (M1.8 follow-up), so the rogue engages explicitly.
    table.engage(rogue, 'Icy Ghoul');
    table.discoverClues(seeker, 1);

    table.moveHunters();
    table.resolveEnemyAttacks();
    table.upkeep();
  };

  /** The third doom reaches agenda 1's threshold of 3. */
  const round3Doom: Script = (table) => {
    table.placeMythosDoom();
  };

  /**
   * The players advance the agenda. Its reverse side lets the lead investigator
   * choose; until M1.9 answers that, the tank simply takes the 2 horror. Draws:
   * Swarm of Rats (tank, alone in the Attic), Ghoul Minion (seeker), Ancient
   * Evils (rogue: 1 doom on the new agenda).
   */
  const round3Mythos: Script = (table) => {
    table.advanceAgenda();
    table.takeHorror(tank, 2);
    table.drawEncounterCards();
    table.placeDoom(1);
  };

  /**
   * The tank evades the rats and walks through the Hallway to the Cellar, where
   * it takes the Icy Ghoul off the rogue. The rogue wounds the ghoul, the seeker
   * kills the Ghoul Minion. The exhausted rats stay in the Attic; the Icy Ghoul
   * attacks the tank.
   */
  const round3Turns: Script = (table) => {
    table.evade('Swarm of Rats');
    table.moveTo(tank, 'Hallway');
    table.moveTo(tank, 'Cellar');
    table.engage(tank, 'Icy Ghoul');
    table.fight('Icy Ghoul', 2);
    table.fight('Ghoul Minion', 2);

    table.moveHunters();
    table.resolveEnemyAttacks();
    table.upkeep();
  };

  /**
   * Draws: Grasping Hands (tank fails: 1 damage), Ghoul Minion (seeker),
   * Flesh-Eater (rogue). The tank finishes the Icy Ghoul, the seeker the
   * minion, the rogue investigates. With everyone in the Cellar the rats hunt
   * them through the Hallway.
   */
  const round4: Script = (table) => {
    table.placeMythosDoom();
    table.drawEncounterCards();
    table.takeDamage(tank, 1);

    table.fight('Icy Ghoul', 2);
    table.fight('Ghoul Minion', 2);
    table.discoverClues(rogue, 2);

    table.moveHunters();
    table.resolveEnemyAttacks();
    table.upkeep();
  };

  /**
   * Draws: Rotting Remains (tank passes), Ravenous Ghoul (seeker), Frozen in
   * Fear (rogue). The rats reach the Cellar; three investigators are there and
   * the rats have no prey, so the engine asks whom they engage. Until M1.9
   * answers decisions, the players' choice (the tank) is an `EngageEnemy`.
   */
  const round5: Script = (table) => {
    table.placeMythosDoom();
    table.drawEncounterCards();
    table.discoverClues(rogue, 1);

    table.moveHunters();
  };

  const round5Attacks: Script = (table) => {
    table.engage(tank, 'Swarm of Rats');
    table.resolveEnemyAttacks();
    table.upkeep();
  };

  it('setup: everyone starts in the Study, and the shuffled encounter deck opens with the Icy Ghoul', () => {
    const table = playThrough();

    expect(table.board()).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: What's Going On?! – doom 0/3
      Act: Trapped – needs 6 clues
      Map Study:
        Study [01111#1] – revealed, 6 clues
          investigators: tank, seeker, rogue
          connects to: none
      Investigators:
        tank – Study; damage 0/9, horror 0/5, 0 clues, 5 resources; threat area: none
        seeker – Study; damage 0/6, horror 0/9, 0 clues, 5 resources; threat area: none
        rogue – Study; damage 0/7, horror 0/7, 0 clues, 5 resources; threat area: none
      Encounter deck: 26 cards; discard: 0 cards
      Set aside: 6 cards
      Victory display: none
      Pending decisions: none"
    `);
    expect(table.namesIn({ kind: 'encounterDeck' }).slice(0, 12)).toEqual([
      ...['Icy Ghoul', 'Crypt Chill', 'Ancient Evils'],
      ...['Swarm of Rats', 'Ghoul Minion', 'Ancient Evils'],
      ...['Grasping Hands', 'Ghoul Minion', 'Flesh-Eater'],
      ...['Rotting Remains', 'Ravenous Ghoul', 'Frozen in Fear'],
    ]);
  });

  it('round 1: the Study’s 6 clues advance act 1, which opens the house and moves everyone to the Hallway', () => {
    const table = playThrough(round1);

    // Round and phase stay at 0 / setup until the phase assistant (M1.10) advances them.
    expect(table.board()).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: What's Going On?! – doom 0/3
      Act: The Barrier – needs 9 clues
      Map Study:
        no locations
      Map House:
        Hallway [01112#1] – revealed, 0 clues
          investigators: tank, seeker, rogue
          connects to: Attic, Cellar, Parlor
        Attic [01113#1] – unrevealed
          connects to: Hallway
        Cellar [01114#1] – unrevealed
          connects to: Hallway
        Parlor [01115#1] – unrevealed
          connects to: Hallway
      Investigators:
        tank – Hallway; damage 0/9, horror 0/5, 0 clues, 6 resources; threat area: none
        seeker – Hallway; damage 0/6, horror 0/9, 0 clues, 6 resources; threat area: none
        rogue – Hallway; damage 0/7, horror 0/7, 0 clues, 6 resources; threat area: none
      Encounter deck: 26 cards; discard: 0 cards
      Set aside: 2 cards
      Victory display: none
      Pending decisions: none"
    `);
    expect(table.act()).toBe('The Barrier');
    expect(table.locationsOn('house')).toEqual(['Hallway', 'Attic', 'Cellar', 'Parlor']);
    expect(table.namesIn({ kind: 'outOfGame' })).toEqual(['Study', 'Trapped']);
    expect(table.investigatorLocations()).toEqual({
      tank: 'Hallway',
      seeker: 'Hallway',
      rogue: 'Hallway',
    });
    expect(table.investigatorClues()).toEqual({ tank: 0, seeker: 0, rogue: 0 });
    expect(table.investigatorResources()).toEqual({ tank: 6, seeker: 6, rogue: 6 });
  });

  it('round 2: the Icy Ghoul spawns in the Cellar, Ancient Evils adds a doom, and the ghoul attacks the rogue who engaged it', () => {
    const table = playThrough(round1, round2);

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 2 });
    expect(table.namesIn({ kind: 'encounterDiscard' })).toEqual(['Ancient Evils', 'Crypt Chill']);
    expect(table.investigatorLocations()).toEqual({
      tank: 'Attic',
      seeker: 'Cellar',
      rogue: 'Cellar',
    });
    expect(table.cluesOn('Attic')).toBe(4);
    expect(table.cluesOn('Cellar')).toBe(5);
    expect(table.enemyLines()).toEqual(['Icy Ghoul: Cellar, engaged with rogue']);
    expect(table.wounds(seeker)).toEqual({ damage: 2, horror: 0 });
    expect(table.wounds(rogue)).toEqual({ damage: 2, horror: 1 });
  });

  it('round 3 doom: the third doom reaches the threshold of What’s Going On?! and the engine asks to advance', () => {
    const table = playThrough(round1, round2, round3Doom);

    expect(table.agenda()).toEqual({ name: "What's Going On?!", doom: 3 });
    expect(table.pendingDecisions()).toEqual([
      "advanceAgenda about What's Going On?!: decision.yes, decision.no",
    ]);
  });

  it('round 3 mythos: the third doom advances to Rise of the Ghouls, and a Swarm of Rats engages the tank alone in the Attic', () => {
    const table = playThrough(round1, round2, round3Doom, round3Mythos);

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 1 });
    expect(table.namesIn({ kind: 'outOfGame' })).toContain("What's Going On?!");
    expect(table.pendingDecisions()).toEqual([]);
    expect(table.wounds(tank)).toEqual({ damage: 0, horror: 2 });
    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with rogue',
      'Swarm of Rats: Attic, engaged with tank',
      'Ghoul Minion: Cellar, engaged with seeker',
    ]);
  });

  it('round 3 turns: the tank evades the rats and takes over the Icy Ghoul, the Ghoul Minion is defeated, the exhausted rats stay put', () => {
    const table = playThrough(round1, round2, round3Doom, round3Mythos, round3Turns);

    expect(table.investigatorLocations()).toEqual({
      tank: 'Cellar',
      seeker: 'Cellar',
      rogue: 'Cellar',
    });
    // Upkeep readied both enemies; nobody is in the Attic, so the rats stay unengaged.
    expect(table.enemyLines()).toEqual([
      'Icy Ghoul: Cellar, engaged with tank, 2 damage',
      'Swarm of Rats: Attic, unengaged',
    ]);
    expect(table.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Ghoul Minion');
    expect(table.wounds(tank)).toEqual({ damage: 2, horror: 3 });
  });

  it('round 4: the Flesh-Eater spawns in the Attic, the Icy Ghoul goes to the victory display, and the hunting rats move to the Hallway', () => {
    const table = playThrough(round1, round2, round3Doom, round3Mythos, round3Turns, round4);

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 2 });
    expect(table.namesIn({ kind: 'victoryDisplay' })).toEqual(['Icy Ghoul']);
    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Swarm of Rats: Hallway, unengaged',
    ]);
    expect(table.cluesOn('Cellar')).toBe(3);
    expect(table.wounds(tank)).toEqual({ damage: 3, horror: 3 });
  });

  it('round 5: Frozen in Fear enters the rogue’s threat area, and the rats reach the Cellar and ask whom to engage', () => {
    const table = playThrough(
      round1,
      round2,
      round3Doom,
      round3Mythos,
      round3Turns,
      round4,
      round5,
    );

    expect(table.agenda()).toEqual({ name: 'Rise of the Ghouls', doom: 3 });
    expect(table.namesIn({ kind: 'threatArea', investigatorId: rogue })).toEqual([
      'Frozen in Fear',
    ]);
    expect(table.pendingDecisions()).toEqual([
      'chooseInvestigator about Swarm of Rats: tank, seeker, rogue',
    ]);
    expect(table.enemyLines()).toEqual([
      'Flesh-Eater: Attic, unengaged',
      'Swarm of Rats: Cellar, unengaged',
      'Ravenous Ghoul: Cellar, engaged with seeker',
    ]);
  });

  it('round 5 attacks: the rats engage the tank, and both engaged enemies attack', () => {
    const table = playThrough(
      round1,
      round2,
      round3Doom,
      round3Mythos,
      round3Turns,
      round4,
      round5,
      round5Attacks,
    );

    expect(table.pendingDecisions()).toEqual([]);
    expect(table.wounds(tank)).toEqual({ damage: 4, horror: 3 });
    expect(table.wounds(seeker)).toEqual({ damage: 3, horror: 1 });
    expect(table.investigatorResources()).toEqual({ tank: 10, seeker: 10, rogue: 10 });
  });

  it('replays the whole event log to the live state', () => {
    const table = playThrough(
      round1,
      round2,
      round3Doom,
      round3Mythos,
      round3Turns,
      round4,
      round5,
      round5Attacks,
    );

    expect(replay(table.events)).toEqual(table.state);
  });
});
