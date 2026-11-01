/**
 * The Midnight Masks, played end to end: Roland Banks and Daisy Walker, a
 * fixed seed, eight rounds until midnight strikes (resolution 2). An
 * integration narrative like The Gathering's: it shows the scenario's
 * automated rules at the table (setup from the campaign log, the Graveyard,
 * Hunting Shadow, Mysterious Chanting, On Wings of Darkness carrying Daisy off
 * to a Central location, the Ghoul Priest from The Gathering, the Wizard of
 * the Order's doom, "Wolf-Man" Drew's heal, two hunters chasing the
 * investigators, the act's action paid in clues as a group to draw from the
 * shuffled Cultist deck (seed 40 puts "Wolf-Man" Drew, then Herman Collins on
 * top), the First Bank of Arkham's once-per-game action, Your House's draw
 * left to the players, Daisy resigning through agenda 2's action, both
 * agendas advancing on doom) and ends in a resolution
 * applied to the campaign log: two cultists interrogated, three still in the
 * Cultist deck and The Masked Hunter in play got away.
 *
 * What the engine leaves to the players is done by hand, as at the table:
 * agenda 1's reverse side putting
 * The Masked Hunter into play, an Acolyte's doom as it enters play, Locked
 * Door, and the 4 cards Daisy discards from her hand for Herman Collins'
 * parley. The players count actions themselves,
 * so the script keeps each turn to 3 without touching the counter.
 */
import { describe, expect, it } from 'vitest';
import {
  attachedTo,
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
  type CardRef,
  type ScenarioContext,
} from '@arkham/engine';
import { answer } from '@arkham/engine/test/utils';
import {
  GRAVEYARD_DECISION,
  HUNTING_SHADOW_DECISION,
  LOCKED_DOOR_DECISION,
  MIDNIGHT_MASKS_CODES,
  ZEALOT_STORY,
  nightOfTheZealot,
  theMidnightMasks,
  theMidnightMasksCards,
  theMidnightMasksResolutions,
} from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(theMidnightMasksCards, zealotInvestigatorCards),
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
const act = 'Uncovering the Conspiracy';
const priest = 'Ghoul Priest';
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
      Cultist deck: 5 cards
      Set aside: 1 cards
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
    // any empty location: not Rivertown, where both investigators stand, nor
    // Southside with its Acolyte. The players pick Northside, far away.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.chooseSpawnLocation',
        kind: 'chooseLocation',
        about: wizard,
        card: expect.objectContaining({ name: wizard }),
        options: [
          'Northside',
          'Downtown',
          'Easttown',
          'Miskatonic University',
          'Graveyard',
          "St. Mary's Hospital",
          'Your House',
        ],
      },
    ]);
    table.answer(byName(wizard), 'Northside');

    // Daisy draws Hunting Shadow: she spends a clue rather than take 2 damage.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'scenario.theMidnightMasks.huntingShadow.prompt',
        kind: 'chooseOption',
        card: expect.objectContaining({ name: 'Hunting Shadow' }),
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
    // Nobody names the payers: Roland pays his 3 clues, Daisy the 4th.
    table.useCardAction(roland, byName(act));
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
    table.useCardAction(daisy, byName(act));
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

    // Agenda 1's reverse side puts The Masked Hunter into play, engaged with its
    // prey, the investigator with the most clues. Neither has any, so the lead
    // investigator picks: Roland takes it on in Downtown.
    table.play({
      type: 'SpawnEnemy',
      enemyId: instanceId(`${MIDNIGHT_MASKS_CODES.theMaskedHunter}#1`),
    });
    expect(table.board.decisions).toEqual([
      {
        prompt: 'decision.chooseEngagement',
        kind: 'chooseInvestigator',
        about: hunter,
        card: expect.objectContaining({ name: hunter }),
        options: ['Roland Banks', 'Daisy Walker'],
      },
    ]);
    table.answer(byName(hunter), 'Roland Banks');

    // "+2 health per investigator" on a printed 4.
    expect(table.board.enemy(byName(hunter))).toEqual({
      name: hunter,
      at: 'Downtown',
      engagedWith: roland,
      health: 8,
    });
    // While engaged with it, Roland can't discover or spend clues.
    expect(table.board.investigator(roland).forbidden).toEqual({ clues: ['discover', 'spend'] });

    // Round 4 – mythos: Roland draws the Ghoul Priest, still alive from The
    // Gathering; he spawns engaged with Roland, who has the highest combat. Daisy
    // draws On Wings of Darkness: she passes the agility test, but the card still
    // pulls her loose from Herman Collins and carries her to Rivertown, the
    // Central location next to the Graveyard.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.enemy(byName(priest))).toMatchObject({
      at: 'Downtown',
      engagedWith: roland,
    });
    table.answer(byName('On Wings of Darkness'), 'pass');
    expect(table.board.investigator(daisy)).toMatchObject({
      at: 'Rivertown',
      damage: 1,
      horror: 3,
    });
    expect(table.board.enemy(byName(herman))).toEqual({ name: herman, at: 'Graveyard', health: 4 });

    // Round 4 – investigation (the Wizard's doom makes 1 of 8): Roland finishes
    // Drew, who goes to the victory display: his second Vicious Blow deals 2,
    // a plain hit the last 1. Then he slips away from the Ghoul Priest.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(1);
    table.startTurn(roland);
    table.fight(roland, byName(drew), { damage: 2 });
    table.fight(roland, byName(drew));
    table.evade(roland, byName(priest));
    table.endTurn(roland);

    // Round 4 – Daisy goes back into the Graveyard, passes its willpower test
    // this time and parleys with Herman Collins, who engages her there: she
    // discards 4 cards from her hand and he goes to the victory display. Then
    // she returns to Rivertown.
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Graveyard'));
    table.answer(byName('Graveyard'), 'pass');
    expect(table.board.enemy(byName(herman))).toMatchObject({ engagedWith: daisy });
    const hermanId = table.board.enemyId(byName(herman));
    table.useCardAction(daisy, byName(herman));
    expect(table.events).toContainEqual({
      type: 'CommandDeferred',
      command: {
        type: 'DiscardFromHand',
        investigatorId: daisy,
        amount: 4,
        source: { cardId: hermanId, window: 'action' },
      },
    });
    table.moveTo(daisy, byName('Rivertown'));
    table.endTurn(daisy);

    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual([drew, herman]);
    // 2 of the 6 unique Cultists act 1's objective waits for: it stays.
    expect(table.board.act).toMatchObject({ name: 'Uncovering the Conspiracy' });

    // Round 4 – enemy phase: the evaded, exhausted Priest holds back; the Hunter
    // attacks Roland for 2 damage and 1 horror.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'enemy', step: 'enemiesAttack' });
    expect(table.board.attacksDue).toEqual([{ enemy: hunter, investigator: roland }]);
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 4, horror: 1 });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'upkeep' });

    // Round 5 – mythos: another Acolyte, at St. Mary's Hospital with its 1 doom.
    // Daisy draws Locked Door, which attaches to the location with the most
    // clues, Downtown.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Acolyte'), "St. Mary's Hospital");
    acolyteDoomAt(byName("St. Mary's Hospital"));
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'mythos' });
    // Downtown can't be investigated while the door is attached.
    expect(table.board.location(byName('Downtown'))).toMatchObject({
      clues: 2,
      attachments: ['Locked Door'],
      forbidden: ['investigate'],
    });

    // Round 5 – investigation (4 of 8): the Priest has readied and engaged
    // Roland again. Two enemies at 2 damage each are too much for him: he
    // evades both, and with no enemy engaged he draws on the First Bank of
    // Arkham, Downtown's action, for 3 resources. Daisy takes Easttown's clue
    // and goes back to Rivertown.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(4);
    expect(table.board.enemy(byName(priest))).toMatchObject({ engagedWith: roland });
    table.startTurn(roland);
    table.evade(roland, byName(priest));
    table.evade(roland, byName(hunter));
    table.useCardAction(roland, byName('Downtown'));
    table.endTurn(roland);
    expect(table.board.investigator(roland)).toMatchObject({ resources: 12 });
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Easttown'));
    table.investigate(daisy);
    table.moveTo(daisy, byName('Rivertown'));
    table.endTurn(daisy);

    // Round 5 – the exhausted enemies neither hunt nor attack.
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 5, phase: 'upkeep' });

    // Round 6 – mythos: Roland draws Hunting Shadow with no clue to spend, so he
    // takes the 2 damage; Daisy passes Crypt Chill.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.decisions).toMatchObject([
      { for: roland, options: ['scenario.theMidnightMasks.huntingShadow.damage'] },
    ]);
    table.play(answer(HUNTING_SHADOW_DECISION, 'damage'));
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('Crypt Chill'), 'pass');
    expect(table.board.investigator(roland)).toMatchObject({ damage: 6 });

    // Round 6 – investigation (6 of 8): the Priest and the Hunter readied in
    // Downtown and engaged Roland again. He evades both once more; the bank's
    // action is spent for the game, so he falls back to Easttown. Daisy moves
    // to Your House.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(6);
    expect(table.board.enemy(byName(hunter))).toMatchObject({ engagedWith: roland });
    table.startTurn(roland);
    table.evade(roland, byName(priest));
    table.evade(roland, byName(hunter));
    expect(() => table.useCardAction(roland, byName('Downtown'))).toThrow(
      expect.objectContaining({
        rejection: expect.objectContaining({ code: 'cardActionLimitReached' }),
      }),
    );
    table.moveTo(roland, byName('Easttown'));
    table.endTurn(roland);
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Your House'));
    table.endTurn(daisy);

    // Round 6 – the exhausted enemies neither hunt nor attack.
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 6, phase: 'upkeep' });

    // Round 7 – mythos: the agenda's doom makes 7 of 8, one short. Roland draws
    // the second Locked Door; no location without one has a clue, so Roland,
    // the lead investigator, picks Rivertown among them all. Daisy draws On
    // Wings of Darkness again, fails, takes 1 damage and 1 horror and is
    // carried back to Rivertown.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });
    expect(table.board.doomInPlay).toBe(7);
    table.answer(byName('Locked Door'), 'Rivertown');
    expect(table.board.location(byName('Rivertown')).attachments).toEqual(['Locked Door']);
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'mythos', step: 'drawEncounterCard' });
    table.answer(byName('On Wings of Darkness'), 'fail');
    expect(table.board.investigator(daisy)).toMatchObject({
      at: 'Rivertown',
      damage: 2,
      horror: 4,
    });

    // Round 7 – investigation: the Wizard's doom makes 8. With the hunters
    // next door, Roland runs to Your House and takes its action: he gains 1
    // resource and draws 1 card by hand, as the game holds no player cards.
    // Daisy tries Locked Door's action in Rivertown, passes agility (4) and
    // discards the door, then takes the agenda's action and resigns.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'investigation' });
    expect(table.board.doomInPlay).toBe(8);
    table.startTurn(roland);
    table.moveTo(roland, byName('Rivertown'));
    table.moveTo(roland, byName('Your House'));
    const yourHouse = table.board.location(byName('Your House')).id;
    table.useCardAction(roland, byName('Your House'));
    table.endTurn(roland);
    expect(table.board.investigator(roland)).toMatchObject({ resources: 15 });
    expect(table.events).toContainEqual({
      type: 'CommandDeferred',
      command: {
        type: 'DrawCards',
        investigatorId: roland,
        amount: 1,
        source: { cardId: yourHouse, window: 'action' },
      },
    });
    table.startTurn(daisy);
    const rivertown = table.board.location(byName('Rivertown')).id;
    const rivertownDoor = table.state.order[zoneKey(attachedTo(rivertown))]?.[0];
    if (rivertownDoor === undefined) throw new Error('Locked Door is not attached to Rivertown');
    table.useCardAction(daisy, rivertownDoor);
    table.play(answer(LOCKED_DOOR_DECISION, 'agility'));
    table.answer(rivertownDoor, 'pass');
    expect(table.board.location(byName('Rivertown'))).not.toHaveProperty('attachments');
    expect(table.board.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Locked Door');
    table.useCardAction(daisy, byName('Time Is Running Short'));
    expect(table.board.investigator(daisy).status).toBe('resigned');

    // Round 7 – enemy phase: both hunters move one step, into Easttown, still
    // two steps short; the lead investigator picks the order.
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'enemy', step: 'huntersMove' });
    table.answerOnly(hunter);
    expect(table.board.enemy(byName(hunter))).toMatchObject({ at: 'Easttown' });
    expect(table.board.enemy(byName(priest))).toMatchObject({ at: 'Easttown' });
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 7, phase: 'upkeep' });

    // Round 8 – mythos: the doom passes 8 and midnight strikes. Agenda 2's
    // reverse side ends the scenario in resolution 2.
    expect(table.nextPhase()).toEqual({ round: 8, phase: 'mythos', step: 'checkDoomThreshold' });
    table.answer(byName('Time Is Running Short'), 'yes');

    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBe('R2');

    // Resolution 2: Drew and Herman were interrogated. Peter Warren, Victoria
    // Devereux and Ruth Turner, still in the Cultist deck, got away, and so did
    // The Masked Hunter, still in play. It is past midnight. The Ghoul Priest
    // was never defeated, so he lives on. Experience: Drew's
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
