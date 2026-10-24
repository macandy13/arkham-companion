import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  blankEnemy,
  blankLocation,
  decisionId,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  revealsAnotherToken,
  skillTestDecision,
  skillTestSuggestion,
  suggestSkillTest,
  trait,
  type ScenarioReference,
  type SkillTestContext,
  type SkillTestInput,
} from './index';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const study = instanceId('study');
const ghoul = instanceId('ghoul');

/** The study: shroud 3, 2 clues. */
const studyCard = blankLocation('study', { name: 'Study', shroud: 3, clues: fixed(2) });
/** A Ghoul enemy with fight 4. */
const ghoulCard = blankEnemy('ghoul', { name: 'Ghoul', fight: 4, traits: [trait('Ghoul')] });

/** Alice (willpower 2, intellect 4, combat 3, agility 1) in the unrevealed study. */
const aliceInStudy = newGame()
  .withLocation(study, studyCard)
  .withInvestigator(alice, {
    locationId: study,
    skills: { willpower: 2, intellect: 4, combat: 3, agility: 1 },
  });

/** Alice investigating the study: intellect 4 against shroud 3. */
const investigateStudy: SkillTestContext = {
  investigatorId: alice,
  skill: 'intellect',
  difficulty: 3,
  locationId: study,
};

describe("skillTestSuggestion: base values, the players' modifier and tokens", () => {
  const { context, state } = aliceInStudy.start();

  it('starts from the investigator skill and the printed difficulty', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy);

    expect(suggestion).toEqual({
      skill: 4,
      difficulty: 3,
      outcome: 'pass',
      margin: 1,
      unknownTokens: [],
      trace: [
        { target: 'skill', source: { kind: 'baseSkill' }, change: 4, total: 4 },
        { target: 'difficulty', source: { kind: 'baseDifficulty' }, change: 3, total: 3 },
      ],
    });
  });

  it("adds the players' modifier and the revealed number token to the skill", () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      modifier: 1,
      tokens: ['-3'],
    });

    expect(suggestion.trace).toEqual([
      { target: 'skill', source: { kind: 'baseSkill' }, change: 4, total: 4 },
      { target: 'skill', source: { kind: 'playerModifier' }, change: 1, total: 5 },
      { target: 'skill', source: { kind: 'chaosToken', token: '-3' }, change: -3, total: 2 },
      { target: 'difficulty', source: { kind: 'baseDifficulty' }, change: 3, total: 3 },
    ]);
    expect(suggestion).toMatchObject({ skill: 2, difficulty: 3, outcome: 'fail' });
  });

  it('takes a negative modifier, e.g. a card that raises the difficulty by 2', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      modifier: -2,
    });

    expect(suggestion).toMatchObject({ skill: 2, difficulty: 3, outcome: 'fail' });
  });

  it('adds every token revealed, e.g. a bless (+2) and the token it makes the players reveal', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      tokens: ['bless', '-1'],
    });

    expect(suggestion.skill).toBe(5);
  });

  it('takes -1 for a blood token and adds the token it makes the players reveal', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      tokens: ['blood', '-1'],
    });

    expect(suggestion).toMatchObject({ skill: 2, unknownTokens: [] });
  });

  it('lists the elder sign as unknown, since its effect is the investigator ability', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      tokens: ['elderSign'],
    });

    expect(suggestion).toMatchObject({ skill: 4, unknownTokens: ['elderSign'] });
  });

  it('makes the skill 0 and the test a fail on auto-fail, as a step of the trace', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      modifier: 2,
      tokens: ['autoFail'],
    });

    expect(suggestion).toMatchObject({ skill: 0, outcome: 'fail', unknownTokens: [] });
    expect(suggestion.trace).toContainEqual({
      target: 'skill',
      source: { kind: 'autoFail' },
      change: -6,
      total: 0,
    });
  });

  it.each<{ name: string; input: SkillTestInput; outcome: 'pass' | 'fail'; margin: number }>([
    { name: 'a pass at intellect 4 against 3', input: {}, outcome: 'pass', margin: 1 },
    {
      name: 'a pass exactly at the difficulty',
      input: { modifier: -1 },
      outcome: 'pass',
      margin: 0,
    },
    {
      name: 'a fail at intellect 1 against 3',
      input: { modifier: -3 },
      outcome: 'fail',
      margin: 2,
    },
    {
      name: 'an auto-fail, by the whole difficulty',
      input: { modifier: 2, tokens: ['autoFail'] },
      outcome: 'fail',
      margin: 3,
    },
  ])('suggests the margin of $name', ({ input, outcome, margin }) => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, input);

    expect(suggestion).toMatchObject({ outcome, margin });
  });

  it('never lowers the skill below 0, as a step of the trace', () => {
    const suggestion = skillTestSuggestion(context, state, investigateStudy, {
      tokens: ['-8'],
    });

    expect(suggestion.skill).toBe(0);
    expect(suggestion.trace).toContainEqual({
      target: 'skill',
      source: { kind: 'minimumZero' },
      change: 4,
      total: 0,
    });
  });

  it('rejects a modifier that is not a whole number', () => {
    expect(() => skillTestSuggestion(context, state, investigateStudy, { modifier: 1.5 })).toThrow(
      CommandRejected,
    );
  });
});

describe('revealsAnotherToken', () => {
  it.each([
    { token: 'bless', reveals: true },
    { token: 'curse', reveals: true },
    { token: 'frost', reveals: true },
    { token: 'blood', reveals: true },
    { token: '-2', reveals: false },
    { token: 'skull', reveals: false },
    { token: 'autoFail', reveals: false },
  ] as const)('$token makes the tester reveal another: $reveals', ({ token, reveals }) => {
    expect(revealsAnotherToken(token)).toBe(reveals);
  });
});

describe('skillTestSuggestion: scenario reference card', () => {
  /** Cultist -1 and a skull without number on Easy/Standard; skull -2 and cultist without number on Hard/Expert. */
  const reference: ScenarioReference = {
    easyStandard: {
      skull: { effectKey: 'test.skull.easyStandard' },
      cultist: { modifier: -1, effectKey: 'test.cultist.easyStandard' },
    },
    hardExpert: {
      skull: { modifier: -2, effectKey: 'test.skull.hardExpert' },
      cultist: { effectKey: 'test.cultist.hardExpert' },
    },
  };
  const withReference = aliceInStudy.withReferenceCard(reference).context();

  it('takes a symbol token modifier from the side for the difficulty, with its effect text', () => {
    const suggestion = skillTestSuggestion(
      withReference,
      aliceInStudy.withDifficulty('easy').start().state,
      investigateStudy,
      { tokens: ['cultist'] },
    );

    expect(suggestion.skill).toBe(3);
    expect(suggestion.trace).toContainEqual({
      target: 'skill',
      source: { kind: 'chaosToken', token: 'cultist', effectKey: 'test.cultist.easyStandard' },
      change: -1,
      total: 3,
    });
  });

  it('reads the Hard/Expert side on hard', () => {
    const suggestion = skillTestSuggestion(
      withReference,
      aliceInStudy.withDifficulty('hard').start().state,
      investigateStudy,
      { tokens: ['skull'] },
    );

    expect(suggestion.skill).toBe(2);
  });

  it('lists a symbol whose effect has no number, or that the card does not use, as unknown', () => {
    const suggestion = skillTestSuggestion(
      withReference,
      aliceInStudy.withDifficulty('hard').start().state,
      investigateStudy,
      { tokens: ['cultist', 'tablet'] },
    );

    expect(suggestion).toMatchObject({ skill: 4, unknownTokens: ['cultist', 'tablet'] });
  });

  it('asks the scenario for the value of a symbol without a printed number ("-X")', () => {
    const minusTwo = aliceInStudy
      .withReferenceCard(reference)
      .withSkillModifiers({ tokenValues: { skull: () => -2, cultist: () => -5 } })
      .context();

    const suggestion = skillTestSuggestion(minusTwo, aliceInStudy.start().state, investigateStudy, {
      tokens: ['skull', 'cultist'],
    });

    // The skull has no number on Easy/Standard (-2 from the scenario); the cultist's printed -1 wins over -5.
    expect(suggestion.skill).toBe(1);
  });
});

describe('suggestions on skill test decisions', () => {
  const { context, state } = aliceInStudy.start();

  it('raises Investigate with the suggestion before icons and tokens', () => {
    const asked = stateAfter(context, state, { type: 'Investigate', investigatorId: alice });

    expect(asked.pending[0]?.suggestion).toMatchObject({
      skill: 4,
      difficulty: 3,
      outcome: 'pass',
    });
  });

  it("raises Fight with the enemy's fight value as the difficulty", () => {
    const withGhoul = aliceInStudy.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const asked = stateAfter(withGhoul.context, withGhoul.state, {
      type: 'Fight',
      investigatorId: alice,
      enemyId: ghoul,
    });

    expect(asked.pending[0]?.suggestion).toMatchObject({
      skill: 3,
      difficulty: 4,
      outcome: 'fail',
    });
  });

  it('attaches the suggestion to a card test raised with RequestDecision', () => {
    const test = skillTestDecision(
      {
        id: decisionId('card:dread'),
        prompt: 'card.dread',
        decider: { kind: 'investigator', investigatorId: alice },
        test: { skill: 'willpower', difficulty: 3 },
      },
      { onPass: [], onFail: [] },
    );

    const asked = stateAfter(context, state, { type: 'RequestDecision', decision: test });

    expect(asked.pending[0]?.suggestion).toMatchObject({
      skill: 2,
      difficulty: 3,
      outcome: 'fail',
    });
  });

  it('suggests nothing for a test the group decides, since nobody’s skill is known', () => {
    const test = skillTestDecision(
      {
        id: decisionId('card:group'),
        prompt: 'card.group',
        decider: { kind: 'group' },
        test: { skill: 'willpower', difficulty: 3 },
      },
      { onPass: [], onFail: [] },
    );

    const asked = stateAfter(context, state, { type: 'RequestDecision', decision: test });

    expect(asked.pending[0]?.suggestion).toBeUndefined();
  });

  it('recomputes the suggestion of a pending decision with what the players entered', () => {
    const asked = stateAfter(context, state, { type: 'Investigate', investigatorId: alice });

    const suggestion = suggestSkillTest(context, asked, asked.pending[0]!, {
      modifier: 1,
      tokens: ['-2'],
    });

    expect(suggestion).toMatchObject({ skill: 3, difficulty: 3, outcome: 'pass' });
  });

  it('follows the players changing their modifier after the reveal, e.g. "when you would fail: +2"', () => {
    const asked = stateAfter(context, state, { type: 'Investigate', investigatorId: alice });
    const decision = asked.pending[0]!;

    const beforeReveal = suggestSkillTest(context, asked, decision, { modifier: 1 });
    const revealed = suggestSkillTest(context, asked, decision, { modifier: 1, tokens: ['-4'] });
    const raised = suggestSkillTest(context, asked, decision, { modifier: 3, tokens: ['-4'] });

    expect([beforeReveal?.outcome, revealed?.outcome, raised?.outcome]).toEqual([
      'pass',
      'fail',
      'pass',
    ]);
  });
});
