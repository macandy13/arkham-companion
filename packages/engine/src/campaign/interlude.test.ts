import { describe, expect, it } from 'vitest';
import {
  campaignContext,
  campaignRejectionOf,
  daisyMember,
  makeCampaignLog,
  rolandMember,
} from '../../test/utils';
import {
  campaign,
  campaignDefinitionId,
  cardCode,
  interludeId,
  scenarioId,
  type CampaignDefinition,
  type InterludeDefinition,
  type InterludeStep,
} from '../index';

const firstScenario = scenarioId('first_scenario');
const secondScenario = scenarioId('second_scenario');
const theSurvivors = interludeId('the_survivors');

/** An interlude after the first scenario with `steps`. */
function interludeOf(...steps: InterludeStep[]): InterludeDefinition {
  return { id: theSurvivors, afterScenario: firstScenario, steps };
}

/** Roland and Daisy's log, the first scenario played (with no resolution). */
const afterFirstScenario = makeCampaignLog({
  investigators: [rolandMember, daisyMember],
  playedScenarios: [{ scenarioId: firstScenario, outcome: { kind: 'noResolution' } }],
  position: 1,
});

describe('findDueInterlude', () => {
  const definition: CampaignDefinition = {
    id: campaignDefinitionId('test_campaign'),
    scenarios: [firstScenario, secondScenario],
    chaosBag: { easy: [], standard: [], hard: [], expert: [] },
    interludes: [interludeOf()],
    log: { notes: [], sheets: [] },
  };

  it.each([
    ['before any scenario was played', makeCampaignLog(), undefined],
    ['after the scenario it follows', afterFirstScenario, theSurvivors],
    ['once it was played', { ...afterFirstScenario, playedInterludes: [theSurvivors] }, undefined],
    ['once the campaign is over', { ...afterFirstScenario, result: 'lost' as const }, undefined],
  ])('%s', (_, log, due) => {
    expect(campaign.findDueInterlude(definition, log)?.id).toBe(due);
  });
});

describe('proposeInterlude', () => {
  it('turns the steps into campaign commands for each living investigator', () => {
    const proposal = campaign.proposeInterlude(
      { ...afterFirstScenario, investigators: [rolandMember, { ...daisyMember, fate: 'killed' }] },
      interludeOf(
        { kind: 'record', key: 'theSurvivorsMet', value: { kind: 'flag', value: true } },
        { kind: 'addChaosToken', token: 'elderThing' },
        { kind: 'awardXp', to: 'each', amount: 2 },
        { kind: 'addTrauma', to: 'each', trauma: 'mental', amount: 1 },
        { kind: 'byHand', textKey: 'interlude.shuffleDecks' },
      ),
      [],
    );

    expect(proposal).toEqual({
      kind: 'changes',
      changes: [
        {
          kind: 'command',
          command: {
            type: 'RecordStory',
            key: 'theSurvivorsMet',
            value: { kind: 'flag', value: true },
          },
        },
        { kind: 'command', command: { type: 'AddChaosToken', token: 'elderThing' } },
        { kind: 'command', command: { type: 'AwardXp', code: rolandMember.code, amount: 2 } },
        {
          kind: 'command',
          command: { type: 'AddTrauma', code: rolandMember.code, kind: 'mental', amount: 1 },
        },
        { kind: 'byHand', textKey: 'interlude.shuffleDecks' },
      ],
    });
  });

  it('offers a card one investigator earns as a choice between the living team', () => {
    const drMilan = cardCode('02080');

    const proposal = campaign.proposeInterlude(
      afterFirstScenario,
      interludeOf({ kind: 'earnCard', to: 'chosen', card: drMilan }),
      [],
    );

    expect(proposal).toEqual({
      kind: 'changes',
      changes: [
        {
          kind: 'choice',
          options: [
            { type: 'EarnCard', code: rolandMember.code, card: drMilan },
            { type: 'EarnCard', code: daisyMember.code, card: drMilan },
          ],
        },
      ],
    });
  });

  it.each([
    ['when the log holds the flag', { rescuedTheProfessor: { kind: 'flag', value: true } }, 3],
    ['when it does not', {}, 1],
  ] as const)('reads the campaign log %s', (_, story, xp) => {
    const proposal = campaign.proposeInterlude(
      { ...afterFirstScenario, investigators: [rolandMember], story },
      interludeOf({
        kind: 'whenStory',
        condition: { kind: 'flag', key: 'rescuedTheProfessor', value: true },
        then: [{ kind: 'awardXp', to: 'each', amount: 3 }],
        otherwise: [{ kind: 'awardXp', to: 'each', amount: 1 }],
      }),
      [],
    );

    expect(proposal).toEqual({
      kind: 'changes',
      changes: [
        { kind: 'command', command: { type: 'AwardXp', code: rolandMember.code, amount: xp } },
      ],
    });
  });

  describe('a decision of the players, with a second one behind its first option', () => {
    const decision = interludeOf({
      kind: 'decide',
      questionKey: 'interlude.whereToGo',
      options: [
        {
          labelKey: 'interlude.toTheTrain',
          steps: [
            {
              kind: 'decide',
              questionKey: 'interlude.whoStaysBehind',
              options: [
                { labelKey: 'interlude.nobody', steps: [] },
                { labelKey: 'interlude.theProfessor', steps: [] },
              ],
            },
            { kind: 'addChaosToken', token: 'cultist' },
          ],
        },
        { labelKey: 'interlude.toTheMuseum', steps: [{ kind: 'removeChaosToken', token: '-1' }] },
      ],
    });
    const log = { ...afterFirstScenario, investigators: [rolandMember] };

    it.each([
      [
        'asks the first question before any answer',
        [],
        {
          kind: 'question',
          question: {
            questionKey: 'interlude.whereToGo',
            options: ['interlude.toTheTrain', 'interlude.toTheMuseum'],
          },
        },
      ],
      [
        'asks the question behind the first answer next',
        [0],
        {
          kind: 'question',
          question: {
            questionKey: 'interlude.whoStaysBehind',
            options: ['interlude.nobody', 'interlude.theProfessor'],
          },
        },
      ],
      [
        'proposes the steps of both answers',
        [0, 1],
        {
          kind: 'changes',
          changes: [{ kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } }],
        },
      ],
      [
        'proposes the steps of the other option, which asks nothing more',
        [1],
        {
          kind: 'changes',
          changes: [{ kind: 'command', command: { type: 'RemoveChaosToken', token: '-1' } }],
        },
      ],
      [
        'asks again for an answer outside the options',
        [5],
        {
          kind: 'question',
          question: {
            questionKey: 'interlude.whereToGo',
            options: ['interlude.toTheTrain', 'interlude.toTheMuseum'],
          },
        },
      ],
    ] as const)('%s', (_, answers, proposal) => {
      expect(campaign.proposeInterlude(log, decision, answers)).toEqual(proposal);
    });
  });

  it('refuses a story condition that asks a record of another kind than the log holds', () => {
    const asksAFlag = interludeOf({
      kind: 'whenStory',
      condition: { kind: 'flag', key: 'cultistsWhoGotAway', value: true },
      then: [],
    });
    const holdsAList = {
      ...afterFirstScenario,
      story: { cultistsWhoGotAway: { kind: 'list', entries: ['Ruth Turner'] } } as const,
    };

    expect(campaignRejectionOf(() => campaign.proposeInterlude(holdsAList, asksAFlag, []))).toEqual(
      { code: 'storyConditionMismatch', key: 'cultistsWhoGotAway', condition: 'flag' },
    );
  });

  it('proposes nothing more for an investigator its trauma drives insane', () => {
    const nearlyInsane = { ...rolandMember, mentalTrauma: rolandMember.sanity - 1 };

    const proposal = campaign.proposeInterlude(
      { ...afterFirstScenario, investigators: [nearlyInsane] },
      interludeOf(
        { kind: 'addTrauma', to: 'each', trauma: 'mental', amount: 1 },
        { kind: 'awardXp', to: 'each', amount: 2 },
      ),
      [],
    );

    expect(proposal).toEqual({
      kind: 'changes',
      changes: [
        {
          kind: 'command',
          command: { type: 'AddTrauma', code: rolandMember.code, kind: 'mental', amount: 1 },
        },
      ],
    });
  });
});

describe('applyInterlude', () => {
  it('writes the confirmed commands and the interlude as played, each caused by it', () => {
    const written = campaign.applyInterlude(campaignContext, afterFirstScenario, interludeOf(), [
      { type: 'AwardXp', code: rolandMember.code, amount: 2 },
    ]);

    expect(written.log.playedInterludes).toEqual([theSurvivors]);
    expect(campaign.findInvestigator(written.log, rolandMember.code)?.xpEarned).toBe(2);
    expect(written.events.map((event) => event.type)).toEqual(['XpChanged', 'InterludePlayed']);
    expect(written.causes).toEqual([
      { kind: 'interlude', interludeId: theSurvivors },
      { kind: 'interlude', interludeId: theSurvivors },
    ]);
  });

  it('refuses an interlude that does not follow the last played scenario', () => {
    expect(
      campaignRejectionOf(() =>
        campaign.applyInterlude(campaignContext, makeCampaignLog(), interludeOf(), []),
      ),
    ).toEqual({ code: 'interludeNotDue', interludeId: theSurvivors });
  });

  it('refuses an interlude of a campaign that is over', () => {
    const lost = { ...afterFirstScenario, result: 'lost' as const };

    expect(
      campaignRejectionOf(() => campaign.applyInterlude(campaignContext, lost, interludeOf(), [])),
    ).toEqual({ code: 'interludeNotDue', interludeId: theSurvivors });
  });

  it('refuses an interlude played already', () => {
    const played = { ...afterFirstScenario, playedInterludes: [theSurvivors] };

    expect(
      campaignRejectionOf(() =>
        campaign.applyInterlude(campaignContext, played, interludeOf(), []),
      ),
    ).toEqual({ code: 'interludeAlreadyPlayed', interludeId: theSurvivors });
  });
});
