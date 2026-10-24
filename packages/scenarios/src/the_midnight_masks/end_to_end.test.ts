/**
 * The Midnight Masks, played end to end: Roland Banks and Daisy Walker, a
 * fixed seed, four rounds to no resolution (read as resolution 1). An
 * integration narrative like The Gathering's: it shows the scenario's
 * automated rules at the table (setup from the campaign log, the Graveyard,
 * False Lead, Hunting Shadow, "Wolf-Man" Drew's heal, the Ghoul Priest shuffled
 * in while he lives) and ends in a resolution applied to the campaign log.
 *
 * What the engine leaves to the players is done by hand, as at the table:
 * spending clues on the act's action and taking the top card of the Cultist
 * deck (the deck is set aside unshuffled until #359), and resigning with
 * the agenda's action.
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

describe('The Midnight Masks end to end: Roland and Daisy, seed 22', () => {
  it('plays from the campaign log to no resolution: the Graveyard, False Lead and Hunting Shadow, Drew drawn from the Cultist deck heals as he attacks, is defeated, and the group resigns', () => {
    // Setup from the log: Your House stands, so the investigators start there;
    // the Ghoul Priest lives, so he is shuffled into the encounter deck. With
    // two investigators one Acolyte waits at Southside with 1 doom.
    const log = afterTheGathering();
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 22, investigators: seats, campaign: log }),
    );

    expect(table.formatted()).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: Predator or Prey? – doom 1/6
      Act: Uncovering the Conspiracy – no clue requirement
      Map Arkham:
        Northside [01134#1] – unrevealed
          connects to: Miskatonic University, Downtown
        Downtown [01131#1] – unrevealed
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
    expect(table.board.namesIn({ kind: 'encounterDeck' }).slice(0, 8)).toEqual([
      ...['False Lead', 'Hunting Shadow'],
      ...['Crypt Chill', 'On Wings of Darkness'],
      ...['Ghoul Priest', 'Obscuring Fog'],
      ...['Locked Door', 'Hunting Nightgaunt'],
    ]);

    // Round 1 – the first round has no mythos phase
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'investigation' });

    // Round 1 – Roland takes Your House's first clue and heads into Rivertown.
    table.startTurn(roland);
    table.investigate(roland);
    table.moveTo(roland, byName('Rivertown'));
    table.investigate(roland);
    table.endTurn(roland);

    // Round 1 – Daisy takes the house's other clue and walks on to the
    // Graveyard. Entering it forces a willpower (3) test.
    table.startTurn(daisy);
    table.investigate(daisy);
    table.moveTo(daisy, byName('Rivertown'));
    table.moveTo(daisy, byName('Graveyard'));

    expect(table.board.decisions).toEqual([
      expect.objectContaining({
        kind: 'skillTestResult',
        about: 'Graveyard',
        for: daisy,
        test: { skill: 'willpower', difficulty: 3 },
      }),
    ]);

    // Willpower 3 and a -1 token miss the 3: she must take 2 horror or move to
    // Rivertown, and stays to search the graves.
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
    table.endTurn(daisy);

    expect(table.board.investigator(daisy)).toMatchObject({ at: 'Graveyard', horror: 2 });
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 2, daisy: 1 });

    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });

    // Round 2 – mythos: Roland draws False Lead. He has clues, so it tests his
    // intellect (4); intellect 3 and a 0 token fail by 1, so he puts 1 of his 2 clues on Rivertown.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      expect.objectContaining({
        about: 'False Lead',
        for: roland,
        test: { skill: 'intellect', difficulty: 4 },
      }),
    ]);
    table.resolveTest({ failedBy: 1 });

    expect(table.board.investigator(roland)).toMatchObject({ clues: 1 });
    expect(table.board.location(byName('Rivertown'))).toMatchObject({ clues: 2 });

    // Daisy draws Hunting Shadow: she spends her clue rather than take 2 damage.
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

    expect(table.board.perInvestigator('clues')).toEqual({ roland: 1, daisy: 0 });
    expect(table.board.namesIn({ kind: 'encounterDiscard' })).toEqual([
      'Hunting Shadow',
      'False Lead',
    ]);

    // Round 2 – investigation: Daisy (intellect 5) searches the Graveyard
    // three times, Roland takes a clue in Rivertown and moves on to Easttown.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    table.startTurn(daisy);
    table.investigate(daisy);
    table.investigate(daisy);
    table.investigate(daisy);
    table.endTurn(daisy);
    table.startTurn(roland);
    table.investigate(roland);
    table.moveTo(roland, byName('Easttown'));

    expect(table.board.perInvestigator('clues')).toEqual({ roland: 2, daisy: 3 });

    // With his last action Roland uses the act's: 2 clues per investigator, as
    // a group, draw the top card of the Cultist deck. The players pay and draw
    // by hand; Drew spawns by his own keyword in Downtown.
    table.step(() => {
      for (const investigator of [roland, daisy])
        table.play({
          type: 'AdjustInvestigator',
          investigatorId: investigator,
          stat: 'clues',
          delta: -2,
        });
      table.play({
        type: 'SpawnEnemy',
        enemyId: instanceId(`${MIDNIGHT_MASKS_CODES.wolfManDrew}#1`),
      });
    });
    table.endTurn(roland);

    expect(table.board.perInvestigator('clues')).toEqual({ roland: 0, daisy: 1 });
    expect(table.board.enemy(byName(drew))).toEqual({ name: drew, at: 'Downtown', health: 4 });

    // Round 2 – Drew is no hunter and the Acolyte waits: nothing attacks.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });

    // Round 3 – mythos: Roland passes Crypt Chill (willpower 3 and a +1 token
    // against 4), Daisy passes On Wings of Darkness (agility 2 and two committed agility icons).
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Crypt Chill'), 'pass');
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('On Wings of Darkness'), 'pass');
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });

    // Round 3 – Roland enters Downtown, which engages Drew, and fires his .45
    // Automatic: a hit for 2 damage, then a miss.
    table.startTurn(roland);
    table.moveTo(roland, byName('Downtown'));
    table.fight(roland, byName(drew), { damage: 2 });
    table.fight(roland, byName(drew), { result: 'fail' });
    table.endTurn(roland);
    // Daisy takes the Graveyard's last clue.
    table.startTurn(daisy);
    table.investigate(daisy);
    table.endTurn(daisy);

    expect(table.board.enemy(byName(drew))).toMatchObject({ engagedWith: roland, damage: 2 });
    expect(table.board.perInvestigator('clues')).toEqual({ roland: 0, daisy: 2 });
    expect(table.board.location(byName('Graveyard'))).toMatchObject({ clues: 0 });

    // Round 3 – enemy phase: Drew attacks Roland for 2 damage and heals 1 of his own.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();

    expect(table.board.investigator(roland)).toMatchObject({ damage: 2 });
    expect(table.board.enemy(byName(drew))).toMatchObject({ damage: 1, exhausted: true });

    // Round 4 – mythos: the Ghoul Priest, shuffled in because he still lives,
    // comes out of Roland's draw and engages him; Obscuring Fog settles on the Graveyard.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });

    expect(table.board.enemiesEngagedWith(roland).map(({ name }) => name)).toEqual([
      drew,
      'Ghoul Priest',
    ]);
    expect(table.board.location(byName('Graveyard'))).toMatchObject({
      attachments: ['Obscuring Fog'],
    });
    // Agenda 1 is still current: its doom and the Acolyte's stay below the threshold of 6.
    expect(table.board.agenda).toMatchObject({ name: 'Predator or Prey?', doom: 3, threshold: 6 });
    expect(table.board.doomInPlay).toBe(4);

    // Round 4 – Roland finishes Drew (2 damage, then 1); he goes to the victory display.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    table.startTurn(roland);
    table.fight(roland, byName(drew), { damage: 2 });
    table.fight(roland, byName(drew));

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual([drew]);

    // With the Ghoul Priest on him, Roland resigns with the agenda's action
    // (resigning provokes no attack of opportunity), and Daisy follows: the
    // game ends with no resolution.
    table.resign(roland);
    table.startTurn(daisy);
    table.resign(daisy);

    // A resigning investigator's clues drop on their location: Daisy's 2 go back
    // onto the Graveyard, so its Victory 1 does not count.
    expect(table.board.location(byName('Graveyard'))).toMatchObject({ clues: 2 });

    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBeUndefined();

    // No resolution reads as resolution 1: Drew was interrogated; the four
    // cultists still in the Cultist deck got away, and so did The Masked Hunter,
    // agenda 1 being current. The Ghoul Priest lives on. Drew's Victory 1 is
    // each investigator's experience.
    const proposal = campaign.proposeResolution(ctx, table.state, theMidnightMasksResolutions);
    expect(proposal).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWeInterrogated,
          value: { kind: 'list', entries: [drew] },
        },
      },
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWhoGotAway,
          value: {
            kind: 'list',
            entries: [
              'Herman Collins',
              'Peter Warren',
              'Victoria Devereux',
              'Ruth Turner',
              'The Masked Hunter',
            ],
          },
        },
      },
      { kind: 'command', command: { type: 'AwardXp', code: rolandBanks.code, amount: 1 } },
      { kind: 'command', command: { type: 'AwardXp', code: daisyWalker.code, amount: 1 } },
      { kind: 'byHand', textKey: 'scenario.theMidnightMasks.resolution.upgradeDecks' },
    ]);

    // The players confirm it, and the log moves on to The Devourer Below.
    const { log: next } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );

    expect(next.story).toMatchObject({
      houseStillStanding: yes,
      ghoulPriestStillAlive: yes,
      cultistsWeInterrogated: { kind: 'list', entries: [drew] },
    });
    expect(next.investigators).toMatchObject([
      { code: rolandBanks.code, xpEarned: 1 },
      { code: daisyWalker.code, xpEarned: 1 },
    ]);
    expect(next.playedScenarios).toEqual([
      { scenarioId: 'the-gathering', outcome: { kind: 'noResolution' } },
      { scenarioId: 'the-midnight-masks', outcome: { kind: 'noResolution' } },
    ]);
    expect(campaign.findCurrentScenarioId(next)).toBe('the-devourer-below');

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
