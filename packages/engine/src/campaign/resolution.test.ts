import { describe, expect, it } from 'vitest';
import { stateAfter } from '../../test/utils';
import {
  blankEnemy,
  blankLocation,
  campaign,
  instanceId,
  investigatorCode,
  investigatorId,
  newGame,
  type Command,
  type InvestigatorId,
  type ScenarioResolutions,
} from '../index';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
/** The card codes the campaign log knows alice and bob by. */
const aliceCode = investigatorCode('alice');
const bobCode = investigatorCode('bob');

const endWith = (resolution: string): Command => ({ type: 'EndScenario', resolution });
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
        R1: [
          { kind: 'record', key: 'houseStillStanding', value: { kind: 'flag', value: false } },
          { kind: 'addChaosToken', token: 'cultist' },
          { kind: 'addTrauma', to: 'lead', trauma: 'mental', amount: 1 },
        ],
      },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith('R1')),
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
      {
        kind: 'command',
        command: { type: 'AddTrauma', code: aliceCode, kind: 'mental', amount: 1 },
      },
    ]);
  });

  it('awards each investigator the victory points plus the bonus', () => {
    const resolutions: ScenarioResolutions = {
      byId: { R1: [{ kind: 'awardXp', to: 'each', bonus: 2, victoryDisplay: true }] },
      none: [],
    };
    const { context, state } = table
      .withCard(instanceId('ghoul_priest'), blankEnemy('ghoul_priest', { victory: 2 }), {
        kind: 'victoryDisplay',
      })
      .start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith('R1')),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'AwardXp', code: aliceCode, amount: 4 } },
      { kind: 'command', command: { type: 'AwardXp', code: bobCode, amount: 4 } },
    ]);
  });

  it('proposes no experience when there is nothing to earn', () => {
    const resolutions: ScenarioResolutions = {
      byId: { R1: [{ kind: 'awardXp', to: 'each', bonus: 0, victoryDisplay: true }] },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, endWith('R1')),
      resolutions,
    );

    expect(proposal).toEqual([]);
  });

  it('kills only the investigators who did not resign', () => {
    const resolutions: ScenarioResolutions = {
      byId: { R3: [{ kind: 'markKilled', to: 'notResigned' }] },
      none: [],
    };
    const { context, state } = table.withTurnOf(bob).start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, resign(bob), endWith('R3')),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'MarkKilled', code: aliceCode } },
    ]);
  });

  it('gives no defeat trauma to an investigator the resolution kills', () => {
    const resolutions: ScenarioResolutions = {
      byId: { R3: [{ kind: 'markKilled', to: 'notResigned' }] },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, takeDamage(bob, 8), endWith('R3')),
      resolutions,
    );

    expect(proposal).toEqual([
      { kind: 'command', command: { type: 'MarkKilled', code: aliceCode } },
      { kind: 'command', command: { type: 'MarkKilled', code: bobCode } },
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
      byId: { R1: [{ kind: 'awardXp', to: 'lead', bonus: 1, victoryDisplay: false }] },
      none: [],
    };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, takeDamage(bob, 8), endWith('R1')),
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
    ['by a card effect', { type: 'DefeatInvestigator', investigatorId: alice }, []],
  ] as const)('gives the trauma of a defeat %s', (_, defeat, trauma) => {
    const resolutions: ScenarioResolutions = { byId: { R1: [] }, none: [] };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, defeat, endWith('R1')),
      resolutions,
    );

    expect(proposal).toEqual(trauma);
  });

  it.each([
    ['the game is still running', [] as Command[]],
    ['the scenario does not define the resolution', [endWith('R9')]],
  ])('proposes nothing while %s', (_, commands) => {
    const resolutions: ScenarioResolutions = { byId: { R1: [] }, none: [] };
    const { context, state } = table.start();

    const proposal = campaign.proposeResolution(
      context,
      stateAfter(context, state, ...commands),
      resolutions,
    );

    expect(proposal).toBeUndefined();
  });
});
