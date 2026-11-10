/**
 * Queen of Ash, played end to end: Roland Banks and Daisy Walker, seed 1, from the Brethren of Ash
 * campaign log after Smoke and Mirrors to Resolution 3, when Roland floods the sewers. An
 * integration narrative rather than a rules test, like Smoke and Mirrors': it shows setup reading
 * the log (a clue each, two Cultists at random tunnels), act 1 advancing as Roland enters
 * Underground Cistern, Stop the Rite moving the Cultists toward the cistern, Sluice Control's test
 * defeating each enemy and ending in R3, and what that writes to the campaign log, with the facts
 * a player would check at the table asserted where they happen.
 *
 * Skill tests are resolved at the table: actions pass unless the script says otherwise. The
 * players count actions off themselves and resolve by hand what the engine leaves to them
 * (`queenOfAshCardDefs` lists it): the comments name each such step where it comes up, and the
 * script applies only those that change what it asserts.
 */
import { describe, expect, it } from 'vitest';
import {
  byName,
  campaign,
  campaignId,
  cardDbWith,
  instanceId,
  investigatorId,
  PlayTable,
  replay,
  resolutionId,
  scenario,
  type CampaignCommand,
  type CampaignLog,
  type ScenarioContext,
} from '@arkham/engine';
import {
  ASH_STORY,
  brethrenOfAsh,
  queenOfAsh,
  queenOfAshCards,
  queenOfAshResolutions,
  SEWERS,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(queenOfAshCards, zealotInvestigatorCards),
  scenario: queenOfAsh,
};
const campaignCtx = { cards: ctx.cards };
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');
/** Roland and Daisy in seat order: Roland is the lead investigator. */
const seats = [
  { id: roland, code: rolandBanks.code },
  { id: daisy, code: daisyWalker.code },
];
/** The five Sewer Tunnels share their name; the script tells them apart by their revealed sides. */
const toxicWastePit = instanceId('12187#1');
const floodedCrypt = instanceId('12185#1');
const yes = { kind: 'flag', value: true } as const;

/**
 * The log after Smoke and Mirrors ended in Resolution 1: the investigators discovered the cult's
 * whereabouts, scoured Arkham for answers and stirred up trouble.
 */
function afterSmokeAndMirrors(): CampaignLog {
  const started = campaign.executeCommand(
    campaignCtx,
    campaign.createEmptyLog(),
    campaign.compileStart(brethrenOfAsh, {
      campaignId: campaignId('ash_campaign'),
      difficulty: 'standard',
      investigators: [rolandBanks.code, daisyWalker.code],
    }),
  ).log;
  const records: readonly CampaignCommand[] = [
    { type: 'RecordStory', key: ASH_STORY.savedMiskatonicUniversity, value: yes },
    { type: 'AdvanceScenario', outcome: { kind: 'resolution', id: resolutionId('R2') } },
    { type: 'RecordStory', key: ASH_STORY.discoveredTheCultsWhereabouts, value: yes },
    { type: 'RecordStory', key: ASH_STORY.scouredArkhamForAnswers, value: yes },
    { type: 'RecordStory', key: ASH_STORY.stirredUpTrouble, value: yes },
    { type: 'AdvanceScenario', outcome: { kind: 'resolution', id: resolutionId('R1') } },
  ];
  return records.reduce<CampaignLog>(
    (log, command) => campaign.executeCommand(campaignCtx, log, command).log,
    started,
  );
}

describe('Queen of Ash end to end: Roland and Daisy, seed 1', () => {
  it('plays from the campaign log to Resolution 3: Roland enters Underground Cistern, the Cultists close in on it, and he floods the sewers from Sluice Control', () => {
    // Setup from the log: the cult's whereabouts were discovered, so A Gathering starts without
    // doom; each investigator begins with 1 clue for scouring Arkham; and for stirring up trouble
    // one Cultist per investigator waits at a random tunnel, the Zealot with 1 doom on it. The
    // Servant of Flame lives, so it is set aside with Elokoss and Sluice Control.
    const log = afterSmokeAndMirrors();
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 1, investigators: seats, campaign: log }),
    );

    expect(table.board.agenda).toMatchObject({ name: 'A Gathering', doom: 0 });
    expect(table.board.act?.name).toBe('Search the Sewers');
    expect(table.board.locationsOn(SEWERS)).toHaveLength(7);
    expect(table.board.location(byName('Sewer Culvert')).investigators).toEqual([roland, daisy]);
    expect(table.board.investigator(roland).clues).toBe(1);
    expect(table.board.investigator(daisy).clues).toBe(1);
    expect(table.board.enemy(byName('Zealot'))).toMatchObject({ at: 'Sewer Tunnels', doom: 1 });
    expect(table.board.enemy(byName('Dark Magician')).at).toBe('Sewer Tunnels');
    expect(table.board.namesIn({ kind: 'setAside' })).toEqual(
      expect.arrayContaining(['Servant of Flame', 'Elokoss', 'Sluice Control']),
    );

    // Round 1 – investigation: Roland reveals Toxic Waste Pit, Daisy Flooded Crypt, and each takes
    // both clues there. Ending a turn there costs Roland a card from his hand (at the table) and
    // Daisy 1 horror, applied by hand.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    for (const [investigator, tunnel] of [
      [roland, toxicWastePit],
      [daisy, floodedCrypt],
    ] as const) {
      table.startTurn(investigator);
      table.moveTo(investigator, tunnel);
      table.investigate(investigator);
      table.investigate(investigator);
      table.endTurn(investigator);
    }
    table.takeHorror(daisy, 1);
    expect(table.board.investigator(roland).clues).toBe(3);
    expect(table.board.investigator(daisy).clues).toBe(3);

    // Round 1 – enemy: the Dark Magician hunts; both ways to the investigators are as short, and
    // Roland, the lead, sends it to Sewer Culvert.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy', step: 'huntersMove' });
    table.answer(byName('Dark Magician'), 'Sewer Culvert');
    expect(table.board.enemy(byName('Dark Magician')).at).toBe('Sewer Culvert');

    // Round 2 – mythos: Roland draws Cosmic Evils and picks the doom; Daisy draws Torment, whose
    // discards are hers to resolve.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    table.resolveRevelation(byName('Cosmic Evils'));
    table.answerOnly('scenario.spreadingFlames.cosmicEvils.doom');
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    expect(table.board.agenda).toMatchObject({ name: 'A Gathering', doom: 2 });

    // Round 2 – investigation: entering Underground Cistern costs 3 clues per investigator, spent
    // by the group by hand: all 6. Roland enters and act 1 advances: Elokoss spawns at the
    // cistern, the Fire! he draws attaches to it, and Sluice Control comes into play beside it.
    // Elokoss is Massive, so she is engaged with him; she cannot make attacks of opportunity, so
    // the players skip the ones the engine offers, and Roland takes two of the cistern's clues.
    // Daisy, her clues spent, waits at Flooded Crypt, which costs her 1 horror again.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(roland);
    table.play({ type: 'AdjustInvestigator', investigatorId: roland, stat: 'clues', delta: -3 });
    table.play({ type: 'AdjustInvestigator', investigatorId: daisy, stat: 'clues', delta: -3 });
    table.moveTo(roland, byName('Underground Cistern'));
    expect(table.board.act?.name).toBe('Stop the Rite');
    expect(table.board.location(byName('Underground Cistern'))).toMatchObject({
      attachments: ['Fire!'],
    });
    expect(table.board.enemy(byName('Elokoss')).at).toBe('Underground Cistern');
    expect(table.board.locationsOn(SEWERS)).toHaveLength(8);
    for (let clue = 0; clue < 2; clue++) {
      table.investigate(roland, { result: 'open' });
      table.answer(byName('Elokoss'), 'does not provoke');
      table.resolveTest('pass');
    }
    table.endTurn(roland);
    expect(table.board.investigator(roland).clues).toBe(2);
    table.startTurn(daisy);
    table.endTurn(daisy);
    table.takeHorror(daisy, 1);

    // Round 2 – enemy: the Dark Magician hunts its way to Daisy and attacks her; Elokoss attacks
    // Roland. Round 2 ends with Stop the Rite: each Cultist moves once toward the cistern. The
    // engaged Dark Magician disengages from Daisy and follows, engaging Roland there; the aloof
    // Zealot comes too.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 3, horror: 3 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 1, horror: 3 });
    // Round 3 – mythos: Roland draws Dissonance, his to resolve, and a Hellhound engages Daisy.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    expect(table.board.enemy(byName('Dark Magician'))).toMatchObject({
      at: 'Underground Cistern',
      engagedWith: roland,
    });
    expect(table.board.enemy(byName('Zealot')).at).toBe('Underground Cistern');
    expect(table.board.enemy(byName('Hellhound')).engagedWith).toBe(daisy);

    // Round 3 – investigation: so that the Dark Magician makes no attacks of opportunity as he
    // moves and opens the valve, Roland first evades it, spends the 2 clues entering Sluice Control costs (by hand) and opens the
    // sluice valve: a combat test (5) he passes. Each enemy is defeated, Elokoss and the Dark
    // Magician into the victory display, and the scenario ends in Resolution 3.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    table.startTurn(roland);
    table.evade(roland, byName('Dark Magician'));
    table.play({ type: 'AdjustInvestigator', investigatorId: roland, stat: 'clues', delta: -2 });
    table.moveTo(roland, byName('Sluice Control'));
    table.answer(byName('Elokoss'), 'does not provoke');
    table.useCardAction(roland, byName('Sluice Control'));
    table.answerOnly('skill.combat');
    table.resolveTest('pass');
    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBe('R3');
    expect(table.board.enemies).toEqual([]);
    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual(['Dark Magician', 'Elokoss']);

    // What Resolution 3 writes to the campaign log: the ritual flooded, and each investigator who
    // did not resign – both – killed; the Collector reward is the players' to hand out. The
    // campaign ends, won.
    const proposal = campaign.proposeResolution(ctx, table.state, queenOfAshResolutions);
    expect(proposal).toEqual([
      {
        kind: 'command',
        command: { type: 'RecordStory', key: ASH_STORY.floodedTheSummoningRitual, value: yes },
      },
      { kind: 'command', command: { type: 'MarkKilled', code: rolandBanks.code } },
      { kind: 'command', command: { type: 'MarkKilled', code: daisyWalker.code } },
      { kind: 'byHand', textKey: 'scenario.queenOfAsh.resolution.collector' },
      { kind: 'command', command: { type: 'EndCampaign', result: 'won' } },
    ]);

    // The players confirm it unchanged, and the log records the scenario played.
    const { log: next } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );
    expect(next.story.floodedTheSummoningRitual).toEqual(yes);
    expect(next.investigators).toMatchObject([
      { code: rolandBanks.code, fate: 'killed' },
      { code: daisyWalker.code, fate: 'killed' },
    ]);
    expect(next.playedScenarios.at(-1)).toEqual({
      scenarioId: 'queen-of-ash',
      outcome: { kind: 'resolution', id: 'R3' },
    });
    expect(next.result).toBe('won');

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
