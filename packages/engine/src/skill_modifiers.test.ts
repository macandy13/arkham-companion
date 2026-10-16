import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  decisionId,
  instanceId,
  investigatorId,
  skillTestDecision,
  skillTestSuggestion,
  suggestSkillTest,
  trait,
  type Difficulty,
  type EngineContext,
  type GameState,
  type ScenarioReference,
  type SkillTestContext,
  type StartingCard,
} from './index';
import {
  contextWith,
  fixed,
  makeCard,
  makeInvestigator,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const study = instanceId('study');
const ghoul = instanceId('ghoul');

/** The study (shroud 3, 2 clues) and a Ghoul enemy (fight 4). */
const cards = contextWith(
  makeCard({ code: 'study', name: 'Study', typeCode: 'location', shroud: 3, clues: fixed(2) }),
  makeCard({ code: 'ghoul', name: 'Ghoul', typeCode: 'enemy', fight: 4, traits: [trait('Ghoul')] }),
);

/** Alice (willpower 2, intellect 4, combat 3, agility 1) in the study, with `extra` cards. */
function aliceInStudy({
  extra = [],
  difficulty = 'standard',
}: { extra?: StartingCard[]; difficulty?: Difficulty } = {}): GameState {
  return startBoard(cards, {
    maps: { house: { locations: { study: 'study' } } },
    investigators: [
      makeInvestigator({
        id: 'alice',
        locationId: study,
        skills: { willpower: 2, intellect: 4, combat: 3, agility: 1 },
      }),
    ],
    cards: extra,
    difficulty,
  });
}

/** Alice investigating the study: intellect 4 against shroud 3. */
const investigateStudy: SkillTestContext = {
  investigatorId: alice,
  skill: 'intellect',
  difficulty: 3,
  locationId: study,
};

describe("skillTestSuggestion: base values, the players' modifier and tokens", () => {
  it('starts from the investigator skill and the printed difficulty', () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy);

    expect(suggestion).toEqual({
      skill: 4,
      difficulty: 3,
      outcome: 'pass',
      unknownTokens: [],
      trace: [
        { target: 'skill', source: { kind: 'baseSkill' }, change: 4, total: 4 },
        { target: 'difficulty', source: { kind: 'baseDifficulty' }, change: 3, total: 3 },
      ],
    });
  });

  it("adds the players' modifier and the revealed number token to the skill", () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
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
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
      modifier: -2,
    });

    expect(suggestion).toMatchObject({ skill: 2, difficulty: 3, outcome: 'fail' });
  });

  it('adds every token revealed, e.g. a bless (+2) and the token it makes the players reveal', () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
      tokens: ['bless', '-1'],
    });

    expect(suggestion.skill).toBe(5);
  });

  it('lists the elder sign as unknown, since its effect is the investigator ability', () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
      tokens: ['elderSign'],
    });

    expect(suggestion).toMatchObject({ skill: 4, unknownTokens: ['elderSign'] });
  });

  it('makes the skill 0 and the test a fail on auto-fail, as a step of the trace', () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
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

  it('never lowers the skill below 0, as a step of the trace', () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
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
    expect(() =>
      skillTestSuggestion(cards, aliceInStudy(), investigateStudy, { modifier: 1.5 }),
    ).toThrow(CommandRejected);
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
  const withReference: EngineContext = { ...cards, reference };

  it('takes a symbol token modifier from the side for the difficulty, with its effect text', () => {
    const suggestion = skillTestSuggestion(
      withReference,
      aliceInStudy({ difficulty: 'easy' }),
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
      aliceInStudy({ difficulty: 'hard' }),
      investigateStudy,
      { tokens: ['skull'] },
    );

    expect(suggestion.skill).toBe(2);
  });

  it('lists a symbol whose effect has no number, or that the card does not use, as unknown', () => {
    const suggestion = skillTestSuggestion(
      withReference,
      aliceInStudy({ difficulty: 'hard' }),
      investigateStudy,
      { tokens: ['cultist', 'tablet'] },
    );

    expect(suggestion).toMatchObject({ skill: 4, unknownTokens: ['cultist', 'tablet'] });
  });

  it('asks the scenario for the value of a symbol without a printed number ("-X")', () => {
    const minusTwo: EngineContext = {
      ...withReference,
      modifiers: { tokenValues: { skull: () => -2, cultist: () => -5 } },
    };

    const suggestion = skillTestSuggestion(minusTwo, aliceInStudy(), investigateStudy, {
      tokens: ['skull', 'cultist'],
    });

    // The skull has no number on Easy/Standard (-2 from the scenario); the cultist's printed -1 wins over -5.
    expect(suggestion.skill).toBe(1);
  });
});

describe('suggestions on skill test decisions', () => {
  it('raises Investigate with the suggestion before icons and tokens', () => {
    const asked = stateAfter(cards, aliceInStudy(), { type: 'Investigate', investigatorId: alice });

    expect(asked.pending[0]?.suggestion).toMatchObject({
      skill: 4,
      difficulty: 3,
      outcome: 'pass',
    });
  });

  it("raises Fight with the enemy's fight value as the difficulty", () => {
    const state = aliceInStudy({
      extra: [{ id: ghoul, code: 'ghoul', zone: { kind: 'engaged', investigatorId: alice } }],
    });

    const asked = stateAfter(cards, state, {
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

    const asked = stateAfter(cards, aliceInStudy(), { type: 'RequestDecision', decision: test });

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

    const asked = stateAfter(cards, aliceInStudy(), { type: 'RequestDecision', decision: test });

    expect(asked.pending[0]?.suggestion).toBeUndefined();
  });

  it('recomputes the suggestion of a pending decision with what the players entered', () => {
    const asked = stateAfter(cards, aliceInStudy(), { type: 'Investigate', investigatorId: alice });

    const suggestion = suggestSkillTest(cards, asked, asked.pending[0]!, {
      modifier: 1,
      tokens: ['-2'],
    });

    expect(suggestion).toMatchObject({ skill: 3, difficulty: 3, outcome: 'pass' });
  });

  it('follows the players changing their modifier after the reveal, e.g. "when you would fail: +2"', () => {
    const asked = stateAfter(cards, aliceInStudy(), { type: 'Investigate', investigatorId: alice });
    const decision = asked.pending[0]!;

    const beforeReveal = suggestSkillTest(cards, asked, decision, { modifier: 1 });
    const revealed = suggestSkillTest(cards, asked, decision, { modifier: 1, tokens: ['-4'] });
    const raised = suggestSkillTest(cards, asked, decision, { modifier: 3, tokens: ['-4'] });

    expect([beforeReveal?.outcome, revealed?.outcome, raised?.outcome]).toEqual([
      'pass',
      'fail',
      'pass',
    ]);
  });
});
