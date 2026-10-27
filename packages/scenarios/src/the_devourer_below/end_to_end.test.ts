/**
 * The Devourer Below, played end to end: Roland Banks and Daisy Walker, a
 * fixed seed, six rounds from the campaign log The Midnight Masks' play test
 * ends with to resolution 1, the end of the campaign. An integration narrative
 * like The Gathering's and The Midnight Masks': it shows the scenario's
 * automated rules at the table (setup from the log with doom for the Cultists
 * who got away and the Ghoul Priest, the four random Arkham Woods connecting
 * on their revealed sides, Unhallowed Ground's willpower test, Offer of Power,
 * act 1 opening the Ritual Site and spawning the Cultists who got away on the
 * Main Path, Mysterious Chanting, act 3's action (spend 1 clue, test agility,
 * place a clue on the act) with its attacks of opportunity, hunters closing
 * in, Roland defeated) and
 * ends in a resolution applied to the campaign log: the ritual broken, the
 * Yithian Observer and Peter Warren in the victory display, Roland's defeat
 * trauma, and the campaign won.
 *
 * What the engine leaves to the players is done by hand, as at the table:
 * agenda 1's reverse side (the Monster spawning at the Main Path with 1 doom),
 * act 2's objective and reverse side (the enemy spawning at the Ritual Site),
 * the Ritual Site's clues at the end of the round,
 * Frozen in Fear's extra action, agenda 2's +1 fight and evade, Ancient
 * Evils' doom, Umôrdhoth's Wrath, Twisting Paths' test to leave it (Daisy
 * passes) and the 2 random cards "it is past midnight" discards from each
 * opening hand. The players count actions themselves.
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
  scenario,
  type CampaignCommand,
  type CampaignLog,
  type InvestigatorId,
  type ScenarioContext,
} from '@arkham/engine';
import { answer } from '@arkham/engine/test/utils';
import {
  DEVOURER_BELOW_CODES as codes,
  DISRUPTING_THE_RITUAL_DECISION,
  MIDNIGHT_MASKS_RESOLUTIONS,
  OFFER_OF_POWER_DECISION,
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
const yes = { kind: 'flag', value: true } as const;
const mainPath = instanceId(`${codes.mainPath}#1`);
const ritualSite = instanceId(`${codes.ritualSite}#1`);
/** The four Arkham Woods seed 9 puts into play; they share their name, so they go by ID. */
const unhallowedGround = instanceId(`${codes.arkhamWoodsUnhallowedGround}#1`);
const twistingPaths = instanceId(`${codes.arkhamWoodsTwistingPaths}#1`);
const oldHouse = instanceId(`${codes.arkhamWoodsOldHouse}#1`);
const tangledThicket = instanceId(`${codes.arkhamWoodsTangledThicket}#1`);
const yithian = 'Yithian Observer';
/** The Agents of Yog-Sothoth's Yithian Observer: agenda 1's reverse side spawns it by hand, by ID. */
const yithianObserver = instanceId('01177#1');
const priest = 'Ghoul Priest';
const hunter = 'The Masked Hunter';
const gotAway = ['Peter Warren', 'Victoria Devereux', 'Ruth Turner', hunter];

/**
 * The log The Midnight Masks' play test ends with: The Gathering without a
 * resolution (Your House stands, the Ghoul Priest lives), then The Midnight
 * Masks' R2: Drew and Herman interrogated, three Cultists and The Masked
 * Hunter got away, past midnight, 3 experience each.
 */
function afterTheMidnightMasks(): CampaignLog {
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
    { type: 'RecordStory', key: ZEALOT_STORY.houseStillStanding, value: yes },
    { type: 'RecordStory', key: ZEALOT_STORY.ghoulPriestStillAlive, value: yes },
    { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } },
    {
      type: 'RecordStory',
      key: ZEALOT_STORY.cultistsWeInterrogated,
      value: { kind: 'list', entries: ['"Wolf-Man" Drew', 'Herman Collins'] },
    },
    {
      type: 'RecordStory',
      key: ZEALOT_STORY.cultistsWhoGotAway,
      value: { kind: 'list', entries: gotAway },
    },
    { type: 'RecordStory', key: ZEALOT_STORY.itIsPastMidnight, value: yes },
    { type: 'AwardXp', code: rolandBanks.code, amount: 3 },
    { type: 'AwardXp', code: daisyWalker.code, amount: 3 },
    {
      type: 'AdvanceScenario',
      outcome: { kind: 'resolution', id: MIDNIGHT_MASKS_RESOLUTIONS.pastMidnight },
    },
  ];
  return records.reduce<CampaignLog>(
    (log, command) => campaign.executeCommand(campaignCtx, log, command).log,
    started,
  );
}

describe('The Devourer Below end to end: Roland and Daisy, seed 9', () => {
  it('plays from the campaign log to resolution 1: the Woods, the Cultists who got away at the Main Path, Roland falls holding them off, and Daisy breaks the ritual', () => {
    // Setup from the log: four Cultists got away, so agenda 1 starts with 2
    // doom; the Ghoul Priest lives, so he is in the encounter deck. The
    // Agents of Yog-Sothoth join it, and the Cultists who got away wait set
    // aside with the Ritual Site and Umôrdhoth.
    const log = afterTheMidnightMasks();
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 9, investigators: seats, campaign: log }),
    );

    expect(table.formatted()).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: The Arkham Woods – doom 2/4
      Act: Investigating the Trail – needs 6 clues
      Map Arkham Woods:
        Main Path [01149#1] – revealed, 0 clues
          investigators: Roland Banks, Daisy Walker
          connects to: Arkham Woods, Arkham Woods, Arkham Woods, Arkham Woods
        Arkham Woods [01150#1] – unrevealed
          connects to: Main Path
        Arkham Woods [01151#1] – unrevealed
          connects to: Main Path
        Arkham Woods [01152#1] – unrevealed
          connects to: Main Path
        Arkham Woods [01154#1] – unrevealed
          connects to: Main Path
      Investigators:
        Roland Banks – Main Path; damage 0/9, horror 0/5, 0 clues, 5 resources, actions left 3; threat area: none
        Daisy Walker – Main Path; damage 0/5, horror 0/9, 0 clues, 5 resources, actions left 3; threat area: none
      Encounter deck: 30 cards; discard: 0 cards
      Set aside: 6 cards
      Victory display: none
      Pending decisions: none"
    `);
    // The seed fixes the encounter deck. Round 2 draws its first two cards;
    // agenda 1's reverse side shuffles the discard back in, which reorders the rest.
    expect(table.board.namesIn({ kind: 'encounterDeck' }).slice(0, 8)).toEqual([
      ...['Offer of Power', 'Frozen in Fear'],
      ...['Wizard of the Order', 'Ancient Evils'],
      ...['Ravenous Ghoul', 'Acolyte', yithian, priest],
    ]);
    expect(table.board.namesIn({ kind: 'setAside' }).sort()).toEqual([
      'Peter Warren',
      'Ritual Site',
      'Ruth Turner',
      hunter,
      'Umôrdhoth',
      'Victoria Devereux',
    ]);

    /**
     * Act 3's action: the investigator spends 1 clue and passes the agility
     * test they pick, so 1 clue goes onto the act.
     */
    const placeClueOnTheAct = (investigator: InvestigatorId) => {
      table.useCardAction(investigator, byName('Disrupting the Ritual'));
      table.play(answer(DISRUPTING_THE_RITUAL_DECISION, 'agility'));
      table.answer(byName('Disrupting the Ritual'), 'pass');
    };

    // Round 1 – no mythos phase. Roland takes the 2 clues of the Old House, Daisy
    // the 2 of the Twisting Paths. Once both are revealed, the ring connects them.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    table.startTurn(roland);
    table.moveTo(roland, oldHouse);
    table.investigate(roland);
    table.investigate(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.moveTo(daisy, twistingPaths);
    table.investigate(daisy);
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.board.perInvestigator('clues')).toEqual({ roland: 2, daisy: 2 });
    expect(table.board.maps[0]?.connections).toContainEqual(
      expect.objectContaining({ from: oldHouse, to: twistingPaths }),
    );

    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });

    // Round 2 – mythos: doom 3 of 4. Roland draws Offer of Power and takes 2
    // horror rather than 2 more doom, which would advance the agenda. Daisy
    // draws Frozen in Fear.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    table.play(answer(OFFER_OF_POWER_DECISION, 'horror'));
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    expect(table.board.investigator(roland)).toMatchObject({ horror: 2 });
    expect(table.board.investigator(daisy).threatArea).toEqual(['Frozen in Fear']);
    expect(table.board.doomInPlay).toBe(3);

    // Round 2 – the unrevealed Woods connect only to the Main Path. Roland walks
    // round to Unhallowed Ground, fails its willpower test (1 horror, 1 damage)
    // and takes a clue; Daisy passes Twisting Paths' test to leave it (by
    // hand), is slowed by Frozen in Fear, reaches the Tangled Thicket and fails
    // to shake off her fear.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(roland);
    table.moveTo(roland, mainPath);
    table.moveTo(roland, unhallowedGround);
    table.answer(unhallowedGround, 'fail');
    table.investigate(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.moveTo(daisy, mainPath);
    table.spendAction(daisy);
    table.moveTo(daisy, tangledThicket);
    table.endTurn(daisy);
    table.answer(byName('Frozen in Fear'), 'fail');

    expect(table.board.investigator(roland)).toMatchObject({ damage: 1, horror: 3, clues: 3 });

    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });

    // Round 3 – mythos: the doom for the round makes 4 of 4, and The Arkham
    // Woods advance. Its reverse side, by hand: the discard is shuffled back,
    // and the first Monster from the top, the Yithian Observer, spawns at the
    // Main Path with 1 doom.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'checkDoomThreshold' });
    table.answer(byName('The Arkham Woods'), 'yes');
    expect(table.board.agenda).toMatchObject({ name: 'The Ritual Begins', doom: 0 });
    table.play({ type: 'ShuffleEncounterDiscard' });
    expect(table.board.namesIn({ kind: 'encounterDeck' }).slice(0, 3)).toEqual([
      yithian,
      priest,
      'Grasping Hands',
    ]);
    table.step(() => {
      table.play({ type: 'SpawnEnemy', enemyId: yithianObserver, at: mainPath });
      table.play({ type: 'PlaceDoom', amount: 1, cardId: yithianObserver });
    });

    // Round 3 – mythos: Roland draws the Ghoul Priest, still alive from The
    // Gathering, who spawns engaged with him as the one who drew him; Daisy fails against
    // Grasping Hands and takes 1 damage.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.enemy(byName(priest))).toMatchObject({ engagedWith: roland });
    table.answer(byName('Grasping Hands'), 'fail');
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 1 });

    // Round 3 – Roland slips away from the Priest and takes Unhallowed Ground's
    // last clue; Daisy takes the Thicket's two. With 8 clues the group spends
    // 6 on act 1: the Ritual Site joins the Woods above the Main Path, and the
    // Cultists who got away in The Midnight Masks spawn there.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    table.startTurn(roland);
    table.evade(roland, byName(priest));
    table.investigate(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.investigate(daisy);
    table.investigate(daisy);
    table.spendCluesToAdvanceAct([
      [roland, 3],
      [daisy, 3],
    ]);
    table.endTurn(daisy);
    table.answer(byName('Frozen in Fear'), 'pass');

    expect(table.board.act).toMatchObject({ name: 'Into the Darkness' });
    expect(table.board.maps[0]?.connections).toContainEqual(
      expect.objectContaining({ from: mainPath, to: ritualSite }),
    );
    expect(table.board.namesIn({ kind: 'atLocation', locationId: mainPath }).sort()).toEqual([
      'Peter Warren',
      'Ruth Turner',
      hunter,
      'Victoria Devereux',
      yithian,
    ]);

    // Round 3 – enemy phase: The Masked Hunter hunts; both investigators are
    // one step away with 1 clue each, so the lead sends it to Daisy, and it
    // attacks her for 2 damage and 1 horror.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'huntersMove' });
    table.answer(byName(hunter), 'Daisy Walker');
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'enemiesAttack' });
    expect(table.board.attacksDue).toEqual([{ enemy: hunter, investigator: daisy }]);
    table.resolveEnemyAttacks();
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 3, horror: 1 });

    // Round 4 – mythos: Roland resolves Umôrdhoth's Wrath by hand, discarding
    // cards; Daisy draws Dissonant Voices. The Priest is ready again and
    // engages Roland.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });
    expect(table.board.enemy(byName(priest))).toMatchObject({ engagedWith: roland });
    expect(table.board.doomInPlay).toBe(2);

    // Round 4 – Roland evades the Priest and steps onto the Main Path, where all
    // four enemies engage him, and wounds the Yithian Observer. Daisy slips
    // away from The Masked Hunter, crosses the Main Path behind him and enters
    // the Ritual Site: act 2's objective, advanced by hand. Its reverse side,
    // by hand: the discard is shuffled back and the first enemy from the top,
    // a Ghoul Minion, spawns at the Ritual Site, engaged with Daisy, who has no
    // action left.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    table.startTurn(roland);
    table.evade(roland, byName(priest));
    table.moveTo(roland, mainPath);
    table.fight(roland, byName(yithian), { damage: 2 });
    table.endTurn(roland);

    expect(table.board.namesIn({ kind: 'engaged', investigatorId: roland }).sort()).toEqual([
      'Peter Warren',
      'Ruth Turner',
      'Victoria Devereux',
      yithian,
    ]);

    table.startTurn(daisy);
    table.evade(daisy, byName(hunter));
    table.moveTo(daisy, mainPath);
    table.moveTo(daisy, ritualSite);
    table.play({ type: 'AdvanceAct' });
    table.step(() => {
      table.play({ type: 'ShuffleEncounterDiscard' });
      table.play({
        type: 'DrawEncounter',
        investigatorId: daisy,
        match: { typeCode: 'enemy' },
        discardSkipped: true,
      });
    });
    table.endTurn(daisy);

    expect(table.board.act).toMatchObject({ name: 'Disrupting the Ritual' });
    expect(table.board.location(ritualSite)).toMatchObject({ revealed: true, clues: 4 });

    // Round 4 – enemy phase: the four enemies engaged with Roland attack him
    // for 4 damage and the Yithian Observer's 1 horror; the Ghoul Minion
    // attacks Daisy.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 5, horror: 4 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 4, horror: 2 });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'upkeep' });

    // Round 5 – mythos: Roland draws Mysterious Chanting; Peter Warren, Victoria
    // Devereux and Ruth Turner are equally near, and the lead picks Peter for
    // the 2 doom. Daisy draws Frozen in Fear again. Doom is 5 of 5: unless it
    // leaves play, the agenda advances next round.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Mysterious Chanting'), 'Peter Warren');
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos' });
    expect(table.board.doomInPlay).toBe(5);

    // Round 5 – Roland finishes the Yithian Observer and Peter Warren with his
    // .45 and a Vicious Blow, which takes their 3 doom out of play, and places
    // his last clue on act 3; Victoria and Ruth make attacks of opportunity as he does.
    // Daisy defeats the Ghoul Minion and, with Deduction, takes 2 clues from
    // the Ritual Site.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName(yithian), { damage: 2 });
    table.fight(roland, byName('Peter Warren'), { damage: 3 });
    table.useCardAction(roland, byName('Disrupting the Ritual'));
    for (const attacker of ['Victoria Devereux', 'Ruth Turner'])
      table.takeAttackOfOpportunity(byName(attacker));
    table.play(answer(DISRUPTING_THE_RITUAL_DECISION, 'agility'));
    table.answer(byName('Disrupting the Ritual'), 'pass');
    table.endTurn(roland);
    table.startTurn(daisy);
    table.fight(daisy, byName('Ghoul Minion'));
    table.fight(daisy, byName('Ghoul Minion'));
    table.investigate(daisy, { clues: 2 });
    table.endTurn(daisy);
    table.answer(byName('Frozen in Fear'), 'fail');

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual([yithian, 'Peter Warren']);
    expect(table.board.doomInPlay).toBe(2);
    expect(table.board.investigator(daisy)).toMatchObject({ clues: 3 });

    // Round 5 – enemy phase: both hunters close in on the Main Path and engage
    // Roland; the lead moves The Masked Hunter first. With Victoria's and
    // Ruth's attacks his ninth damage defeats him.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'huntersMove' });
    table.answerOnly(hunter);
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'enemiesAttack' });
    expect(table.board.attacksDue).toEqual([
      { enemy: 'Victoria Devereux', investigator: roland },
      { enemy: 'Ruth Turner', investigator: roland },
      { enemy: hunter, investigator: roland },
      { enemy: priest, investigator: roland },
    ]);
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ status: 'defeated', damage: 9 });

    // As the round ends in upkeep, the Ritual Site fills up to 4 clues again, by hand.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'upkeep' });
    table.play({
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: ritualSite, token: 'clue', delta: 2 },
    });

    // Round 6 – mythos: Daisy draws Ancient Evils and places its doom by hand,
    // 4 of 5. Alone, she places her 3 clues on the act; with Roland's that
    // makes 4, 2 per investigator, and the act's objective advances it by
    // itself: the ritual is broken (R1) a round before the agenda would have
    // advanced.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos' });
    expect(table.board.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Ancient Evils');
    table.play({ type: 'PlaceDoom', amount: 1 });
    expect(table.board.doomInPlay).toBe(4);
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'investigation' });
    table.startTurn(daisy);
    placeClueOnTheAct(daisy);
    placeClueOnTheAct(daisy);
    placeClueOnTheAct(daisy);

    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBe('R1');

    // Resolution 1: the ritual was broken, each investigator suffers 2 mental
    // trauma and earns the victory display's 2 experience plus 5, the campaign
    // is won; Roland's defeat by damage adds 1 physical trauma.
    const proposal = campaign.proposeResolution(ctx, table.state, theDevourerBelowResolutions);
    expect(proposal).toEqual([
      {
        kind: 'command',
        command: { type: 'RecordStory', key: ZEALOT_STORY.ritualBroken, value: yes },
      },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: rolandBanks.code, kind: 'mental', amount: 2 },
      },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: daisyWalker.code, kind: 'mental', amount: 2 },
      },
      { kind: 'command', command: { type: 'AwardXp', code: rolandBanks.code, amount: 7 } },
      { kind: 'command', command: { type: 'AwardXp', code: daisyWalker.code, amount: 7 } },
      { kind: 'byHand', textKey: 'scenario.theDevourerBelow.resolution.upgradeDecks' },
      { kind: 'command', command: { type: 'EndCampaign', result: 'won' } },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: rolandBanks.code, kind: 'physical', amount: 1 },
      },
    ]);

    // The players confirm it: the campaign is over, and won.
    const { log: final } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );

    expect(final.result).toBe('won');
    expect(final.story[ZEALOT_STORY.ritualBroken]).toEqual(yes);
    expect(final.investigators).toMatchObject([
      { code: rolandBanks.code, xpEarned: 10, physicalTrauma: 1, mentalTrauma: 2, fate: 'alive' },
      { code: daisyWalker.code, xpEarned: 10, physicalTrauma: 0, mentalTrauma: 2, fate: 'alive' },
    ]);
    expect(final.playedScenarios.at(-1)).toEqual({
      scenarioId: 'the-devourer-below',
      outcome: { kind: 'resolution', id: 'R1' },
    });
    expect(campaign.findCurrentScenarioId(final)).toBeUndefined();

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
