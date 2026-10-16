import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  decisionId,
  instanceId,
  investigatorId,
  lastingEffectId,
  skillTestDecision,
  skillTestSuggestion,
  suggestSkillTest,
  trait,
  type Difficulty,
  type EngineContext,
  type GameState,
  type LastingEffect,
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
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

/**
 * The study (shroud 3, 2 clues) and the attic (shroud 1); a Ghoul enemy
 * (fight 4) and a treachery that sticks in a threat area.
 */
const cards = contextWith(
  makeCard({ code: 'study', name: 'Study', typeCode: 'location', shroud: 3, clues: fixed(2) }),
  makeCard({ code: 'attic', name: 'Attic', typeCode: 'location', shroud: 1 }),
  makeCard({ code: 'ghoul', name: 'Ghoul', typeCode: 'enemy', fight: 4, traits: [trait('Ghoul')] }),
  makeCard({ code: 'dread', name: 'Dread', entersThreatArea: true }),
);

/** Alice (willpower 2, intellect 4, combat 3, agility 1) in the study, with `extra` cards. */
function aliceInStudy({
  extra = [],
  difficulty = 'standard',
}: { extra?: StartingCard[]; difficulty?: Difficulty } = {}): GameState {
  return startBoard(cards, {
    maps: { house: { locations: { study: 'study', attic: 'attic' } } },
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
  action: 'investigate',
  subject: study,
  locationId: study,
};

describe('skillTestSuggestion: base values, icons and tokens', () => {
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

  it('adds the committed icons and the revealed number token to the skill', () => {
    const suggestion = skillTestSuggestion(cards, aliceInStudy(), investigateStudy, {
      committedIcons: 1,
      tokens: ['-3'],
    });

    expect(suggestion.trace).toEqual([
      { target: 'skill', source: { kind: 'baseSkill' }, change: 4, total: 4 },
      { target: 'skill', source: { kind: 'committedIcons' }, change: 1, total: 5 },
      { target: 'skill', source: { kind: 'chaosToken', token: '-3' }, change: -3, total: 2 },
      { target: 'difficulty', source: { kind: 'baseDifficulty' }, change: 3, total: 3 },
    ]);
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
      committedIcons: 2,
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

  it.each([
    { committedIcons: -1, why: 'negative' },
    { committedIcons: 1.5, why: 'a fraction' },
  ])('rejects a committed icon count that is $why', ({ committedIcons }) => {
    expect(() =>
      skillTestSuggestion(cards, aliceInStudy(), investigateStudy, { committedIcons }),
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

describe('skillTestSuggestion: lasting effects', () => {
  const effect = (overrides: Partial<LastingEffect>): LastingEffect => ({
    id: lastingEffectId('effect'),
    label: 'Effect',
    until: 'endOfRound',
    appliesTo: {},
    modifier: { target: 'skill', amount: 1 },
    ...overrides,
  });

  it('applies an effect whose filter matches the test', () => {
    const lowerShroud = effect({
      id: lastingEffectId('lantern'),
      label: 'Lantern',
      appliesTo: { action: 'investigate', locationId: study },
      modifier: { target: 'difficulty', amount: -2 },
    });
    const state = stateAfter(cards, aliceInStudy(), {
      type: 'AddLastingEffect',
      effect: lowerShroud,
    });

    const suggestion = skillTestSuggestion(cards, state, investigateStudy);

    expect(suggestion.difficulty).toBe(1);
    expect(suggestion.trace).toContainEqual({
      target: 'difficulty',
      source: { kind: 'lastingEffect', effectId: 'lantern', label: 'Lantern' },
      change: -2,
      total: 1,
    });
  });

  it.each([
    { name: 'another investigator', appliesTo: { investigatorId: investigatorId('bob') } },
    { name: 'another skill', appliesTo: { skill: 'combat' as const } },
    { name: 'another action', appliesTo: { action: 'fight' as const } },
    { name: 'another location', appliesTo: { locationId: attic } },
    { name: 'another subject', appliesTo: { subject: ghoul } },
  ])('ignores an effect for $name', ({ appliesTo }) => {
    const state = stateAfter(cards, aliceInStudy(), {
      type: 'AddLastingEffect',
      effect: effect({ appliesTo }),
    });

    expect(skillTestSuggestion(cards, state, investigateStudy).skill).toBe(4);
  });
});

describe('skillTestSuggestion: cards in play and scenario rules', () => {
  it('applies the modifiers of a card in play', () => {
    const dreadful: EngineContext = {
      ...cards,
      effects: {
        dread: { skillModifiers: () => [{ target: 'skill', amount: -1 }] },
      },
    };
    const dread = instanceId('dread');
    const state = aliceInStudy({
      extra: [{ id: dread, code: 'dread', zone: { kind: 'threatArea', investigatorId: alice } }],
    });

    const suggestion = skillTestSuggestion(dreadful, state, investigateStudy);

    expect(suggestion.trace).toContainEqual({
      target: 'skill',
      source: { kind: 'card', cardId: dread },
      change: -1,
      total: 3,
    });
  });

  it('ignores a card that is not in play', () => {
    const dreadful: EngineContext = {
      ...cards,
      effects: {
        dread: { skillModifiers: () => [{ target: 'skill', amount: -1 }] },
      },
    };
    const state = aliceInStudy({
      extra: [{ id: instanceId('dread'), code: 'dread', zone: { kind: 'encounterDeck' } }],
    });

    expect(skillTestSuggestion(dreadful, state, investigateStudy).skill).toBe(4);
  });

  it('lets a location modify only the tests taken at it', () => {
    const steepStudy: EngineContext = {
      ...cards,
      effects: {
        study: {
          skillModifiers: (_ctx, _state, test, location) =>
            test.locationId === location.id ? [{ target: 'difficulty', amount: 1 }] : [],
        },
      },
    };

    const inStudy = skillTestSuggestion(steepStudy, aliceInStudy(), investigateStudy);
    const inAttic = skillTestSuggestion(steepStudy, aliceInStudy(), {
      ...investigateStudy,
      difficulty: 1,
      subject: attic,
      locationId: attic,
    });

    expect(inStudy.difficulty).toBe(4);
    expect(inAttic.difficulty).toBe(1);
  });

  it('applies a scenario rule with its label', () => {
    const darkHouse: EngineContext = {
      ...cards,
      modifiers: {
        sources: [() => [{ target: 'skill', amount: -1, label: 'scenario.darkness' }]],
      },
    };

    const suggestion = skillTestSuggestion(darkHouse, aliceInStudy(), investigateStudy);

    expect(suggestion.trace).toContainEqual({
      target: 'skill',
      source: { kind: 'scenario', label: 'scenario.darkness' },
      change: -1,
      total: 3,
    });
  });

  it('rejects a modifier that is not a whole number, so a broken hook shows up', () => {
    const broken: EngineContext = {
      ...cards,
      modifiers: { sources: [() => [{ target: 'skill', amount: 0.5, label: 'broken' }]] },
    };

    expect(() => skillTestSuggestion(broken, aliceInStudy(), investigateStudy)).toThrow(
      CommandRejected,
    );
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

  it('names the action, so effects for one action can tell the tests apart', () => {
    const state = aliceInStudy({
      extra: [{ id: ghoul, code: 'ghoul', zone: { kind: 'engaged', investigatorId: alice } }],
    });

    const asked = stateAfter(cards, state, {
      type: 'Fight',
      investigatorId: alice,
      enemyId: ghoul,
    });

    expect(asked.pending[0]?.skillTest).toEqual({
      skill: 'combat',
      difficulty: 4,
      action: 'fight',
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
      committedIcons: 1,
      tokens: ['-2'],
    });

    expect(suggestion).toMatchObject({ skill: 3, difficulty: 3, outcome: 'pass' });
  });
});
