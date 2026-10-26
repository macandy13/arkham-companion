import { describe, expect, it } from 'vitest';
import {
  campaignContext,
  campaignMember,
  campaignRejectionOf,
  makeCampaignLog,
  roland,
  startedCampaign,
  stateAfter,
} from '../../test/utils';
import {
  blankAgenda,
  blankEnemy,
  cardCode,
  blankLocation,
  campaign,
  CUSTOM_SCENARIO,
  instanceId,
  investigatorCode,
  investigatorId,
  newGame,
  resolutionId,
  scenarioId,
  type Command,
  type InvestigatorId,
  type ResolutionId,
  type ResolutionStep,
  type ScenarioResolutions,
} from '../index';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
/** The card codes the campaign log knows alice and bob by. */
const aliceCode = investigatorCode('alice');
const bobCode = investigatorCode('bob');

/** The resolutions the scenarios below end with. */
const r1 = resolutionId('R1');
const r3 = resolutionId('R3');
const r9 = resolutionId('R9');

const endWith = (resolution: ResolutionId): Command => ({ type: 'EndScenario', resolution });
const resign = (investigator: InvestigatorId): Command => ({
  type: 'Resign',
  investigatorId: investigator,
});
const startTurn = (investigator: InvestigatorId): Command => ({
  type: 'StartTurn',
  investigatorId: investigator,
});
const takeDamage = (investigator: InvestigatorId, delta: number): Command => ({
  type: 'AdjustInvestigator',
  investigatorId: investigator,
  stat: 'damage',
  delta,
});

/** Alice (the lead) and bob in the study, each with 8 health and 6 sanity. */
const table = newGame()
  .withLocation(study, blankLocation('study'))
  .withInvestigator(alice, {
    locationId: study,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
  })
  .withInvestigator(bob, {
    locationId: study,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
  });

describe('proposeResolution', () => {
  it('turns the steps of the resolution the game ended with into campaign commands', () => {
    const resolutions: ScenarioResolutions = {
      byId: {
        [r1]: [
          { kind: 'record', key: 'houseStillStanding', value: { kind: 'flag', value: false } },
          { kind: 'addChaosToken', token: 'cultist' },
          { kind: 'removeChaosToken', token: '-1' },
          { kind: 'addTrauma', to: 'lead', trauma: 'mental', amount: 1 },
          { kind: 'markInsane', to: 'lead' },
        ],
      },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith(r1)),
      resolutions,
    );

    expect(proposal).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: 'houseStillStanding',
          value: { kind: 'flag', value: false },
        },
      },
      { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
      { kind: 'command', command: { type: 'RemoveChaosToken', token: '-1' } },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: aliceCode, kind: 'mental', amount: 1 },
      },
      { kind: 'command', command: { type: 'MarkInsane', code: aliceCode } },
    ]);
  });

  it('awards each investigator the victory points plus the bonus', () => {
    const resolutions: ScenarioResolutions = {
      byId: { [r1]: [{ kind: 'awardXp', to: 'each', bonus: 2, victoryDisplay: true }] },
      none: [],
    };
    const { context, state } = table
      .withCard(instanceId('ghoul_priest'), blankEnemy('ghoul_priest', { victory: 2 }), {
        kind: 'victoryDisplay',
      })
      .start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith(r1)),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'AwardXp', code: aliceCode, amount: 4 } },
      { kind: 'command', command: { type: 'AwardXp', code: bobCode, amount: 4 } },
    ]);
  });

  it('proposes no experience when there is nothing to earn', () => {
    const resolutions: ScenarioResolutions = {
      byId: { [r1]: [{ kind: 'awardXp', to: 'each', bonus: 0, victoryDisplay: true }] },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith(r1)),
      resolutions,
    );

    expect(proposal).toEqual([]);
  });

  it('kills only the investigators who did not resign', () => {
    const resolutions: ScenarioResolutions = {
      byId: { [r3]: [{ kind: 'markKilled', to: 'notResigned' }] },
      none: [],
    };
    const { context, state } = table.withTurnOf(bob).start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, resign(bob), endWith(r3)),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'MarkKilled', code: aliceCode } },
    ]);
  });

  it('gives no defeat trauma to an investigator the resolution kills', () => {
    const resolutions: ScenarioResolutions = {
      byId: { [r3]: [{ kind: 'markKilled', to: 'notResigned' }] },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, takeDamage(bob, 8), endWith(r3)),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'MarkKilled', code: aliceCode } },
      { kind: 'command', command: { type: 'MarkKilled', code: bobCode } },
    ]);
  });

  it('offers no trauma choice to an investigator the resolution kills', () => {
    const resolutions: ScenarioResolutions = {
      byId: { [r3]: [{ kind: 'markKilled', to: 'notResigned' }] },
      none: [],
    };
    const { context, state } = table.start();
    const defeatedByBoth: Command = {
      type: 'TakeDamageAndHorror',
      investigatorId: alice,
      damage: 8,
      horror: 6,
    };

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, defeatedByBoth, endWith(r3)),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'MarkKilled', code: aliceCode } },
      { kind: 'command', command: { type: 'MarkKilled', code: bobCode } },
    ]);
  });

  it('proposes nothing more for an investigator whose trauma reaches their limit', () => {
    const resolutions: ScenarioResolutions = {
      byId: {
        [r1]: [
          { kind: 'addTrauma', to: 'each', trauma: 'mental', amount: 2 },
          { kind: 'awardXp', to: 'each', bonus: 5, victoryDisplay: false },
        ],
      },
      none: [],
    };
    // Alice has 6 sanity on the log and 4 mental trauma already, so 2 more drive her insane.
    const log = makeCampaignLog({
      investigators: [
        { ...campaignMember('alice', 'Alice', 8, 6), mentalTrauma: 4 },
        campaignMember('bob', 'Bob', 8, 6),
      ],
    });
    const { context, state } = table.withCampaign(log).start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith(r1)),
      resolutions,
    );

    expect(proposal).toEqual([
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: aliceCode, kind: 'mental', amount: 2 },
      },
      { kind: 'command', command: { type: 'AddTrauma', code: bobCode, kind: 'mental', amount: 2 } },
      { kind: 'command', command: { type: 'AwardXp', code: bobCode, amount: 5 } },
    ]);
  });

  it('proposes ending the campaign as the resolution says', () => {
    const resolutions: ScenarioResolutions = {
      byId: {},
      none: [{ kind: 'endCampaign', result: 'lost' }],
    };
    const { context, state } = table.withTurnOf(alice).start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, resign(alice), startTurn(bob), resign(bob)),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'EndCampaign', result: 'lost' } },
    ]);
  });

  it('runs the no-resolution steps once every investigator has left', () => {
    const resolutions: ScenarioResolutions = {
      byId: {},
      none: [{ kind: 'byHand', textKey: 'scenario.test.earnStoryAsset' }],
    };
    const { context, state } = table.withTurnOf(alice).start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, resign(alice), startTurn(bob), resign(bob)),
      resolutions,
    );

    expect(proposal).toEqual([{ kind: 'byHand', textKey: 'scenario.test.earnStoryAsset' }]);
  });

  it('adds 1 physical trauma for a defeat by damage after the resolution steps', () => {
    const resolutions: ScenarioResolutions = {
      byId: { [r1]: [{ kind: 'awardXp', to: 'lead', bonus: 1, victoryDisplay: false }] },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, takeDamage(bob, 8), endWith(r1)),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'AwardXp', code: aliceCode, amount: 1 } },
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: bobCode, kind: 'physical', amount: 1 },
      },
    ]);
  });

  it.each([
    [
      'by horror',
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'horror', delta: 6 },
      [
        {
          kind: 'command',
          command: { type: 'AddTrauma', code: aliceCode, kind: 'mental', amount: 1 },
        },
      ],
    ],
    [
      'by damage and horror at once, a choice for the player',
      { type: 'TakeDamageAndHorror', investigatorId: alice, damage: 8, horror: 6 },
      [
        {
          kind: 'choice',
          options: [
            { type: 'AddTrauma', code: aliceCode, kind: 'physical', amount: 1 },
            { type: 'AddTrauma', code: aliceCode, kind: 'mental', amount: 1 },
          ],
        },
      ],
    ],
    ['by a card effect that names none', { type: 'DefeatInvestigator', investigatorId: alice }, []],
    [
      'by a card effect that names physical trauma',
      { type: 'DefeatInvestigator', investigatorId: alice, trauma: 'physical' },
      [
        {
          kind: 'command',
          command: { type: 'AddTrauma', code: aliceCode, kind: 'physical', amount: 1 },
        },
      ],
    ],
  ] as const)('gives the trauma of a defeat %s', (_, defeat, trauma) => {
    const resolutions: ScenarioResolutions = { byId: { [r1]: [] }, none: [] };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, defeat, endWith(r1)),
      resolutions,
    );

    expect(proposal).toEqual(trauma);
  });

  it.each([
    ['the game is still running', [] as Command[]],
    ['the scenario does not define the resolution', [endWith(r9)]],
  ])('proposes nothing while %s', (_, commands) => {
    const resolutions: ScenarioResolutions = { byId: { [r1]: [] }, none: [] };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, ...commands),
      resolutions,
    );

    expect(proposal).toBeUndefined();
  });
});

describe('proposeResolution with steps that read the game', () => {
  const drew = cardCode('wolf_man_drew');
  const herman = cardCode('herman_collins');
  const maskedHunter = cardCode('the_masked_hunter');
  const firstAgenda = cardCode('predator_or_prey');
  /** At the first agenda: Drew was defeated, Herman is engaged with alice, the Masked Hunter is set aside. */
  const masksTable = table
    .withAgenda(instanceId('agenda_1'), blankAgenda('predator_or_prey', null))
    .withCard(instanceId('drew'), blankEnemy('wolf_man_drew', { name: 'Wolf-Man Drew' }), {
      kind: 'victoryDisplay',
    })
    .withCard(instanceId('herman'), blankEnemy('herman_collins', { name: 'Herman Collins' }), {
      kind: 'engaged',
      investigatorId: alice,
    })
    .withCard(
      instanceId('masked_hunter'),
      blankEnemy('the_masked_hunter', { name: 'The Masked Hunter' }),
      { kind: 'setAside' },
    );
  const proposalFor = (...steps: ResolutionStep[]) => {
    const { context, state } = masksTable.start();
    return campaign.proposeResolution(context, stateAfter(context, state, endWith(r1)), {
      byId: { [r1]: steps },
      none: [],
    });
  };
  const flagGhoulPriestDead = {
    kind: 'record',
    key: 'ghoulPriestStillAlive',
    value: { kind: 'flag', value: false },
  } as const;

  it.each([
    [
      'Drew is in the victory display',
      { kind: 'cardIn', code: drew, places: ['victoryDisplay'] },
      true,
    ],
    [
      'Herman, in play, is in the victory display',
      { kind: 'cardIn', code: herman, places: ['victoryDisplay'] },
      false,
    ],
    ['Herman is in play', { kind: 'cardIn', code: herman, places: ['inPlay'] }, true],
    [
      'the Masked Hunter is set aside',
      { kind: 'cardIn', code: maskedHunter, places: ['setAside'] },
      true,
    ],
    [
      'the Masked Hunter, set aside, is in a scenario deck',
      { kind: 'cardIn', code: maskedHunter, places: ['scenarioDeck'] },
      false,
    ],
    [
      'the Ghoul Priest, not in the game, is anywhere',
      {
        kind: 'cardIn',
        code: cardCode('ghoul_priest'),
        places: ['victoryDisplay', 'inPlay', 'setAside'],
      },
      false,
    ],
    ['the current agenda is agenda 1', { kind: 'currentAgenda', agendas: [firstAgenda] }, true],
    [
      'the current agenda is agenda 2',
      { kind: 'currentAgenda', agendas: [cardCode('time_grows_short')] },
      false,
    ],
    [
      'agenda 2 is current or Drew is in the victory display',
      {
        kind: 'anyOf',
        conditions: [
          { kind: 'currentAgenda', agendas: [cardCode('time_grows_short')] },
          { kind: 'cardIn', code: drew, places: ['victoryDisplay'] },
        ],
      },
      true,
    ],
  ] as const)('takes the "then" steps only when %s', (_, condition, holds) => {
    const proposal = proposalFor({
      kind: 'when',
      condition,
      then: [flagGhoulPriestDead],
      otherwise: [{ kind: 'addChaosToken', token: 'cultist' }],
    });

    expect(proposal).toEqual([
      holds
        ? {
            kind: 'command',
            command: {
              type: 'RecordStory',
              key: 'ghoulPriestStillAlive',
              value: { kind: 'flag', value: false },
            },
          }
        : { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
    ]);
  });

  it('proposes nothing for a condition that fails without "otherwise" steps', () => {
    const proposal = proposalFor({
      kind: 'when',
      condition: { kind: 'cardIn', code: herman, places: ['victoryDisplay'] },
      then: [flagGhoulPriestDead],
    });

    expect(proposal).toEqual([]);
  });

  it('records the names of the cards whose condition holds, in step order', () => {
    const gotAway = [drew, herman, maskedHunter].map((code) => ({
      code,
      when: { kind: 'cardIn', code, places: ['inPlay', 'setAside'] } as const,
    }));

    const proposal = proposalFor({
      kind: 'recordNames',
      key: 'cultistsWhoGotAway',
      names: gotAway,
    });

    expect(proposal).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: 'cultistsWhoGotAway',
          value: { kind: 'list', entries: ['Herman Collins', 'The Masked Hunter'] },
        },
      },
    ]);
  });

  it('records nothing when no name qualifies', () => {
    const proposal = proposalFor({
      kind: 'recordNames',
      key: 'cultistsWeInterrogated',
      names: [{ code: herman, when: { kind: 'cardIn', code: herman, places: ['victoryDisplay'] } }],
    });

    expect(proposal).toEqual([]);
  });
});

describe('applyResolution', () => {
  /** Roland's campaign, at the scenario `newGame()` tables play, before the next one. */
  const atTheTablesScenario = startedCampaign({
    investigators: [roland.code],
    scenarioIds: [CUSTOM_SCENARIO, scenarioId('next_scenario')],
  });
  const awardRoland = { type: 'AwardXp', code: roland.code, amount: 3 } as const;

  it('applies the confirmed commands, records the played scenario and moves on', () => {
    const { context, state } = table.start();
    const ended = stateAfter(context, state, endWith(r1));

    const { log } = campaign.applyResolution(campaignContext, atTheTablesScenario, ended, [
      awardRoland,
    ]);

    expect(log.investigators[0]).toMatchObject({ code: roland.code, xpEarned: 3 });
    expect(log.playedScenarios).toEqual([
      { scenarioId: CUSTOM_SCENARIO, outcome: { kind: 'resolution', id: 'R1' } },
    ]);
    expect(log.position).toBe(1);
  });

  it('records "no resolution" when every investigator left', () => {
    const { context, state } = table.withTurnOf(alice).start();
    const ended = stateAfter(context, state, resign(alice), startTurn(bob), resign(bob));

    const { log } = campaign.applyResolution(campaignContext, atTheTablesScenario, ended, []);

    expect(log.playedScenarios).toEqual([
      { scenarioId: CUSTOM_SCENARIO, outcome: { kind: 'noResolution' } },
    ]);
  });

  it('rejects a game that is still running', () => {
    const { state } = table.start();

    expect(
      campaignRejectionOf(() =>
        campaign.applyResolution(campaignContext, atTheTablesScenario, state, [awardRoland]),
      ),
    ).toEqual({ code: 'scenarioNotEnded' });
  });

  it("rejects a game of another scenario than the campaign's current one", () => {
    const { context, state } = table.start();
    const ended = stateAfter(context, state, endWith(r1));
    const atNextScenario = startedCampaign({
      investigators: [roland.code],
      scenarioIds: [scenarioId('first'), CUSTOM_SCENARIO],
    });

    expect(
      campaignRejectionOf(() =>
        campaign.applyResolution(campaignContext, atNextScenario, ended, []),
      ),
    ).toEqual({ code: 'notCurrentScenario', scenarioId: CUSTOM_SCENARIO, current: 'first' });
  });

  it('rejects the whole resolution when one confirmed command is invalid', () => {
    const { context, state } = table.start();
    const ended = stateAfter(context, state, endWith(r1));

    expect(
      campaignRejectionOf(() =>
        campaign.applyResolution(campaignContext, atTheTablesScenario, ended, [
          awardRoland,
          { type: 'RemoveChaosToken', token: 'elderSign' },
        ]),
      ),
    ).toEqual({ code: 'chaosTokenNotInBag', token: 'elderSign' });
  });
});

describe('proposedCommands', () => {
  it('keeps the commands of a proposal in order and drops its by-hand steps', () => {
    const changes = [
      { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
      { kind: 'byHand', textKey: 'scenario.test.upgradeDecks' },
      { kind: 'command', command: { type: 'AwardXp', code: aliceCode, amount: 2 } },
    ] as const;

    expect(campaign.proposedCommands(changes)).toEqual([
      { type: 'AddChaosToken', token: 'cultist' },
      { type: 'AwardXp', code: aliceCode, amount: 2 },
    ]);
  });

  it('takes the first option of a choice left unchanged', () => {
    const changes = [
      {
        kind: 'choice',
        options: [
          { type: 'AddTrauma', code: aliceCode, kind: 'physical', amount: 1 },
          { type: 'AddTrauma', code: aliceCode, kind: 'mental', amount: 1 },
        ],
      },
    ] as const;

    expect(campaign.proposedCommands(changes)).toEqual([
      { type: 'AddTrauma', code: aliceCode, kind: 'physical', amount: 1 },
    ]);
  });
});
