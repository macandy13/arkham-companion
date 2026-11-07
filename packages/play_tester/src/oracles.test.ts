import { describe, expect, it } from 'vitest';
import {
  advanceBySpendingClues,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { brokenRule } from './oracles';

const alice = investigatorId('alice');
const study = instanceId('study');
const next = { verb: 'nextPhase' } as const;

describe('the round structure', () => {
  /** Alice in the study with 5 resources, under an agenda that 10 doom advance, so no round here advances it. */
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withInvestigator(alice, { locationId: study, resources: 5 })
    .withAgenda(instanceId('agenda'), blankAgenda('agenda', fixed(10)));

  /** A table of `game` at the end of round 1's enemy phase, alice's turn taken. */
  const atRoundOneEnemyPhase = () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();
    return table;
  };

  it('keeps every rule through a whole round of "Next"', () => {
    const table = atRoundOneEnemyPhase();
    for (let i = 0; i < 3; i++) {
      const before = table.board;
      table.nextPhase();

      expect(brokenRule(before, table.board, next)).toBeUndefined();
    }
  });

  it('catches a game that goes back a phase', () => {
    const table = atRoundOneEnemyPhase();
    const enemyPhase = table.board;
    table.nextPhase();

    expect(brokenRule(table.board, enemyPhase, next)).toMatchObject({
      oracle: { id: 'phaseOrder', rules: 'round-structure.md' },
      message: 'the game went back from round 1 upkeep to round 1 enemy',
    });
  });

  it('catches an upkeep that leaves an investigator without their 3 actions', () => {
    const table = atRoundOneEnemyPhase();
    const enemyPhase = table.board;
    table.nextPhase();
    table.spendAction(alice);

    expect(brokenRule(enemyPhase, table.board, next)).toMatchObject({
      oracle: { id: 'upkeep' },
      message: 'alice has 2 actions after the upkeep',
    });
  });

  it('catches an upkeep that gives an investigator more than 1 resource', () => {
    const table = atRoundOneEnemyPhase();
    const enemyPhase = table.board;
    table.nextPhase();
    table.gainResources(alice, 1);

    expect(brokenRule(enemyPhase, table.board, next)).toMatchObject({
      oracle: { id: 'upkeep' },
      message: 'alice went from 5 to 7 resources in the upkeep',
    });
  });

  it('catches a mythos phase that places no doom on the agenda', () => {
    const table = atRoundOneEnemyPhase();
    table.nextPhase();
    const upkeep = table.board;
    table.nextPhase();
    table.removeDoom(1);

    expect(brokenRule(upkeep, table.board, next)).toMatchObject({
      oracle: { id: 'mythosDoom' },
      message: 'the mythos phase left 0 doom on agenda, which had 0',
    });
  });
});

describe('advancing the agenda', () => {
  /** Alice in the study, under a first agenda that 1 doom advances, then a second one. */
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withInvestigator(alice, { locationId: study })
    .withAgenda(instanceId('first_agenda'), blankAgenda('first_agenda', fixed(1)))
    .withAgenda(
      instanceId('second_agenda'),
      blankAgenda('second_agenda', fixed(10), { stage: { number: 2 } }),
    );

  /** A table of `game` at the end of round 1, alice's turn taken. */
  const atRoundOneUpkeep = () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();
    table.nextPhase();
    return table;
  };

  it('accepts the mythos phase asking to confirm the advance once the threshold is reached', () => {
    const table = atRoundOneUpkeep();
    const upkeep = table.board;
    table.nextPhase();

    expect(brokenRule(upkeep, table.board, next)).toBeUndefined();
  });

  it('catches a mythos phase that reaches the threshold and leaves the agenda', () => {
    const table = atRoundOneUpkeep();
    const upkeep = table.board;
    table.nextPhase();
    table.answerOnly('no');

    expect(brokenRule(upkeep, table.board, next)).toMatchObject({
      oracle: { id: 'doomThreshold', rules: 'agenda-and-doom.md' },
      message: 'first_agenda did not advance with 1 doom in play against its threshold 1',
    });
  });

  it('catches doom placed by hand that advances the agenda', () => {
    const table = atRoundOneUpkeep();
    table.nextPhase();
    const asked = table.board;
    table.answerOnly('yes');

    expect(brokenRule(asked, table.board, { verb: 'placeDoom' })).toMatchObject({
      oracle: { id: 'agendaOnlyAtCheck' },
      message: 'placing doom by hand advanced first_agenda',
    });
  });
});

describe('advancing the act', () => {
  /** Alice in the study with `clues`, in her turn; the first act takes 2 clues, then the second is current. */
  const table = (clues: number) =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alice, { locationId: study, clues })
        .withAct(
          instanceId('first_act'),
          blankAct('first_act', { actions: [advanceBySpendingClues(fixed(2))] }),
        )
        .withAct(instanceId('second_act'), blankAct('second_act', { stage: { number: 2 } }))
        .withTurnOf(alice),
    );
  const advance = { verb: 'spendCluesToAdvanceAct' } as const;

  it('accepts an advance that takes the 2 clues', () => {
    const played = table(3);
    const before = played.board;
    played.spendCluesToAdvanceAct();

    expect(brokenRule(before, played.board, advance)).toBeUndefined();
  });

  it('accepts an act that stays while a question is open, as when its back side asks one', () => {
    // Before: alice holds 3 clues; after: she holds 1, the act unchanged, a question open.
    const before = table(3).board;
    const asking = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alice, { locationId: study, clues: 1 })
        .withAct(
          instanceId('first_act'),
          blankAct('first_act', { actions: [advanceBySpendingClues(fixed(2))] }),
        )
        .withTurnOf(alice),
    );
    asking.investigate(alice, { result: 'open' });

    expect(brokenRule(before, asking.board, advance)).toBeUndefined();
  });

  it('catches an advance that leaves the act', () => {
    const before = table(3).board;

    expect(brokenRule(before, before, advance)).toMatchObject({
      oracle: { id: 'actAdvance', rules: 'act-and-clues.md' },
      message: 'first_act did not advance',
    });
  });

  it('catches an advance that takes more clues than the act asks', () => {
    const withFourClues = table(4).board;
    const played = table(3);
    played.spendCluesToAdvanceAct();

    expect(brokenRule(withFourClues, played.board, advance)).toMatchObject({
      oracle: { id: 'actAdvance' },
      message: 'advancing first_act took 3 clues, not 2',
    });
  });
});

describe('moving the hunters', () => {
  const bob = investigatorId('bob');
  const ghoul = instanceId('ghoul');
  const hunterGhoul = blankEnemy('ghoul', { keywords: [{ name: 'hunter' }] });
  const attic = instanceId('attic');
  const hallway = instanceId('hallway');
  const cellar = instanceId('cellar');
  const vault = instanceId('vault');

  /**
   * The attic and the cellar each joined to the hallway, which is joined to the study; the vault
   * joined to nothing. Alice is in the study, the ghoul hunter at `ghoulAt`.
   */
  const house = (ghoulAt: typeof attic) =>
    newGame()
      .withLocation(attic, blankLocation('attic'), { revealed: true })
      .withLocation(hallway, blankLocation('hallway'), { revealed: true })
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withLocation(vault, blankLocation('vault'), { revealed: true })
      .withConnection(attic, hallway)
      .withConnection(cellar, hallway)
      .withConnection(hallway, study)
      .withInvestigator(alice, { locationId: study })
      .withCard(ghoul, hunterGhoul, { kind: 'atLocation', locationId: ghoulAt });

  /** A table of `game` at the end of round 1's investigation phase, every turn taken. */
  const afterTurns = (game: ReturnType<typeof house>, investigators = [alice]) => {
    const table = PlayTable.start(game);
    table.nextPhase();
    for (const investigator of investigators) {
      table.startTurn(investigator);
      table.endTurn(investigator);
    }
    return table;
  };

  it('accepts a hunter moving one step towards the nearest investigator', () => {
    const table = afterTurns(house(attic));
    const before = table.board;
    table.nextPhase();

    expect(table.board.enemiesAt(hallway)).toMatchObject([{ name: 'ghoul' }]);
    expect(brokenRule(before, table.board, next)).toBeUndefined();
  });

  it('leaves a hunter alone while the players choose which investigator it goes for', () => {
    const table = afterTurns(house(hallway).withInvestigator(bob, { locationId: cellar }), [
      alice,
      bob,
    ]);
    const before = table.board;
    table.nextPhase();

    expect(table.board.decisions).toMatchObject([{ prompt: 'decision.chooseHunterTarget' }]);
    expect(brokenRule(before, table.board, next)).toBeUndefined();
  });

  it('catches a hunter that stays away from the nearest investigator', () => {
    const table = afterTurns(house(attic));
    const before = table.board;
    table.nextPhase();
    table.moveEnemy(ghoul, attic);

    expect(brokenRule(before, table.board, next)).toMatchObject({
      oracle: { id: 'hunterMove', rules: 'hunter.md' },
      message: 'ghoul stayed at attic instead of moving towards the nearest investigator',
    });
  });

  it('catches a hunter that moves away from the nearest investigator', () => {
    const table = afterTurns(house(attic));
    const before = table.board;
    table.nextPhase();
    table.moveEnemy(ghoul, cellar);

    expect(brokenRule(before, table.board, next)).toMatchObject({
      oracle: { id: 'hunterMove' },
      message: 'ghoul went from attic to cellar, not one step towards the nearest investigator',
    });
  });

  it('catches a hunter that moves without a way to an investigator', () => {
    const table = afterTurns(house(vault));
    const before = table.board;
    table.nextPhase();
    table.moveEnemy(ghoul, hallway);

    expect(brokenRule(before, table.board, next)).toMatchObject({
      oracle: { id: 'hunterMove' },
      message: 'ghoul moved from vault to hallway, though it had to stay',
    });
  });
});

describe('a step that takes back the last one', () => {
  it('is not judged, since undo keeps no rule of play', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alice, { locationId: study }),
    );
    const setup = table.board;
    table.nextPhase();

    expect(brokenRule(table.board, setup, { verb: 'undo' })).toBeUndefined();
  });
});
