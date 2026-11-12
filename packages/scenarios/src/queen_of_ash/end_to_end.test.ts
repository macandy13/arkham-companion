/**
 * Queen of Ash, played end to end: Roland Banks and Daisy Walker, seed 1, from the campaign log
 * that Smoke and Mirrors' end-to-end game wrote (`playSmokeAndMirrors`, after
 * `playSpreadingFlames`) to Resolution 3, when Roland floods the sewers: the whole Brethren of Ash
 * campaign in one run. An integration narrative rather than a rules test, like Smoke and Mirrors':
 * it shows setup reading the log (the cult not found: 1 doom more; the trauma carried over), act 1
 * advancing as Roland enters Underground Cistern, Stop the Rite moving a Cultist toward the
 * cistern, Sluice Control's test defeating each enemy and ending in R3, and what that writes to the
 * campaign log, with the facts a player would check at the table asserted where they happen.
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
  cardDbWith,
  instanceId,
  investigatorId,
  PlayTable,
  replay,
  scenario,
  type ScenarioContext,
} from '@arkham/engine';
import { newAshCampaign } from '../brethren_of_ash/campaign.test_support';
import { ASH_STORY, queenOfAsh, queenOfAshCards, queenOfAshResolutions, SEWERS } from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';
import { playSmokeAndMirrors } from '../smoke_and_mirrors/end_to_end.test_support';
import { playSpreadingFlames } from '../spreading_flames/end_to_end.test_support';

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
const infestedPipes = instanceId('12183#1');
const overgrownTunnels = instanceId('12184#1');
const smugglersCache = instanceId('12186#1');
const yes = { kind: 'flag', value: true } as const;

describe('Queen of Ash end to end: Roland and Daisy, seed 1, after Spreading Flames and Smoke and Mirrors', () => {
  it('plays the campaign on from the log Smoke and Mirrors wrote to Resolution 3: Roland enters Underground Cistern, a Cultist closes in on it, and he floods the sewers from Sluice Control', () => {
    // Setup from the log: the cult's whereabouts were not discovered, so A Gathering starts with
    // 1 doom; nobody scoured Arkham or stirred up trouble, so there are no starting clues and no
    // Cultists in the tunnels. The Servant of Flame lives, so it is set aside with Elokoss and
    // Sluice Control. Each investigator starts with 1 damage for Spreading Flames' trauma.
    const log = playSmokeAndMirrors(playSpreadingFlames(newAshCampaign(campaignCtx)));
    const table = PlayTable.from(
      ctx,
      scenario.compileSetup(ctx, { seed: 1, investigators: seats, campaign: log }),
    );

    expect(table.board.agenda).toMatchObject({ name: 'A Gathering', doom: 1 });
    expect(table.board.act?.name).toBe('Search the Sewers');
    expect(table.board.locationsOn(SEWERS)).toHaveLength(7);
    expect(table.board.location(byName('Sewer Culvert')).investigators).toEqual([roland, daisy]);
    expect(table.board.investigator(roland)).toMatchObject({ clues: 0, damage: 1 });
    expect(table.board.investigator(daisy)).toMatchObject({ clues: 0, damage: 1 });
    expect(table.board.enemies).toEqual([]);
    expect(table.board.namesIn({ kind: 'setAside' })).toEqual(
      expect.arrayContaining(['Servant of Flame', 'Elokoss', 'Sluice Control']),
    );

    // Round 1 – investigation: Roland reveals Toxic Waste Pit, Daisy Flooded Crypt, and each takes
    // both clues there. Ending a turn there costs Roland a card from his hand (his to pick) and
    // Daisy 1 horror.
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
    expect(table.board.investigator(roland).clues).toBe(2);
    expect(table.board.investigator(daisy)).toMatchObject({ clues: 2, horror: 1 });

    // Round 2 – mythos: a Zealot spawns at Roland's tunnel (aloof, so it stays unengaged; its doom
    // as it enters play is the players'), and Daisy's Ashen Rebirth is hers to resolve.
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy' });
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'investigation' });
    expect(table.board.agenda).toMatchObject({ name: 'A Gathering', doom: 2 });
    expect(table.board.enemy(byName('Zealot'))).toMatchObject({ at: 'Sewer Tunnels' });
    expect(table.board.enemy(byName('Zealot')).engagedWith).toBeUndefined();

    // Round 2 – investigation: the tunnels connect only through Sewer Culvert and the cistern, so
    // both walk through the culvert to Infested Pipes and take a clue each there: 6 clues between
    // them. Entering it, each discards from the encounter deck until an enemy and draws it: Daisy,
    // who goes first, a Hellhound, which engages her and attacks as she investigates, and Roland,
    // past Noxious Smoke, a second Zealot, aloof.
    table.startTurn(daisy);
    table.moveTo(daisy, byName('Sewer Culvert'));
    table.moveTo(daisy, infestedPipes);
    expect(table.board.enemy(byName('Hellhound')).engagedWith).toBe(daisy);
    table.investigate(daisy, { result: 'open' });
    table.takeAttackOfOpportunity(byName('Hellhound'));
    table.resolveTest('pass');
    table.endTurn(daisy);
    table.startTurn(roland);
    table.moveTo(roland, byName('Sewer Culvert'));
    table.moveTo(roland, infestedPipes);
    table.investigate(roland);
    table.endTurn(roland);
    expect(table.board.investigator(roland).clues).toBe(3);
    expect(table.board.investigator(daisy).clues).toBe(3);
    expect(table.board.enemies.filter(({ name }) => name === 'Zealot')).toHaveLength(2);
    expect(table.board.namesIn({ kind: 'encounterDiscard' })[0]).toBe('Noxious Smoke');

    // Round 2 – enemy: the Hellhound attacks Daisy (its asset discard after the attack is the
    // players'). Round 3 – mythos: Roland passes Putrid Vapors' agility test, and Daisy draws a
    // third Zealot at Infested Pipes.
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(daisy)).toMatchObject({ damage: 3, horror: 3 });
    expect(table.nextPhase()).toEqual({ round: 2, phase: 'upkeep' });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos', step: 'drawEncounterCard' });
    table.resolveRevelation(byName('Putrid Vapors'));
    table.answerOnly('pass');
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'investigation' });
    expect(table.board.enemies.filter(({ name }) => name === 'Zealot')).toHaveLength(3);

    // Round 3 – investigation: Daisy evades the Hellhound so that it makes no attack of
    // opportunity as she leaves, and walks to Overgrown Tunnels. Entering Underground Cistern costs
    // 3 clues per investigator, spent by the group by hand: all 6. Roland enters and act 1
    // advances: Elokoss spawns at the cistern, the Fire! he draws attaches to it, and Sluice
    // Control comes into play beside it. Elokoss cannot make attacks of opportunity, so the players
    // skip the one the engine offers as Roland takes a clue of the cistern's.
    table.startTurn(daisy);
    table.evade(daisy, byName('Hellhound'));
    table.moveTo(daisy, byName('Sewer Culvert'));
    table.moveTo(daisy, overgrownTunnels);
    table.endTurn(daisy);
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
    table.investigate(roland, { result: 'open' });
    table.answer(byName('Elokoss'), 'does not provoke');
    table.resolveTest('pass');
    table.endTurn(roland);
    expect(table.board.investigator(roland).clues).toBe(1);

    // Round 3 – the investigation phase ends with the Fire! at the cistern dealing Roland 1 damage
    // (Elokoss is Elite, so it spares her). Enemy: Elokoss attacks Roland; the evaded Hellhound
    // stays exhausted. Round 3 ends with Stop the Rite: the three Zealots, Cultists, each move one step
    // toward the cistern, which every tunnel connects to.
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'enemy', step: 'enemiesAttack' });
    table.resolveEnemyAttacks();
    expect(table.board.investigator(roland)).toMatchObject({ damage: 5, horror: 3 });
    expect(table.nextPhase()).toEqual({ round: 3, phase: 'upkeep' });
    expect(table.board.enemies.filter(({ name }) => name === 'Zealot').map(({ at }) => at)).toEqual(
      ['Underground Cistern', 'Underground Cistern', 'Underground Cistern'],
    );

    // Round 4 – mythos: the agenda's doom reaches 4; Roland's Langour goes to his threat area and
    // Daisy's Blasphemous Invocation is hers to resolve.
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos', step: 'drawEncounterCard' });
    table.resolveRevelation(byName('Langour'));
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'mythos' });
    expect(table.nextPhase()).toEqual({ round: 4, phase: 'investigation' });
    expect(table.board.agenda).toMatchObject({ name: 'A Gathering', doom: 4 });
    expect(table.board.investigator(roland).threatArea).toEqual(['Langour']);

    // Round 4 – investigation: Daisy takes a clue at Overgrown Tunnels and walks through the
    // culvert to Smuggler's Cache, where ending her turn lets her gain 1 resource.
    // Entering Sluice Control costs 1 clue per investigator, spent by hand: Roland's and Daisy's.
    // Roland enters, skipping Elokoss's attack of opportunity again, and opens the sluice valve:
    // a combat test (5) he passes. Each enemy is defeated, Elokoss into the victory display, and the
    // scenario ends in Resolution 3.
    table.startTurn(daisy);
    table.investigate(daisy);
    table.moveTo(daisy, byName('Sewer Culvert'));
    table.moveTo(daisy, smugglersCache);
    const resources = table.board.investigator(daisy).resources;
    table.endTurn(daisy);
    table.answerOnly('scenario.queenOfAsh.smugglersCache.gain');
    expect(table.board.investigator(daisy).resources).toBe(resources + 1);
    table.startTurn(roland);
    table.play({ type: 'AdjustInvestigator', investigatorId: roland, stat: 'clues', delta: -1 });
    table.play({ type: 'AdjustInvestigator', investigatorId: daisy, stat: 'clues', delta: -1 });
    table.moveTo(roland, byName('Sluice Control'));
    table.answer(byName('Elokoss'), 'does not provoke');
    table.useCardAction(roland, byName('Sluice Control'));
    table.answerOnly('skill.combat');
    table.resolveTest('pass');
    expect(table.board.ended).toBe(true);
    expect(table.board.resolution).toBe('R3');
    expect(table.board.enemies).toEqual([]);
    expect(table.board.namesIn({ kind: 'victoryDisplay' })).toEqual(['Elokoss']);

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

    // The players confirm it unchanged: the log holds the whole campaign. Killed, they earn nothing
    // from Resolution 3, so they keep the 10 experience and 1 physical trauma that Spreading Flames
    // and Smoke and Mirrors left them.
    const { log: next } = campaign.applyResolution(
      campaignCtx,
      log,
      table.state,
      campaign.proposedCommands(proposal ?? []),
    );
    expect(next.story.floodedTheSummoningRitual).toEqual(yes);
    expect(next.investigators).toMatchObject([
      { code: rolandBanks.code, fate: 'killed', xpEarned: 10, physicalTrauma: 1 },
      { code: daisyWalker.code, fate: 'killed', xpEarned: 10, physicalTrauma: 1 },
    ]);
    expect(next.playedScenarios).toEqual([
      { scenarioId: 'spreading-flames', outcome: { kind: 'resolution', id: 'R2' } },
      { scenarioId: 'smoke-and-mirrors', outcome: { kind: 'noResolution' } },
      { scenarioId: 'queen-of-ash', outcome: { kind: 'resolution', id: 'R3' } },
    ]);
    expect(next.result).toBe('won');

    // The whole event log, setup included, replays to the live state.
    expect(replay(table.events)).toEqual(table.state);
  });
});
