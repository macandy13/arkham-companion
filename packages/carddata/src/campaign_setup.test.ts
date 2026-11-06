import { describe, expect, it } from 'vitest';
import { campaignChaosBags, scenarioSetup, setupReport } from './index';

// Hand-written fake guide data in ArkhamCards' shape – never real guide text.
describe('campaignChaosBags', () => {
  function campaignWithChoices(choices: object[]) {
    return { steps: [{ id: 'difficulty_choice', type: 'input', input: { choices } }] };
  }

  it('reads the bag of each difficulty, naming symbol tokens as the engine does', () => {
    const campaign = campaignWithChoices([
      { id: 'easy', tokens: ['+1', 'skull', 'auto_fail', 'elder_sign'] },
      { id: 'hard', tokens: ['-3', 'elder_thing'] },
    ]);

    expect(campaignChaosBags(campaign)).toEqual({
      easy: ['+1', 'skull', 'autoFail', 'elderSign'],
      hard: ['-3', 'elderThing'],
    });
  });

  it('rejects a token the engine does not know', () => {
    const campaign = campaignWithChoices([{ id: 'easy', tokens: ['fake_token'] }]);

    expect(() => campaignChaosBags(campaign)).toThrow();
  });

  it('leaves out a choice that is not a difficulty', () => {
    const campaign = campaignWithChoices([{ id: 'fake_mode', tokens: ['0'] }]);

    expect(campaignChaosBags(campaign)).toEqual({});
  });

  it('gives no bags for a campaign without a difficulty choice', () => {
    expect(campaignChaosBags({ steps: [{ id: 'prologue' }] })).toEqual({});
  });
});

describe('scenarioSetup', () => {
  function scenarioWith(setup: string[], steps: object[]) {
    return { id: 'fake_scenario', scenario_name: 'Fake Scenario', setup, steps };
  }

  it('reads the encounter sets gathered and set aside, in setup order', () => {
    const scenario = scenarioWith(
      ['gather_sets', 'gather_cult'],
      [
        { id: 'gather_sets', type: 'encounter_sets', encounter_sets: ['fake_set', 'fake_rats'] },
        {
          id: 'gather_cult',
          type: 'encounter_sets',
          aside: true,
          encounter_sets: ['fake_cult'],
          text: 'Set the fake cult aside.',
        },
      ],
    );

    expect(scenarioSetup(scenario).encounterSets).toEqual([
      { stepId: 'gather_sets', codes: ['fake_set', 'fake_rats'], aside: false },
      {
        stepId: 'gather_cult',
        codes: ['fake_cult'],
        aside: true,
        text: 'Set the fake cult aside.',
      },
    ]);
  });

  it('reads the chaos tokens a setup step adds and removes', () => {
    const scenario = scenarioWith(
      ['change_bag'],
      [
        {
          id: 'change_bag',
          effects: [
            { type: 'add_chaos_token', tokens: ['elder_thing', 'cultist'] },
            { type: 'remove_chaos_token', tokens: ['-2'] },
            { type: 'earn_xp', bonus: 1 },
          ],
        },
      ],
    );

    expect(scenarioSetup(scenario).chaosBagChanges).toEqual([
      { stepId: 'change_bag', add: ['elderThing', 'cultist'], remove: ['-2'] },
    ]);
  });

  it.each([
    { step: { id: 'set_aside_cards', text: 'Set the fake priest aside.' }, reason: 'text' },
    { step: { id: 'check_fake_flag', type: 'branch' }, reason: 'branch' },
    { step: { id: 'choose_fake_lead', type: 'input' }, reason: 'input' },
    { step: { id: 'add_fake_weakness', effects: [{ type: 'add_weakness' }] }, reason: 'effect' },
    {
      step: {
        id: 'gather_fake_ally',
        type: 'encounter_sets',
        encounter_sets: ['fake_ally'],
        effects: [{ type: 'add_card', card: '90001' }],
      },
      reason: 'effect',
    },
  ])('leaves a $reason step to the author', ({ step, reason }) => {
    const scenario = scenarioWith([step.id], [step]);

    expect(scenarioSetup(scenario).byHand).toEqual([{ stepId: step.id, reason }]);
  });

  it.each([
    { step: { id: 'intro', type: 'story', text: 'A fake story.' }, kind: 'a story' },
    { step: { id: 'layout', type: 'location_setup' }, kind: 'a layout' },
    { step: { id: '$play_scenario', type: 'input' }, kind: 'a shared step' },
  ])('has nothing to enter for $kind', ({ step }) => {
    const scenario = scenarioWith([step.id], [step]);

    expect(scenarioSetup(scenario).byHand).toEqual([]);
  });

  it('reads only the steps the setup lists', () => {
    const scenario = scenarioWith(
      [],
      [{ id: 'resolution_step', effects: [{ type: 'add_chaos_token', tokens: ['skull'] }] }],
    );

    expect(scenarioSetup(scenario).chaosBagChanges).toEqual([]);
  });
});

describe('setupReport', () => {
  it('lists the bags, then per scenario what it read and what is left by hand', () => {
    const setup = scenarioSetup({
      id: 'fake_scenario',
      scenario_name: 'Fake Scenario',
      setup: ['gather_sets', 'add_skull', 'set_aside_cards', 'check_fake_flag'],
      steps: [
        { id: 'gather_sets', type: 'encounter_sets', encounter_sets: ['fake_set'] },
        { id: 'add_skull', effects: [{ type: 'add_chaos_token', tokens: ['skull'] }] },
        { id: 'set_aside_cards', text: 'Set the fake priest aside.' },
        { id: 'check_fake_flag', type: 'branch' },
      ],
    });

    expect(setupReport({ easy: ['+1', 'autoFail'] }, [setup])).toEqual([
      'Chaos bags',
      '  easy: +1 autoFail',
      'Fake Scenario (fake_scenario) setup',
      '  encounter sets: fake_set',
      '  chaos bag (add_skull): add skull',
      '  by hand, text only: set_aside_cards',
      '  by hand, depends on the log or players: check_fake_flag',
    ]);
  });

  it('says when the campaign has no bags', () => {
    expect(setupReport({}, [])).toEqual(['No chaos bags: the guide has no difficulty choice']);
  });
});
