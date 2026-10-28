/**
 * The Devourer Below, played end to end the other way: Roland Banks and Daisy
 * Walker, seed 7, ten rounds from a campaign log that left no Cultist at large
 * to resolution 2, the end of the campaign. Where `end_to_end.test.ts` breaks
 * the ritual with act 3, here the investigators never find the trail and doom
 * runs out. It shows at the table: agenda 1 and 2 advancing on doom, agenda 3
 * advancing while act 1 is still current (the Ritual Site comes into play
 * next to the Main Path and Umôrdhoth spawns there), the one card that is act
 * and agenda at once (the header shows Vengeance Awaits twice, with no doom
 * threshold left), the investigators fighting Umôrdhoth at the Ritual Site and
 * his attacks, and his defeat ending in resolution 2 applied to the campaign
 * log: Umôrdhoth repelled, 2 physical and 2 mental trauma each, 10 experience
 * each, and the campaign won.
 *
 * What the engine leaves to the players is done by hand, as at the table:
 * agenda 1's reverse side (shuffle the discard into the deck, the first
 * Monster spawns at the Main Path with 1 doom), agenda 2's reverse side (each
 * investigator's willpower test; both pass), Ancient Evils' doom, Umôrdhoth's
 * Wrath (each drawer discards 2 cards), Dissonant Voices and Frozen in Fear's
 * extra action. The players count actions themselves.
 */
import { describe, expect, it } from 'vitest';
import {
  byId,
  byName,
  campaign,
  campaignId,
  cardDbWith,
  instanceId,
  investigatorId,
  PlayTable,
  replay,
  scenario,
  type CampaignCommand,
  type CampaignLog,
  type InstanceId,
  type InvestigatorId,
  type ScenarioContext,
} from '@arkham/engine';
import {
  DEVOURER_BELOW_CODES as codes,
  GATHERING_RESOLUTIONS,
  MIDNIGHT_MASKS_RESOLUTIONS,
  ZEALOT_STORY,
  nightOfTheZealot,
  theDevourerBelow,
  theDevourerBelowCardDefs,
  theDevourerBelowResolutions,
  theGatheringCards,
  theMidnightMasksCardDefs,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(
    cardDbWith(cardDbWith(theGatheringCards, theMidnightMasksCardDefs), theDevourerBelowCardDefs),
    zealotInvestigatorCards,
  ),
  scenario: theDevourerBelow,
};
const campaignCtx = { cards: ctx.cards };
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');
/** Roland and Daisy in seat order: Roland leads. */
const seats = [
  { id: roland, code: rolandBanks.code },
  { id: daisy, code: daisyWalker.code },
];
const mainPath = instanceId(`${codes.mainPath}#1`);
const ritualSite = instanceId(`${codes.ritualSite}#1`);
const vengeanceAwaits = instanceId(`${codes.vengeanceAwaits}#1`);
const umordhoth = 'Umôrdhoth';
/** The Agents of Shub-Niggurath's three Goat Spawn share their name, so they go by ID. */
const firstGoat = instanceId('01180#1');
const secondGoat = instanceId('01180#2');
const thirdGoat = instanceId('01180#3');

/**
 * A log in which nothing changes The Devourer Below's setup: The Gathering's
 * R1 (the house burned, the Ghoul Priest defeated) and The Midnight Masks' R1
 * with every Cultist interrogated, so agenda 1 starts without doom and the
 * Ghoul Priest stays out of the encounter deck.
 */
function everyCultistInterrogated(): CampaignLog {
  const started = campaign.executeCommand(
    campaignCtx,
    campaign.createEmptyLog(),
    campaign.compileStart(nightOfTheZealot, {
      campaignId: campaignId('zealot_campaign'),
      difficulty: 'standard',
      investigators: [rolandBanks.code, daisyWalker.code],
    }),
  ).log;
  const records: readonly CampaignCommand[] = [
    {
      type: 'RecordStory',
      key: ZEALOT_STORY.houseStillStanding,
      value: { kind: 'flag', value: false },
    },
    {
      type: 'AdvanceScenario',
      outcome: { kind: 'resolution', id: GATHERING_RESOLUTIONS.burnedDown },
    },
    {
      type: 'RecordStory',
      key: ZEALOT_STORY.cultistsWeInterrogated,
      value: {
        kind: 'list',
        entries: [
          ...['"Wolf-Man" Drew', 'Herman Collins', 'Peter Warren'],
          ...['Victoria Devereux', 'Ruth Turner', 'The Masked Hunter'],
        ],
      },
    },
    {
      type: 'AdvanceScenario',
      outcome: { kind: 'resolution', id: MIDNIGHT_MASKS_RESOLUTIONS.conspiracyUncovered },
    },
  ];
  return records.reduce<CampaignLog>(
    (log, command) => campaign.executeCommand(campaignCtx, log, command).log,
    started,
  );
}

describe('The Devourer Below end to end: Roland and Daisy, seed 7', () => {
  it('plays from the campaign log to resolution 2: doom runs out, Umôrdhoth rises at the Ritual Site, and Roland and Daisy defeat him', () => {
    const log = everyCultistInterrogated();
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 7, investigators: seats, campaign: log }),
    );
    expect(table.board.agenda).toMatchObject({ name: 'The Arkham Woods', doom: 0 });
    expect(table.board.namesIn({ kind: 'setAside' })).toEqual(
      expect.arrayContaining(['Ritual Site', umordhoth]),
    );
    expect(table.board.namesIn({ kind: 'setAside' })).toHaveLength(2);

    const quietTurn = (investigator: InvestigatorId) => {
      table.startTurn(investigator);
      table.endTurn(investigator);
    };
    /** The investigator evades the Goat Spawn engaged with them, so it can't attack this round. */
    const evadeTurn = (investigator: InvestigatorId, ...goats: readonly InstanceId[]) => {
      table.startTurn(investigator);
      for (const goat of goats) table.evade(investigator, byId(goat));
      table.endTurn(investigator);
    };

    // Round 1 – no mythos phase; the investigators look around the Main Path.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    quietTurn(roland);
    quietTurn(daisy);
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });

    // Round 2 – Roland draws the Wizard of the Order, which spawns at an empty
    // Arkham Woods; Daisy draws a Ravenous Ghoul, which Roland defeats.
    expect(table.nextPhase()).toMatchObject({ round: 2, phase: 'mythos' });
    table.answer(byName('Wizard of the Order'), 'Arkham Woods 1');
    expect(table.nextPhase()).toMatchObject({ round: 2, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName('Ravenous Ghoul'), { damage: 2 });
    table.fight(roland, byName('Ravenous Ghoul'), { damage: 2 });
    table.endTurn(roland);
    quietTurn(daisy);
    table.nextPhase();
    table.nextPhase();

    // Round 3 – Roland draws Umôrdhoth's Wrath and discards 2 cards by hand;
    // Daisy draws a Ghoul Minion, which Roland defeats.
    expect(table.nextPhase()).toMatchObject({ round: 3, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName('Ghoul Minion'), { damage: 2 });
    table.endTurn(roland);
    quietTurn(daisy);
    table.nextPhase();
    table.nextPhase();

    // Round 4 – the Wizard's doom fills agenda 1. Its reverse side is done by
    // hand: the discard goes back into the encounter deck, and the first
    // Monster from its top, a Goat Spawn, spawns at the Main Path with 1 doom.
    expect(table.nextPhase()).toMatchObject({ round: 4, phase: 'mythos' });
    table.answer(byName('The Arkham Woods'), 'yes');
    expect(table.board.agenda).toMatchObject({ name: 'The Ritual Begins', doom: 0 });
    table.play({ type: 'ShuffleEncounterDiscard' });
    table.step(() => {
      table.play({ type: 'SpawnEnemy', enemyId: secondGoat, at: mainPath });
      table.answer(byName('Goat Spawn'), 'Roland Banks');
      table.play({ type: 'PlaceDoom', amount: 1, cardId: secondGoat });
    });
    table.nextPhase();
    table.nextPhase();
    table.startTurn(roland);
    table.fight(roland, byName('Ghoul Minion'), { damage: 2 });
    table.fight(roland, byName('Ravenous Ghoul'), { damage: 2 });
    table.endTurn(roland);
    table.startTurn(daisy);
    table.fight(daisy, byName('Ravenous Ghoul'));
    table.endTurn(daisy);
    table.nextPhase();
    table.resolveEnemyAttacks();
    table.nextPhase();

    // Round 5 – Roland fails Grasping Hands; Daisy draws Ancient Evils and
    // places its doom by hand.
    expect(table.nextPhase()).toMatchObject({ round: 5, phase: 'mythos' });
    table.answer(byName('Grasping Hands'), 'fail');
    table.nextPhase();
    table.play({ type: 'PlaceDoom', amount: 1 });
    table.nextPhase();
    quietTurn(roland);
    quietTurn(daisy);
    table.nextPhase();
    table.resolveEnemyAttacks();
    table.nextPhase();

    // Round 6 – agenda 2 advances, and both pass its willpower tests by hand.
    // From now on the investigators evade the Goat Spawn rather than defeat
    // them: each defeat costs everyone at the Main Path 1 horror, which they
    // need to stand Umôrdhoth's attacks.
    expect(table.nextPhase()).toMatchObject({ round: 6, phase: 'mythos' });
    table.answer(byName('The Ritual Begins'), 'yes');
    expect(table.board.agenda).toMatchObject({ name: 'Vengeance Awaits', doom: 0 });
    table.nextPhase();
    table.nextPhase();
    evadeTurn(roland, secondGoat);
    table.startTurn(daisy);
    table.fight(daisy, byName('Ghoul Minion'));
    table.fight(daisy, byName('Ghoul Minion'));
    table.endTurn(daisy);
    table.nextPhase();
    table.nextPhase();
    table.answer(byId(secondGoat), 'Daisy Walker');
    table.nextPhase();

    // Round 7 – another Goat Spawn engages Roland; Daisy draws Umôrdhoth's
    // Wrath and discards 2 cards by hand.
    expect(table.nextPhase()).toMatchObject({ round: 7, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'investigation' });
    evadeTurn(roland, firstGoat);
    evadeTurn(daisy, secondGoat);
    table.nextPhase();
    table.nextPhase();
    table.answer(byId(firstGoat), 'Roland Banks');
    table.answer(byId(secondGoat), 'Daisy Walker');
    table.nextPhase();

    // Round 8 – the third Goat Spawn engages Daisy; the Wizard's 2 doom and
    // the Goat Spawn's 1 leave the agenda 1 short.
    expect(table.nextPhase()).toMatchObject({ round: 8, phase: 'mythos' });
    expect(table.board.doomInPlay).toBe(4);
    table.nextPhase();
    evadeTurn(roland, firstGoat);
    evadeTurn(daisy, secondGoat, thirdGoat);
    table.nextPhase();
    table.nextPhase();
    table.answer(byId(firstGoat), 'Roland Banks');
    table.answer(byId(secondGoat), 'Daisy Walker');
    table.answer(byId(thirdGoat), 'Daisy Walker');
    table.nextPhase();

    // Round 9 – doom fills agenda 3 while act 1 is still current: the Ritual
    // Site comes into play next to the Main Path, Umôrdhoth spawns there, and
    // Vengeance Awaits becomes the act as well as the agenda.
    expect(table.nextPhase()).toMatchObject({ round: 9, phase: 'mythos' });
    table.answer(byName('Vengeance Awaits'), 'yes');
    expect(table.board.agenda).toMatchObject({
      id: vengeanceAwaits,
      name: 'Vengeance Awaits',
      doom: 0,
    });
    expect(table.board.agenda).not.toHaveProperty('threshold');
    expect(table.board.act).toMatchObject({ id: vengeanceAwaits, name: 'Vengeance Awaits' });
    expect(table.board.location(ritualSite)).toMatchObject({ name: 'Ritual Site' });
    expect(table.board.enemiesAt(ritualSite)).toMatchObject([{ name: umordhoth }]);
    expect(table.board.namesIn({ kind: 'setAside' })).toEqual([]);

    // Roland fails Grasping Hands again; Daisy passes Rotting Remains.
    table.nextPhase();
    table.answer(byName('Grasping Hands'), 'fail');
    table.nextPhase();
    table.answer(byName('Rotting Remains'), 'pass');
    expect(table.nextPhase()).toEqual({ round: 9, phase: 'investigation' });

    // Each evades their Goat Spawn and goes to the Ritual Site, where Roland
    // lands the first blow. Each of his hits does 3 damage: his .45 Automatic's 2,
    // plus 1 from a Vicious Blow or another card he commits (the players add it to the damage).
    table.startTurn(roland);
    table.evade(roland, byId(firstGoat));
    table.moveTo(roland, ritualSite);
    table.fight(roland, byName(umordhoth), { damage: 3 });
    table.endTurn(roland);
    table.startTurn(daisy);
    table.evade(daisy, byId(secondGoat));
    table.evade(daisy, byId(thirdGoat));
    table.moveTo(daisy, ritualSite);
    table.endTurn(daisy);

    // Umôrdhoth is massive: he attacks both, 3 damage and 3 horror each.
    expect(table.nextPhase()).toMatchObject({ round: 9, phase: 'enemy' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 7, horror: 3 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 3, horror: 3 });
    table.nextPhase();
    table.nextPhase();

    // Round 10 – Roland draws an Acolyte, Daisy Frozen in Fear, which costs
    // her an extra action. Their 11 damage are the rest of Umôrdhoth's 14
    // health (6, plus 4 per investigator): he is defeated, and the scenario
    // ends in R2.
    table.answer(byName('Acolyte'), 'Arkham Woods 2');
    table.nextPhase();
    expect(table.nextPhase()).toEqual({ round: 10, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName(umordhoth), { damage: 3 });
    table.fight(roland, byName(umordhoth), { damage: 3 });
    table.fight(roland, byName(umordhoth), { damage: 3 });
    table.endTurn(roland);
    table.startTurn(daisy);
    table.spendAction(daisy);
    table.fight(daisy, byName(umordhoth));
    expect(table.board.ended).toBe(false);
    table.fight(daisy, byName(umordhoth));

    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBe('R2');

    // Resolution 2: Umôrdhoth was repelled, each investigator suffers 2
    // physical and 2 mental trauma and earns 10 experience (the victory
    // display is empty), and the campaign is won.
    const proposal = campaign.proposeResolution(ctx, table.state, theDevourerBelowResolutions);
    expect(proposal).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.umordhothRepelled,
          value: { kind: 'flag', value: true },
        },
      },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: rolandBanks.code, kind: 'physical', amount: 2 },
      },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: daisyWalker.code, kind: 'physical', amount: 2 },
      },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: rolandBanks.code, kind: 'mental', amount: 2 },
      },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: daisyWalker.code, kind: 'mental', amount: 2 },
      },
      { kind: 'command', command: { type: 'AwardXp', code: rolandBanks.code, amount: 10 } },
      { kind: 'command', command: { type: 'AwardXp', code: daisyWalker.code, amount: 10 } },
      { kind: 'byHand', textKey: 'scenario.theDevourerBelow.resolution.upgradeDecks' },
      { kind: 'command', command: { type: 'EndCampaign', result: 'won' } },
    ]);

    // The players confirm it: the campaign is over, and won.
    const { log: final } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );

    expect(final.result).toBe('won');
    expect(final.story[ZEALOT_STORY.umordhothRepelled]).toEqual({ kind: 'flag', value: true });
    expect(final.investigators).toMatchObject([
      { code: rolandBanks.code, xpEarned: 10, physicalTrauma: 2, mentalTrauma: 2, fate: 'alive' },
      { code: daisyWalker.code, xpEarned: 10, physicalTrauma: 2, mentalTrauma: 2, fate: 'alive' },
    ]);
    expect(final.playedScenarios.at(-1)).toEqual({
      scenarioId: 'the-devourer-below',
      outcome: { kind: 'resolution', id: 'R2' },
    });
    expect(campaign.findCurrentScenarioId(final)).toBeUndefined();

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
