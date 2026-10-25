/**
 * The Midnight Masks, played end to end: Roland Banks and Daisy Walker, a
 * fixed seed, seven rounds until midnight strikes (resolution 2). An
 * integration narrative like The Gathering's: it shows the scenario's
 * automated rules at the table (setup from the campaign log, the Graveyard,
 * Hunting Shadow, False Lead's surge, Mysterious Chanting, the Wizard of the
 * Order's doom, "Wolf-Man" Drew's heal, both agendas advancing on doom) and
 * ends in a resolution applied to the campaign log: two cultists
 * interrogated, three still in the Cultist deck and The Masked Hunter in play
 * got away.
 *
 * What the engine leaves to the players is done by hand, as at the table:
 * the act's action (spend clues as a group, take the top card of the Cultist
 * deck, which stays unshuffled until #359), agenda 1's reverse side putting
 * The Masked Hunter into play, an Acolyte's doom as it enters play, Locked
 * Door, and Herman Collins' parley. The players count actions themselves,
 * so the script keeps each turn to 3 without touching the counter.
 */
import { describe, expect, it } from 'vitest';
import {
  byName,
  campaign,
  campaignId,
  cardDbWith,
  enemyMatching,
  instanceId,
  investigatorId,
  PlayTable,
  replay,
  scenario,
  zoneKey,
  type CampaignCommand,
  type CampaignLog,
  type CardCode,
  type InvestigatorId,
  type CardRef,
  type ScenarioContext,
} from '@arkham/engine';
import { answer } from '@arkham/engine/test/utils';
import {
  GRAVEYARD_DECISION,
  HUNTING_SHADOW_DECISION,
  MIDNIGHT_MASKS_CODES,
  ZEALOT_STORY,
  nightOfTheZealot,
  theGatheringCards,
  theMidnightMasks,
  theMidnightMasksCardDefs,
  theMidnightMasksResolutions,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(
    cardDbWith(theGatheringCards, theMidnightMasksCardDefs),
    zealotInvestigatorCards,
  ),
  scenario: theMidnightMasks,
};
const campaignCtx = { cards: ctx.cards };
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');
/** Roland and Daisy in seat order: Roland leads. */
const seats = [
  { id: roland, code: rolandBanks.code },
  { id: daisy, code: daisyWalker.code },
];
const drew = '"Wolf-Man" Drew';
const herman = 'Herman Collins';
const hunter = 'The Masked Hunter';
const wizard = 'Wizard of the Order';
const yes = { kind: 'flag', value: true } as const;

/**
 * The log after The Gathering ended with no resolution (both investigators
 * defeated in the house): Your House still stands and the Ghoul Priest is
 * still alive, the campaign guide's "no resolution" records.
 */
function afterTheGathering(): CampaignLog {
  const started = campaign.executeCommand(
    campaignCtx,
    campaign.createEmptyLog(),
    campaign.compileStart(nightOfTheZealot, {
      campaignId: campaignId('zealot_campaign'),
      difficulty: 'standard',
      investigators: [rolandBanks.code, daisyWalker.code],
    }),
  ).log;
  const theGatheringRecords: readonly CampaignCommand[] = [
    { type: 'RecordStory', key: ZEALOT_STORY.houseStillStanding, value: yes },
    { type: 'RecordStory', key: ZEALOT_STORY.ghoulPriestStillAlive, value: yes },
    { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } },
  ];
  return theGatheringRecords.reduce<CampaignLog>(
    (log, command) => campaign.executeCommand(campaignCtx, log, command).log,
    started,
  );
}

describe('The Midnight Masks end to end: Roland and Daisy, seed 40', () => {
  it('plays from the campaign log to midnight: Drew and Herman Collins are interrogated, The Masked Hunter hunts Roland, and the doom of the cult advances both agendas', () => {
    // Setup from the log: Your House stands, so the investigators start there;
    // the Ghoul Priest lives, so he is shuffled into the encounter deck. With
    // two investigators one Acolyte waits at Southside with 1 doom.
    const log = afterTheGathering();
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 40, investigators: seats, campaign: log }),
    );

    expect(table.formatted()).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: Predator or Prey? – doom 1/6
      Act: Uncovering the Conspiracy – no clue requirement
      Map Arkham:
        Northside [01134#1] – unrevealed
          connects to: Miskatonic University, Downtown
        Downtown [01130#1] – unrevealed
          connects to: Easttown, Northside
        Easttown [01132#1] – unrevealed
          connects to: Rivertown, Downtown
        Miskatonic University [01129#1] – unrevealed
          connects to: Rivertown, Southside, St. Mary's Hospital, Northside
        Rivertown [01125#1] – unrevealed
          connects to: Easttown, Miskatonic University, Southside, Graveyard, Your House
        Graveyard [01133#1] – unrevealed
          connects to: Rivertown
        St. Mary's Hospital [01128#1] – unrevealed
          connects to: Southside, Miskatonic University
        Southside [01126#1] – unrevealed
          Acolyte [01169#1] – 1 doom, unengaged
          connects to: Rivertown, Miskatonic University, St. Mary's Hospital
        Your House [01124#1] – revealed, 2 clues
          investigators: Roland Banks, Daisy Walker
          connects to: Rivertown
      Investigators:
        Roland Banks – Your House; damage 0/9, horror 0/5, 0 clues, 5 resources, actions left 3; threat area: none
        Daisy Walker – Your House; damage 0/5, horror 0/9, 0 clues, 5 resources, actions left 3; threat area: none
      Encounter deck: 21 cards; discard: 0 cards
      Set aside: 6 cards
      Victory display: none
      Pending decisions: none"
    `);
    // The seed fixes the encounter deck; the draws below follow this order.
    expect(table.board.namesIn({ kind: 'encounterDeck' }).slice(0, 14)).toEqual([
      ...[wizard, 'Hunting Shadow'],
      ...['Crypt Chill', 'Mysterious Chanting'],
      ...['Acolyte', 'False Lead', 'False Lead', 'Mysterious Chanting'],
      ...['Acolyte', 'Locked Door'],
      ...['Obscuring Fog', 'Hunting Shadow'],
      ...['Hunting Nightgaunt', 'Locked Door'],
    ]);
    expect(table.board.namesIn({ kind: 'encounterDeck' })).toContain('Ghoul Priest');

    /**
     * The act's action, by hand: the group spends 2 clues per investigator,
     * as `paid` says, and puts the cultist the players take from the top of
     * the Cultist deck into play by its spawn keyword.
     */
    const drawFromTheCultistDeck = (
      paid: ReadonlyArray<readonly [InvestigatorId, number]>,
      cultist: CardCode,
    ) =>
      table.step(() => {
        for (const [investigator, clues] of paid)
          table.play({
            type: 'AdjustInvestigator',
            investigatorId: investigator,
            stat: 'clues',
            delta: -clues,
          });
        table.play({ type: 'SpawnEnemy', enemyId: instanceId(`${cultist}#1`) });
      });
    /** An Acolyte entering play during the game places 1 doom on itself; the players do it. */
    const acolyteDoomAt = (location: CardRef) =>
      table.play({
        type: 'PlaceDoom',
        amount: 1,
        cardId: table.board.enemyId(enemyMatching(byName('Acolyte'), { at: location })),
      });

    // Round 1 – the first round has no mythos phase. Both take a clue in Your
    // House and one in Rivertown.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });
    table.startTurn(roland);
    table.investigate(roland);
    table.moveTo(roland, byName('Rivertown'));
    table.investigate(roland);
    table.endTurn(roland);
    table.startTurn(daisy);
    table.investigate(daisy);
    table.moveTo(daisy, byName('Rivertown'));
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.board.perInvestigator('clues')).toEqual({ roland: 2, daisy: 2 });

    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });

    // Round 2 – mythos: Roland draws the Wizard of the Order, which spawns at
    // any empty location: the players pick Northside, far away.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName(wizard), 'Northside');

    // Daisy draws Hunting Shadow: she spends a clue rather than take 2 damage.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'scenario.theMidnightMasks.huntingShadow.prompt',
        kind: 'chooseOption',
        for: daisy,
        options: [
          'scenario.theMidnightMasks.huntingShadow.clue',
          'scenario.theMidnightMasks.huntingShadow.damage',
        ],
      },
    ]);
    table.play(answer(HUNTING_SHADOW_DECISION, 'clue'));

    // At the end of the mythos phase the Wizard places 1 doom on itself: the
    // agenda's 1, the Acolyte's and the Wizard's make 3 of 6.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    expect(table.board.enemy(byName(wizard))).toMatchObject({ at: 'Northside' });
    expect(table.board.doomInPlay).toBe(3);

    // Round 2 – Roland takes Easttown's clue, and with his last action the
    // group draws from the Cultist deck: "Wolf-Man" Drew spawns in Downtown.
    table.startTurn(roland);
    table.moveTo(roland, byName('Easttown'));
    table.investigate(roland);
    drawFromTheCultistDeck(
      [
        [roland, 3],
        [daisy, 1],
      ],
      MIDNIGHT_MASKS_CODES.wolfManDrew,
    );
    table.endTurn(roland);

    expect(table.board.enemy(byName(drew))).toEqual({ name: drew, at: 'Downtown', health: 4 });
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 0, daisy: 0 });

    // Round 2 – Daisy enters the Graveyard: willpower 3 and a -1 token miss its
    // 3, and she takes 2 horror rather than move back to Rivertown. Then she
    // searches the graves twice.
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Graveyard'));
    table.answer(byName('Graveyard'), 'fail');
    expect(table.board.decisions).toEqual([
      {
        prompt: 'scenario.theMidnightMasks.graveyard.prompt',
        kind: 'chooseOption',
        for: daisy,
        options: [
          'scenario.theMidnightMasks.graveyard.horror',
          'scenario.theMidnightMasks.graveyard.rivertown',
        ],
      },
    ]);
    table.play(answer(GRAVEYARD_DECISION, 'horror'));
    table.investigate(daisy);
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.board.investigator(daisy)).toMatchObject({ at: 'Graveyard', horror: 2, clues: 2 });

    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });

    // Round 3 – mythos: Roland passes Crypt Chill (willpower 3 and a +1 token
    // against 4). Daisy draws Mysterious Chanting: 2 doom on the nearest
    // Cultist, the Acolyte two steps away. With the Wizard's, doom is 7 of 6.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Crypt Chill'), 'pass');
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    expect(table.board.doomInPlay).toBe(6);
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(7);

    // Round 3 – Roland enters Downtown, which engages Drew, and fights him:
    // a hit with Vicious Blow committed for 1 more damage, then a miss.
    table.startTurn(roland);
    table.moveTo(roland, byName('Downtown'));
    table.fight(roland, byName(drew), { damage: 2 });
    table.fight(roland, byName(drew), { result: 'fail' });
    table.endTurn(roland);

    // Round 3 – Daisy takes the Graveyard's last two clues and spends all four
    // on the act's action: Herman Collins spawns in the Graveyard, on her.
    table.startTurn(daisy);
    table.investigate(daisy);
    table.investigate(daisy);
    drawFromTheCultistDeck([[daisy, 4]], MIDNIGHT_MASKS_CODES.hermanCollins);
    table.endTurn(daisy);

    expect(table.board.location(byName('Graveyard'))).toMatchObject({ clues: 0 });
    expect(table.board.enemy(byName(herman))).toMatchObject({ engagedWith: daisy });

    // Round 3 – enemy phase: Drew attacks Roland for 2 damage and heals 1 of
    // his own; Herman deals Daisy 1 damage and 1 horror.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'enemiesAttack' });
    expect(table.board.attacksDue).toEqual([
      { enemy: drew, investigator: roland },
      { enemy: herman, investigator: daisy },
    ]);
    table.resolveEnemyAttacks();

    expect(table.board.enemy(byName(drew))).toMatchObject({ damage: 1, exhausted: true });
    expect(table.board.investigator(roland)).toMatchObject({ damage: 2 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 1, horror: 3 });

    // Round 4 – mythos: the agenda's doom for the round makes 8, past agenda 1's 6. The players
    // confirm the advance: all doom leaves play and Time Is Running Short begins.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'checkDoomThreshold' });
    expect(table.board.decisions).toEqual([
      expect.objectContaining({ kind: 'confirm', about: 'Predator or Prey?' }),
    ]);
    table.answer(byName('Predator or Prey?'), 'yes');

    expect(table.board.agenda).toMatchObject({ name: 'Time Is Running Short', doom: 0 });
    expect(table.board.doomInPlay).toBe(0);

    // Agenda 1's reverse side puts The Masked Hunter into play, engaged with the
    // investigator with the most clues; with none on either, Roland as the lead
    // takes it on in Downtown.
    table.play({
      type: 'SpawnEnemy',
      enemyId: instanceId(`${MIDNIGHT_MASKS_CODES.theMaskedHunter}#1`),
    });
    table.answer(byName(hunter), 'Downtown');

    // "+2 health per investigator" on a printed 4.
    expect(table.board.enemy(byName(hunter))).toEqual({
      name: hunter,
      at: 'Downtown',
      engagedWith: roland,
      health: 8,
    });

    // Roland draws an Acolyte, which the players spawn at St. Mary's Hospital
    // with its 1 doom. Daisy draws False Lead with no clues: surge, twice, and
    // then Mysterious Chanting's 2 doom lands on Herman, the cultist at her side.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Acolyte'), "St. Mary's Hospital");
    acolyteDoomAt(byName("St. Mary's Hospital"));
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });

    expect(table.board.namesIn({ kind: 'encounterDiscard' }).slice(0, 3)).toEqual([
      'Mysterious Chanting',
      'False Lead',
      'False Lead',
    ]);
    // The Acolyte's 1 and Herman's 2.
    expect(table.board.doomInPlay).toBe(3);

    // Round 4 – investigation (the Wizard's doom makes 4 of 8): Roland finishes
    // Drew, who goes to the victory display: his second Vicious Blow deals 2,
    // a plain hit the last 1. Then he hits the Hunter once.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(4);
    table.startTurn(roland);
    table.fight(roland, byName(drew), { damage: 2 });
    table.fight(roland, byName(drew));
    table.fight(roland, byName(hunter));
    table.endTurn(roland);

    // Round 4 – Daisy parleys with Herman Collins: she discards 4 cards from her
    // hand and he goes to the victory display, his doom with him. Then she
    // walks to Easttown.
    table.startTurn(daisy);
    table.play({
      type: 'ManualAdjust',
      adjustment: {
        kind: 'moveCard',
        cardId: table.board.enemyId(byName(herman)),
        to: { kind: 'victoryDisplay' },
      },
    });
    table.moveTo(daisy, byName('Rivertown'));
    table.moveTo(daisy, byName('Easttown'));
    table.endTurn(daisy);

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual([drew, herman]);
    expect(table.board.doomInPlay).toBe(2);

    // Round 4 – enemy phase: the Hunter attacks Roland for 2 damage and 1 horror.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 4, horror: 1 });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'upkeep' });

    // Round 5 – mythos: another Acolyte, at Miskatonic University with its 1
    // doom. Daisy draws Locked Door, which the players attach to the location
    // with the most clues, Downtown.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Acolyte'), 'Miskatonic University');
    acolyteDoomAt(byName('Miskatonic University'));
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos' });
    expect(table.board.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Locked Door');
    const lockedDoor = table.state.order[zoneKey({ kind: 'encounterDiscard' })]?.[0];
    if (lockedDoor === undefined) throw new Error('Locked Door is not on the encounter discard');
    table.play({
      type: 'ManualAdjust',
      adjustment: {
        kind: 'moveCard',
        cardId: lockedDoor,
        to: { kind: 'attachedTo', hostId: table.board.location(byName('Downtown')).id },
      },
    });

    expect(table.board.location(byName('Downtown'))).toMatchObject({
      clues: 2,
      attachments: ['Locked Door'],
    });

    // Round 5 – investigation (5 of 8): Roland, held by the Hunter, hits it
    // three times; Daisy heads for Southside, where the first Acolyte engages
    // her, and investigating there provokes its attack of opportunity.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(5);
    table.startTurn(roland);
    table.fight(roland, byName(hunter));
    table.fight(roland, byName(hunter));
    table.fight(roland, byName(hunter));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Rivertown'));
    table.moveTo(daisy, byName('Southside'));
    table.investigate(daisy, { result: 'open' });
    table.takeAttackOfOpportunity(enemyMatching(byName('Acolyte'), { engagedWith: daisy }));
    table.resolveTest('pass');
    table.endTurn(daisy);

    expect(table.board.enemy(byName(hunter))).toMatchObject({ damage: 4 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 2, clues: 1 });

    // Round 5 – enemy phase: the Hunter and the Acolyte attack.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 6, horror: 2 });
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 3 });
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'upkeep' });

    // Round 6 – mythos: Obscuring Fog settles on Downtown. Daisy draws Hunting
    // Shadow again; 2 more damage would defeat her, so she spends a clue.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos', step: 'drawEncounterCard' });
    table.play(answer(HUNTING_SHADOW_DECISION, 'clue'));
    expect(table.board.location(byName('Downtown'))).toMatchObject({
      attachments: ['Locked Door', 'Obscuring Fog'],
    });

    // Round 6 – investigation (7 of 8): they give up on the Hunter and save
    // themselves. Roland evades it and falls back through Easttown to Rivertown; Daisy evades
    // her Acolyte and takes Southside's last clue.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(7);
    table.startTurn(roland);
    table.evade(roland, byName(hunter));
    table.moveTo(roland, byName('Easttown'));
    table.moveTo(roland, byName('Rivertown'));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.evade(daisy, enemyMatching(byName('Acolyte'), { engagedWith: daisy }));
    table.investigate(daisy);
    table.endTurn(daisy);

    // Round 6 – the exhausted enemies neither hunt nor attack.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'upkeep' });

    // Round 7 – mythos: the doom reaches 8 and midnight strikes. Agenda 2's
    // reverse side ends the scenario in resolution 2.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'checkDoomThreshold' });
    table.answer(byName('Time Is Running Short'), 'yes');

    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBe('R2');

    // Resolution 2: Drew and Herman were interrogated. Peter Warren, Victoria
    // Devereux and Ruth Turner, still in the Cultist deck, got away, and so did
    // The Masked Hunter, still in play. It is past midnight. The Ghoul Priest
    // never came out of the encounter deck, so he lives on. Experience: Drew's
    // and Herman's Victory 1 and the cleared Graveyard's Victory 1.
    const proposal = campaign.proposeResolution(ctx, table.state, theMidnightMasksResolutions);
    expect(proposal).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWeInterrogated,
          value: { kind: 'list', entries: [drew, herman] },
        },
      },
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWhoGotAway,
          value: {
            kind: 'list',
            entries: ['Peter Warren', 'Victoria Devereux', 'Ruth Turner', hunter],
          },
        },
      },
      {
        kind: 'command',
        command: { type: 'RecordStory', key: ZEALOT_STORY.itIsPastMidnight, value: yes },
      },
      { kind: 'command', command: { type: 'AwardXp', code: rolandBanks.code, amount: 3 } },
      { kind: 'command', command: { type: 'AwardXp', code: daisyWalker.code, amount: 3 } },
      { kind: 'byHand', textKey: 'scenario.theMidnightMasks.resolution.upgradeDecks' },
    ]);

    // The players confirm it, and the log moves on to The Devourer Below.
    const { log: next } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );

    expect(next.story).toEqual({
      houseStillStanding: yes,
      ghoulPriestStillAlive: yes,
      cultistsWeInterrogated: { kind: 'list', entries: [drew, herman] },
      cultistsWhoGotAway: {
        kind: 'list',
        entries: ['Peter Warren', 'Victoria Devereux', 'Ruth Turner', hunter],
      },
      itIsPastMidnight: yes,
    });
    expect(next.investigators).toMatchObject([
      { code: rolandBanks.code, xpEarned: 3 },
      { code: daisyWalker.code, xpEarned: 3 },
    ]);
    expect(next.playedScenarios).toEqual([
      { scenarioId: 'the-gathering', outcome: { kind: 'noResolution' } },
      { scenarioId: 'the-midnight-masks', outcome: { kind: 'resolution', id: 'R2' } },
    ]);
    expect(campaign.findCurrentScenarioId(next)).toBe('the-devourer-below');

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
