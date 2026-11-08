/**
 * Spreading Flames, played end to end: Roland Banks and Daisy Walker, seed 1, seven rounds to
 * resolution 2. An integration narrative rather than a rules test, like The Gathering's: it shows
 * the scenario's acts working together on a `PlayTable` (act 1's clues spent from anywhere as the
 * round ends, Escape the Dorms removing Your Friend's Room with its Fire!, act 3's clues spent at
 * Orne Library, the Servant of Flame's return and defeat, and Resolution 1's choice between staying
 * and going), with the facts a player would check at the table asserted where they happen.
 *
 * Skill tests are resolved at the table: actions pass unless the script says otherwise. The
 * players count actions off themselves and resolve by hand what the engine leaves to them
 * (`spreadingFlamesCardDefs` lists it): the comments name each such step where it comes up, and the
 * script applies only those that change what it asserts.
 */
import { describe, expect, it } from 'vitest';
import {
  byName,
  campaign,
  cardDbWith,
  investigatorId,
  PlayTable,
  replay,
  type ScenarioContext,
} from '@arkham/engine';
import { answer } from '@arkham/engine/test/utils';
import {
  ASH_STORY,
  CAMPUS,
  COSMIC_EVILS_DECISION,
  SEARCHING_FOR_ARMITAGE_DECISION,
  SPREADING_FLAMES_CODES,
  STAY_OR_GO_DECISION,
  WHERE_THERES_SMOKE_DECISION,
  spreadingFlames,
  spreadingFlamesCards,
  spreadingFlamesResolutions,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(spreadingFlamesCards, zealotInvestigatorCards),
  scenario: spreadingFlames,
};
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');
/** Roland and Daisy in seat order: Roland is the lead investigator. */
const seats = [
  { id: roland, code: rolandBanks.code },
  { id: daisy, code: daisyWalker.code },
];
const servant = 'Servant of Flame';
const cantor = 'Cantor of Flame';

describe('Spreading Flames, played end to end with Roland and Daisy, seed 1', () => {
  it('plays from setup to resolution 2: act 1 spends clues from anywhere, Escape the Dorms removes the burning room, act 3 spends clues at Orne Library, and the Servant’s defeat lets the group stay and fight the fire', () => {
    const table = PlayTable.setUp(ctx, { investigators: seats, seed: 1 });

    // Setup: both investigators start in Your Friend's Room, the campus's only location so far.
    expect(table.board.locationsOn(CAMPUS)).toEqual(["Your Friend's Room"]);
    expect(table.board.location(byName("Your Friend's Room"))).toMatchObject({
      clues: 4,
      investigators: [roland, daisy],
    });
    expect(table.board.act?.name).toBe("Where There's Smoke...");

    // Round 1 – investigation: each investigates twice and finds 2 clues.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    for (const investigator of [roland, daisy]) {
      table.startTurn(investigator);
      table.investigate(investigator);
      table.investigate(investigator);
      table.endTurn(investigator);
    }
    expect(table.board.act?.advance).toEqual({
      kind: 'spendCluesAtRoundEnd',
      held: 4,
      threshold: 4,
    });

    // Round 1 – upkeep: as the round ends the act asks whether to spend the 4 clues, wherever the
    // investigators hold them. They spend them and the act advances: the Dormitories and the
    // Miskatonic Quad come into play, the Servant of Flame spawns in the Dormitories, one Fire!
    // attaches to Your Friend's Room and the other four go to the encounter discard pile.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep', step: 'endRound' });
    table.play(answer(WHERE_THERES_SMOKE_DECISION, 'spend'));

    expect(table.board.act?.name).toBe('Escape the Dorms');
    expect(table.board.locationsOn(CAMPUS)).toEqual([
      "Your Friend's Room",
      'Dormitories',
      'Miskatonic Quad',
    ]);
    expect(table.board.location(byName("Your Friend's Room")).attachments).toEqual(['Fire!']);
    expect(table.board.enemies).toEqual([{ name: servant, at: 'Dormitories', health: 10 }]);
    const firesDiscarded = table.board
      .namesIn({ kind: 'encounterDiscard' })
      .filter((name) => name === 'Fire!');
    expect(firesDiscarded).toEqual(['Fire!', 'Fire!', 'Fire!', 'Fire!']);

    // Round 2 – mythos: Roland draws Noxious Smoke and tests willpower; he passes. Daisy draws
    // Unspeakable Truths into her threat area: from now on she takes 1 horror by hand each time
    // she discovers clues.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    table.answerOnly('skill.willpower');
    table.answerOnly('pass');
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 0, horror: 0 });

    // Round 2 – investigation: Roland runs into the Dormitories, where the Servant engages him; he
    // evades it and goes on to the Quad. Daisy follows him through the Dormitories.
    table.startTurn(roland);
    table.moveTo(roland, byName('Dormitories'));
    expect(table.board.enemy(byName(servant)).engagedWith).toBe(roland);
    table.evade(roland, byName(servant));
    table.moveTo(roland, byName('Miskatonic Quad'));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Dormitories'));
    table.moveTo(daisy, byName('Miskatonic Quad'));

    // Escape the Dorms' objective (each undefeated investigator at the Quad) is met as Daisy
    // arrives. The players check it and advance the act by hand. Its reverse side sets the Servant
    // aside, removes Your Friend's Room from the game, its Fire! going to the discard pile as it
    // leaves play, and puts Orne Library, Science Hall and Warren Observatory into play.
    table.play({ type: 'AdvanceAct' });
    table.endTurn(daisy);

    expect(table.board.act?.name).toBe('Searching for Dr. Armitage');
    expect(table.board.locationsOn(CAMPUS)).toEqual([
      'Dormitories',
      'Miskatonic Quad',
      'Orne Library',
      'Science Hall',
      'Warren Observatory',
    ]);
    expect(table.board.namesIn({ kind: 'outOfGame' })).toContain("Your Friend's Room");
    const allFiresDiscarded = table.board
      .namesIn({ kind: 'encounterDiscard' })
      .filter((name) => name === 'Fire!');
    expect(allFiresDiscarded).toEqual(['Fire!', 'Fire!', 'Fire!', 'Fire!', 'Fire!']);
    expect(table.board.enemies).toEqual([]);
    expect(table.board.namesIn({ kind: 'setAside' })).toContain(servant);

    // Round 2 ends without enemies or attacks.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });

    // Round 3 – mythos: a Cantor of Flame engages Roland. Daisy's Extraplanar Visions tests a
    // difficulty the engine can't count yet, so the players resolve it from the card.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    expect(table.board.enemies).toEqual([
      { name: cantor, at: 'Miskatonic Quad', health: 2, engagedWith: roland },
    ]);

    // Round 3 – investigation: Roland defeats the Cantor with two attacks and heads for Science
    // Hall; Daisy takes both clues in Warren Observatory.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName(cantor));
    table.fight(roland, byName(cantor));
    table.moveTo(roland, byName('Science Hall'));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Warren Observatory'));
    table.investigate(daisy);
    table.takeHorror(daisy, 1);
    table.investigate(daisy);
    table.takeHorror(daisy, 1);
    table.endTurn(daisy);
    expect(table.board.enemies).toEqual([]);
    expect(table.board.investigator(daisy)).toMatchObject({
      at: 'Warren Observatory',
      clues: 2,
      horror: 2,
    });

    // Round 3 ends without enemies or attacks.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });

    // Round 4 – mythos: the third doom makes Past Curfew advance to Lit Up. Its reverse side's
    // willpower tests are the players' to resolve. Daisy draws a Bystander, which engages her.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'checkDoomThreshold' });
    table.answerOnly('yes');
    expect(table.board.agenda).toMatchObject({ name: 'Lit Up', doom: 0 });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });
    expect(table.board.enemies).toEqual([
      { name: 'Bystander', at: 'Warren Observatory', health: 1, engagedWith: daisy },
    ]);

    // Round 4 – investigation: Roland takes Science Hall's 2 clues and returns to the Quad. Daisy
    // defeats the Bystander and walks to Orne Library.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    table.startTurn(roland);
    table.investigate(roland);
    table.investigate(roland);
    table.moveTo(roland, byName('Miskatonic Quad'));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.fight(daisy, byName('Bystander'));
    // The Bystander is Doomed: defeating it places 1 doom on the agenda, by hand.
    table.placeDoom(1);
    table.moveTo(daisy, byName('Miskatonic Quad'));
    table.moveTo(daisy, byName('Orne Library'));
    table.endTurn(daisy);

    // Round 4 ends without enemies or attacks.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'upkeep' });

    // Round 5 – mythos: Roland's Forbidden Secrets is the players' to resolve. Daisy draws Cosmic
    // Evils and places its doom on the agenda.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos', step: 'drawEncounterCard' });
    table.play(answer(COSMIC_EVILS_DECISION, 'doom'));
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'investigation' });
    expect(table.board.agenda).toMatchObject({ name: 'Lit Up', doom: 3 });

    // Round 5 – investigation: both take one of Orne Library's 2 clues, so they hold 6 there.
    // Roland's third action plays his .45 Automatic (4 ammo).
    table.startTurn(roland);
    table.moveTo(roland, byName('Orne Library'));
    table.investigate(roland);
    table.playCard(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.investigate(daisy);
    table.takeHorror(daisy, 1);
    table.endTurn(daisy);
    expect(table.board.act?.advance).toEqual({
      kind: 'spendCluesAtRoundEnd',
      held: 6,
      threshold: 6,
    });

    // Round 5 – upkeep: they spend the 6 clues as the round ends. Searching for Dr. Armitage's
    // reverse side brings the Servant of Flame back to the Quad, healed, and places 6 clues there.
    // Dr. Armitage joining an investigator is the players' to do, and so is Roland's search for two
    // Fire!: as the lead, at Orne Library, he attaches one there and the next to the Quad.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'upkeep', step: 'endRound' });
    table.play(answer(SEARCHING_FOR_ARMITAGE_DECISION, 'spend'));

    expect(table.board.act?.name).toBe('Blaze of Glory');
    expect(table.board.enemies).toEqual([{ name: servant, at: 'Miskatonic Quad', health: 10 }]);
    expect(table.board.location(byName('Miskatonic Quad')).clues).toBe(6);
    expect(table.board.investigator(roland).clues).toBe(0);
    expect(table.board.investigator(daisy).clues).toBe(0);

    // Round 6 – mythos: Daisy draws Cosmic Evils again; this time she takes 1 damage and 1 horror
    // and draws again, a Cantor of Flame that engages her.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos', step: 'drawEncounterCard' });
    table.play(answer(COSMIC_EVILS_DECISION, 'wounds'));
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'investigation' });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 1, horror: 4 });
    expect(table.board.enemy(byName(cantor))).toMatchObject({
      at: 'Orne Library',
      engagedWith: daisy,
    });

    // Round 6 – investigation: Roland goes to the Quad, where the Servant engages him, and hits it
    // twice with his .45 Automatic: the players confirm 2 damage each. Daisy defeats the Cantor and
    // follows him. (Blaze of Glory's group clue spend to damage the Servant is theirs to resolve.)
    // As the phase ends, the Fire! on the Quad deals each of them 1 direct damage, by hand; the
    // Servant is Elite and takes none.
    table.startTurn(roland);
    table.moveTo(roland, byName('Miskatonic Quad'));
    table.fight(roland, byName(servant), { damage: 2 });
    table.fight(roland, byName(servant), { damage: 2 });
    table.endTurn(roland);
    table.startTurn(daisy);
    table.fight(daisy, byName(cantor));
    table.fight(daisy, byName(cantor));
    table.moveTo(daisy, byName('Miskatonic Quad'));
    table.endTurn(daisy);
    expect(table.board.enemies).toEqual([
      { name: servant, at: 'Miskatonic Quad', health: 10, damage: 4, engagedWith: roland },
    ]);
    table.takeDamage(roland, 1);
    table.takeDamage(daisy, 1);

    // Round 6 – enemy phase: the Servant attacks Roland for 2 damage and 2 horror.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 3, horror: 2 });

    expect(table.nextPhase()).toEqual({ round: 6, phase: 'upkeep' });

    // Round 7 – mythos: the fifth doom makes Lit Up advance to Wild Flames; its reverse side's
    // agility tests are the players' to resolve. A Mutated Experiment engages Daisy.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'checkDoomThreshold' });
    table.answerOnly('yes');
    expect(table.board.agenda).toMatchObject({ name: 'Wild Flames', doom: 0 });
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos' });
    expect(table.board.enemy(byName('Mutated Experiment')).engagedWith).toBe(daisy);

    // Round 7 – investigation: Roland spends the last two ammo, then attacks without the .45 and
    // commits Vicious Blow: 2 damage again, the Servant's tenth. Blaze of Glory advances by
    // itself, and Resolution 1 asks the lead investigator to stay and fight the fire or go.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName(servant), { damage: 2 });
    table.fight(roland, byName(servant), { damage: 2 });
    table.fight(roland, byName(servant), { damage: 2 });

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual([servant]);
    expect(table.board.decisions).toEqual([
      {
        kind: 'chooseOption',
        prompt: 'scenario.spreadingFlames.stayOrGo.prompt',
        options: ['scenario.spreadingFlames.stayOrGo.stay', 'scenario.spreadingFlames.stayOrGo.go'],
      },
    ]);

    // They stay: resolution 2. The game is over.
    table.play(answer(STAY_OR_GO_DECISION, 'stay'));
    expect(table.board).toMatchObject({ ended: true, resolution: 'R2' });

    // What resolution 2 writes to the campaign log: the masked pursuer defeated and Dr. Armitage
    // earned by one of the two (Resolution 1), then the university saved. Each earns 7 experience,
    // the Servant's 2 victory points, 1 each for the cleared Science Hall and Orne Library, and 3
    // from Resolution 1, then 1 more and 1 physical trauma from Resolution 2.
    const proposal = campaign.proposeResolution(ctx, table.state, spreadingFlamesResolutions);
    const both = [rolandBanks.code, daisyWalker.code];
    const flag = (key: string, value: boolean) => ({
      kind: 'command',
      command: { type: 'RecordStory', key, value: { kind: 'flag', value } },
    });
    expect(proposal).toEqual([
      flag(ASH_STORY.defeatedTheirMaskedPursuer, true),
      {
        kind: 'choice',
        options: both.map((code) => ({
          type: 'EarnCard',
          code,
          card: SPREADING_FLAMES_CODES.drHenryArmitage,
        })),
      },
      { kind: 'byHand', textKey: 'scenario.spreadingFlames.resolution.earnArmitage' },
      ...both.map((code) => ({ kind: 'command', command: { type: 'AwardXp', code, amount: 7 } })),
      flag(ASH_STORY.savedMiskatonicUniversity, true),
      ...both.map((code) => ({ kind: 'command', command: { type: 'AwardXp', code, amount: 1 } })),
      ...both.map((code) => ({
        kind: 'command',
        command: { type: 'AddTrauma', code, kind: 'physical', amount: 1 },
      })),
      { kind: 'byHand', textKey: 'scenario.spreadingFlames.resolution.upgradeDecks' },
    ]);

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
