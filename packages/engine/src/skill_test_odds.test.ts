import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  skillTestOdds,
  type ChaosToken,
  type ScenarioReference,
  type SkillTestContext,
  type SkillTestOdds,
} from './index';

const alice = investigatorId('alice');
const study = instanceId('study');

/**
 * The reference card's Easy/Standard side, which a new game at standard difficulty plays: the
 * skull is -2, the cultist says what to do instead of a number.
 */
const reference: ScenarioReference = {
  easyStandard: {
    skull: { modifier: -2, effectKey: 'test.skull' },
    cultist: { effectKey: 'test.cultist' },
  },
  hardExpert: {},
};

/** Alice (intellect 4) in the study (shroud 3), playing a scenario with that reference card. */
const { context, state } = newGame()
  .withLocation(study, blankLocation('study', { shroud: 3, clues: fixed(2) }), { revealed: true })
  .withInvestigator(alice, {
    locationId: study,
    skills: { willpower: 2, intellect: 4, combat: 3, agility: 1 },
  })
  .withDifficulty('standard')
  .withReferenceCard(reference)
  .start();

/** Alice investigating the study: intellect 4 against shroud 3, so a token of -1 or better passes. */
const investigateStudy: SkillTestContext = {
  investigatorId: alice,
  skill: 'intellect',
  difficulty: 3,
  locationId: study,
};

describe('skillTestOdds', () => {
  it.each<{ what: string; bag: ChaosToken[]; modifier?: number; odds: SkillTestOdds }>([
    {
      what: 'passes on the 0 and the -1, fails on the -2 and the -3',
      bag: ['0', '-1', '-2', '-3'],
      odds: { pass: 2 / 4, fail: 2 / 4, unknown: 0 },
    },
    {
      what: 'passes on the -2 too with a committed icon',
      bag: ['0', '-1', '-2', '-3'],
      modifier: 1,
      odds: { pass: 3 / 4, fail: 1 / 4, unknown: 0 },
    },
    {
      what: 'fails on the auto-fail whatever the skill',
      bag: ['+1', 'autoFail'],
      modifier: 10,
      odds: { pass: 1 / 2, fail: 1 / 2, unknown: 0 },
    },
    {
      what: "values the skull by the reference card's -2",
      bag: ['skull', '0'],
      odds: { pass: 1 / 2, fail: 1 / 2, unknown: 0 },
    },
    {
      what: 'leaves the elder sign and a cultist without a number to the players',
      bag: ['elderSign', 'cultist', '0', '-3'],
      odds: { pass: 1 / 4, fail: 1 / 4, unknown: 2 / 4 },
    },
    {
      what: 'draws again after a curse: -2 then 0 fails, so only a 0 drawn first passes',
      bag: ['curse', '0', '0'],
      odds: { pass: 2 / 3, fail: 1 / 3, unknown: 0 },
    },
    {
      what: 'draws again after a bless: +2 then the -3 still passes',
      bag: ['bless', '-3'],
      odds: { pass: 1 / 2, fail: 1 / 2, unknown: 0 },
    },
    {
      what: 'fails only on a curse, then the 0: a bless before or after the curse cancels it',
      bag: ['bless', 'curse', '0'],
      odds: { pass: 5 / 6, fail: 1 / 6, unknown: 0 },
    },
    {
      what: 'fails on a second frost, though 3 committed icons would cover its -2',
      bag: ['frost', 'frost', '0'],
      modifier: 3,
      odds: { pass: 2 / 3, fail: 1 / 3, unknown: 0 },
    },
    {
      what: 'keeps a bless that is the last token: +2 and nothing more',
      bag: ['bless'],
      odds: { pass: 1, fail: 0, unknown: 0 },
    },
    {
      what: 'decides by the values alone from an empty bag',
      bag: [],
      odds: { pass: 1, fail: 0, unknown: 0 },
    },
  ])('$what', ({ bag, modifier, odds }) => {
    const result = skillTestOdds(context, state, investigateStudy, bag, { modifier });

    expect(result.pass).toBeCloseTo(odds.pass);
    expect(result.fail).toBeCloseTo(odds.fail);
    expect(result.unknown).toBeCloseTo(odds.unknown);
  });

  it('works out a bag of ten bless and ten curse tokens and a 0, its chances adding up to 1', () => {
    const bag: ChaosToken[] = [
      ...Array<ChaosToken>(10).fill('bless'),
      ...Array<ChaosToken>(10).fill('curse'),
      '0',
    ];

    const { pass, fail, unknown } = skillTestOdds(context, state, investigateStudy, bag);

    expect(pass + fail + unknown).toBeCloseTo(1);
  });
});
