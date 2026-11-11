/**
 * Smoke and Mirrors, played end to end: Roland Banks and Daisy Walker, seed 1, from the Brethren
 * of Ash campaign log that Spreading Flames' end-to-end game wrote (`playSpreadingFlames`) to the
 * end of round 3, when both resign, as `playSmokeAndMirrors`. Its own test plays it after
 * Spreading Flames, and the full Brethren of Ash run plays it second. An
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
import { expect } from 'vitest';
import {
  byName,
  campaign,
  cardDbWith,
  investigatorId,
  PlayTable,
  replay,
  scenario,
  type CampaignLog,
  type ScenarioContext,
} from '@arkham/engine';
import {
  ARKHAM,
  ASH_STORY,
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

/**
 * Plays Smoke and Mirrors from the campaign log `start`, which must hold Spreading Flames' saved
 * university, to both investigators resigning in round 3, and returns the log with the ending
 * written: the players confirm what the app proposes, so they failed in their search for the cult.
 */
export function playSmokeAndMirrors(start: CampaignLog): CampaignLog {
  // Setup from the log: the university was saved, so its Quiet Campus is in play, the
  // investigators start there, and Arkham Alive has 1 doom more than the 1 per investigator.
  // Five suspects and the Servant of Flame lie face down beneath six neighbourhoods; the sixth
  // suspect, Sgt. Earl Monroe, is set aside as the harbinger. Each investigator starts with 1
  // damage for the physical trauma Spreading Flames gave them.
  const table = PlayTable.from(
    ctx,
    scenario.compileSetup(ctx, { seed: 1, investigators: seats, campaign: start }),
  );

  expect(table.board.agenda).toMatchObject({ name: 'Arkham Alive', doom: 3 });
  expect(table.board.act?.name).toBe('Augurs of Flame');
  expect(table.board.locationsOn(ARKHAM)).toHaveLength(9);
  expect(table.board.location(byName('Miskatonic University'))).toMatchObject({
    clues: 2,
    investigators: [roland, daisy],
  });
  expect(table.board.namesIn({ kind: 'setAside' })).toContain('Sgt. Earl Monroe');
  expect(table.board.investigator(roland).damage).toBe(1);
  expect(table.board.investigator(daisy).damage).toBe(1);

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
  // clues; it provokes the Bat Horror's attack of opportunity. The Bat Horror is Elusive: after its
  // attack it disengages, moves to the empty university and exhausts, by hand (the script moves
  // it; the exhaustion changes nothing here). Roland draws the card
  // beneath Uptown: Naomi O'Bannion, who engages him.
  expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
  table.startTurn(roland);
  table.useCardAction(roland, byName('Augurs of Flame'));
  table.takeAttackOfOpportunity(byName('Bat Horror'));
  table.moveEnemy(byName('Bat Horror'), byName('Miskatonic University'), { forced: true });
  expect(table.board.investigator(roland)).toMatchObject({ clues: 0, damage: 2, horror: 1 });
  expect(table.board.investigator(daisy).clues).toBe(0);
  expect(table.board.enemy(byName(naomi)).engagedWith).toBe(roland);
  expect(table.board.enemy(byName('Bat Horror')).at).toBe('Miskatonic University');

  // Roland parleys with her twice, by hand: each Parley costs 1 resource per investigator and
  // reads her codex entry. The first time she has the non-Humanoid Bat Horror defeated at the
  // university and takes her first lead; the second lead (one per investigator) interrogates
  // her, and she goes beneath the act.
  table.spendResources(roland, 2);
  table.play({ type: 'DefeatEnemy', enemyId: table.board.enemyId(byName('Bat Horror')) });
  table.spendResources(roland, 2);
  table.play({
    type: 'MoveCard',
    cardId: table.board.enemyId(byName(naomi)),
    to: { kind: 'beneath', hostId: table.board.act!.id },
  });
  table.endTurn(roland);
  expect(table.board.act?.beneath).toEqual([naomi]);
  expect(table.board.investigator(roland).resources).toBe(2);

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

  // The whole event log, setup included, replays to the live state.
  expect(replay(table.events)).toEqual(table.state);

  // The players confirm it unchanged.
  return campaign.applyResolution(
    campaignCtx,
    start,
    table.state,
    campaign.proposedCommands(proposal ?? []),
  ).log;
}
