/**
 * Smoke and Mirrors, played end to end: Roland Banks and Daisy Walker, seed 1, from the Brethren
 * of Ash campaign log after Spreading Flames to the end of round 3, when both resign. An
 * integration narrative rather than a rules test, like Spreading Flames': it shows setup reading
 * the log (the saved university, its extra doom), Augurs of Flame's group clue spend drawing the
 * suspect beneath Uptown, a suspect interrogated and put beneath the act, Arkham Alive's resign
 * action ending the game without a resolution, and what that writes to the campaign log, with the
 * facts a player would check at the table asserted where they happen.
 *
 * Skill tests are resolved at the table: actions pass unless the script says otherwise. The
 * players count actions off themselves and resolve by hand what the engine leaves to them
 * (`smokeAndMirrorsCardDefs` lists it), the codex entries from the campaign guide among them: the
 * comments name each such step where it comes up, and the script applies only those that change
 * what it asserts.
 */
import { describe, expect, it } from 'vitest';
import {
  byName,
  campaign,
  campaignId,
  cardDbWith,
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
  ARKHAM,
  ASH_STORY,
  brethrenOfAsh,
  smokeAndMirrors,
  smokeAndMirrorsCards,
  smokeAndMirrorsResolutions,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(smokeAndMirrorsCards, zealotInvestigatorCards),
  scenario: smokeAndMirrors,
};
const campaignCtx = { cards: ctx.cards };
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');
/** Roland and Daisy in seat order: Roland is the lead investigator. */
const seats = [
  { id: roland, code: rolandBanks.code },
  { id: daisy, code: daisyWalker.code },
];
const naomi = "Naomi O'Bannion";
const yes = { kind: 'flag', value: true } as const;

/**
 * The log after Spreading Flames ended in Resolution 2: the investigators defeated their masked
 * pursuer and saved Miskatonic University.
 */
function afterSpreadingFlames(): CampaignLog {
  const started = campaign.executeCommand(
    campaignCtx,
    campaign.createEmptyLog(),
    campaign.compileStart(brethrenOfAsh, {
      campaignId: campaignId('ash_campaign'),
      difficulty: 'standard',
      investigators: [rolandBanks.code, daisyWalker.code],
    }),
  ).log;
  const spreadingFlamesRecords: readonly CampaignCommand[] = [
    { type: 'RecordStory', key: ASH_STORY.defeatedTheirMaskedPursuer, value: yes },
    { type: 'RecordStory', key: ASH_STORY.savedMiskatonicUniversity, value: yes },
    { type: 'AdvanceScenario', outcome: { kind: 'resolution', id: resolutionId('R2') } },
  ];
  return spreadingFlamesRecords.reduce<CampaignLog>(
    (log, command) => campaign.executeCommand(campaignCtx, log, command).log,
    started,
  );
}

describe('Smoke and Mirrors end to end: Roland and Daisy, seed 1', () => {
  it("plays from the campaign log to both investigators resigning: Augurs of Flame draws Naomi O'Bannion from beneath Uptown, she is interrogated and put beneath the act, and the log records her as experience and the harbinger as Sgt. Earl Monroe", () => {
    // Setup from the log: the university was saved, so its Quiet Campus is in play, the
    // investigators start there, and Arkham Alive has 1 doom more than the 1 per investigator.
    // Five suspects and the Servant of Flame lie face down beneath six neighbourhoods; the sixth
    // suspect, Sgt. Earl Monroe, is set aside as the harbinger.
    const log = afterSpreadingFlames();
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 1, investigators: seats, campaign: log }),
    );

    expect(table.board.agenda).toMatchObject({ name: 'Arkham Alive', doom: 3 });
    expect(table.board.act?.name).toBe('Augurs of Flame');
    expect(table.board.locationsOn(ARKHAM)).toHaveLength(9);
    expect(table.board.location(byName('Miskatonic University'))).toMatchObject({
      clues: 2,
      investigators: [roland, daisy],
    });
    expect(table.board.namesIn({ kind: 'setAside' })).toContain('Sgt. Earl Monroe');

    // Round 1 – investigation: each takes a clue at the university, walks to Uptown and takes
    // another there: 4 clues between them.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    for (const investigator of [roland, daisy]) {
      table.startTurn(investigator);
      table.investigate(investigator);
      table.moveTo(investigator, byName('Uptown'));
      table.investigate(investigator);
      table.endTurn(investigator);
    }
    expect(table.board.investigator(roland).clues).toBe(2);
    expect(table.board.investigator(daisy).clues).toBe(2);

    // Round 1 ends without enemies. Round 2 – mythos: a Bat Horror engages Roland and a Rogue
    // Gangster engages Daisy; the Gangster's lost resource is the players' to resolve.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    expect(table.board.enemy(byName('Bat Horror')).engagedWith).toBe(roland);
    expect(table.board.enemy(byName('Rogue Gangster')).engagedWith).toBe(daisy);

    // Round 2 – investigation: Roland takes Augurs of Flame's action, the group spending its 4
    // clues; it provokes the Bat Horror's attack of opportunity. He draws the card beneath
    // Uptown: Naomi O'Bannion, who engages him.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(roland);
    table.useCardAction(roland, byName('Augurs of Flame'));
    table.takeAttackOfOpportunity(byName('Bat Horror'));
    table.spendAction(roland);
    expect(table.board.investigator(roland)).toMatchObject({ clues: 0, damage: 1, horror: 1 });
    expect(table.board.investigator(daisy).clues).toBe(0);
    expect(table.board.enemy(byName(naomi)).engagedWith).toBe(roland);

    // Roland parleys with her twice, reading her codex entry each time, by hand. The first time
    // she has the non-Humanoid Bat Horror defeated and takes her first lead; the second lead (one
    // per investigator) interrogates her, and she goes beneath the act.
    table.spendAction(roland);
    table.play({ type: 'DefeatEnemy', enemyId: table.board.enemyId(byName('Bat Horror')) });
    table.spendAction(roland);
    table.play({
      type: 'MoveCard',
      cardId: table.board.enemyId(byName(naomi)),
      to: { kind: 'beneath', hostId: table.state.act.current! },
    });
    table.endTurn(roland);
    expect(table.board.namesIn({ kind: 'beneath', hostId: table.state.act.current! })).toEqual([
      naomi,
    ]);

    // Daisy defeats the Rogue Gangster with three attacks.
    table.startTurn(daisy);
    for (let hit = 0; hit < 3; hit++) table.fight(daisy, byName('Rogue Gangster'));
    table.endTurn(daisy);
    expect(table.board.enemies).toEqual([]);
    expect(table.board.namesIn({ kind: 'encounterDiscard' })).toEqual([
      'Rogue Gangster',
      'Bat Horror',
    ]);

    // Round 2 ends without enemies. Round 3 – mythos: both draw Eager for Death, whose revelation
    // is the players' to resolve.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    expect(table.board.agenda).toMatchObject({ name: 'Arkham Alive', doom: 5 });
    expect(table.board.namesIn({ kind: 'encounterDiscard' }).slice(0, 2)).toEqual([
      'Eager for Death',
      'Eager for Death',
    ]);

    // Round 3 – investigation: with the doom piling up, both resign with Arkham Alive's action.
    // With no investigator left the game ends without a resolution.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    for (const investigator of [roland, daisy]) {
      table.startTurn(investigator);
      table.useCardAction(investigator, byName('Arkham Alive'));
    }
    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBeUndefined();

    // What no resolution writes to the campaign log: 2 cultist tokens for the rest of the
    // campaign and Sgt. Earl Monroe as the harbinger. The draw for the harbinger is the players',
    // who record what they drew; the proposal starts at "failed in their search". Each earns 2
    // experience: 1 for Naomi beneath the act and 1 for the cleared university. Arkham Alive never
    // advanced, so nobody bears a Mark of Elokoss.
    const proposal = campaign.proposeResolution(ctx, table.state, smokeAndMirrorsResolutions);
    const discovered = (value: boolean) => ({
      type: 'RecordStory',
      key: ASH_STORY.discoveredTheCultsWhereabouts,
      value: { kind: 'flag', value },
    });
    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
      { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ASH_STORY.harbingerOfElokoss,
          value: { kind: 'list', entries: ['Sgt. Earl Monroe'] },
        },
      },
      { kind: 'byHand', textKey: 'scenario.smokeAndMirrors.resolution.drawForTheHarbinger' },
      { kind: 'choice', options: [discovered(false), discovered(true)] },
      { kind: 'command', command: { type: 'AwardXp', code: rolandBanks.code, amount: 2 } },
      { kind: 'command', command: { type: 'AwardXp', code: daisyWalker.code, amount: 2 } },
      { kind: 'byHand', textKey: 'scenario.smokeAndMirrors.resolution.upgradeDecks' },
    ]);

    // The players confirm it unchanged, and the log records the scenario played.
    const { log: next } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );
    expect(next.story).toEqual({
      defeatedTheirMaskedPursuer: yes,
      savedMiskatonicUniversity: yes,
      harbingerOfElokoss: { kind: 'list', entries: ['Sgt. Earl Monroe'] },
      discoveredTheCultsWhereabouts: { kind: 'flag', value: false },
    });
    expect(next.investigators).toMatchObject([
      { code: rolandBanks.code, xpEarned: 2 },
      { code: daisyWalker.code, xpEarned: 2 },
    ]);
    expect(next.chaosBag.filter((token) => token === 'cultist')).toEqual(['cultist', 'cultist']);
    expect(next.playedScenarios).toEqual([
      { scenarioId: 'spreading-flames', outcome: { kind: 'resolution', id: 'R2' } },
      { scenarioId: 'smoke-and-mirrors', outcome: { kind: 'noResolution' } },
    ]);

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
