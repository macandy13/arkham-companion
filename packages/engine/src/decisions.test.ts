import { beforeEach, describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  checkInvariants,
  decisionId,
  execute,
  handle,
  instanceId,
  investigatorId,
  newGame,
  skillTestDecision,
  type Command,
  type Decider,
  type Decision,
  type GameState,
  type InvestigatorId,
  type Zone,
} from './index';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellarNorth = instanceId('cellar_north');
const cellarSouth = instanceId('cellar_south');
const ghoul = instanceId('ghoul');

/** Both cellars are this card, so a spawn at "Cellar" has two equally named locations to choose from. */
const cellarCard = blankLocation('cellar', { name: 'Cellar' });
const plainGhoul = blankEnemy('plain_ghoul');
/** A ghoul that spawns at a location named "Cellar". */
const cellarSpawnGhoul = blankEnemy('cellar_spawn_ghoul', {
  keywords: [{ name: 'spawn', detail: 'Cellar' }],
});

/** The hall with a cellar to its north and one to its south, all unrevealed. */
const hallAndCellars = newGame()
  .withLocation(hall, blankLocation('hall'))
  .withLocation(cellarNorth, cellarCard)
  .withLocation(cellarSouth, cellarCard)
  .withConnection(hall, cellarNorth)
  .withConnection(hall, cellarSouth);
const hallWithAlice = hallAndCellars.withInvestigator(alice, { locationId: hall });
const hallWithAliceAndBob = hallWithAlice.withInvestigator(bob, { locationId: hall });

const setAside: Zone = { kind: 'setAside' };

const gainResource: Command = {
  type: 'AdjustInvestigator',
  investigatorId: alice,
  stat: 'resources',
  delta: 1,
};
const gainHorror = (delta: number): Command => ({
  type: 'AdjustInvestigator',
  investigatorId: alice,
  stat: 'horror',
  delta,
});

describe('engagement choice', () => {
  const ghoulInHallWithAliceAndBob = hallWithAliceAndBob.withCard(
    ghoul,
    plainGhoul,
    atLocation(hall),
  );

  it('asks the lead investigator which investigator the enemy engages', () => {
    const { state } = ghoulInHallWithAliceAndBob.start();

    expect(state.pending).toMatchObject([
      {
        id: 'engage:ghoul',
        kind: 'chooseInvestigator',
        decider: { kind: 'lead' },
        options: [{ id: alice }, { id: bob }],
      },
    ]);
  });

  it('engages the investigator the players chose and clears the question', () => {
    const { context, state: asked } = ghoulInHallWithAliceAndBob.start();

    const after = stateAfter(context, asked, answer('engage:ghoul', alice));

    expect(after.cards[ghoul]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
    expect(after.pending).toEqual([]);
  });
});

describe('spawn choice', () => {
  const aliceInSouthCellar = hallAndCellars
    .withInvestigator(alice, { locationId: cellarSouth })
    .withCard(ghoul, cellarSpawnGhoul, setAside);

  it('asks the lead investigator which of two equally named locations the enemy spawns at', () => {
    const { context, state } = aliceInSouthCellar.start();

    const asked = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul });

    expect(asked.pending).toMatchObject([
      {
        id: 'spawn:ghoul',
        kind: 'chooseLocation',
        subject: ghoul,
        decider: { kind: 'lead' },
        options: [{ id: cellarNorth }, { id: cellarSouth }],
      },
    ]);
  });

  it('spawns the enemy at the chosen location and engages the investigator there', () => {
    const { context, state } = aliceInSouthCellar.start();
    const asked = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul });

    const after = stateAfter(context, asked, answer('spawn:ghoul', cellarSouth));

    expect(after.cards[ghoul]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
    expect(after.pending).toEqual([]);
  });
});

describe('pending decisions', () => {
  const { context, state: aliceInHall } = hallWithAlice.start();
  const pickReward: Decision = {
    id: decisionId('pick_reward'),
    kind: 'chooseOption',
    prompt: 'decision.pickReward',
    decider: { kind: 'group' },
    options: [
      { id: 'gain_resource', label: 'Gain a resource', commands: [gainResource] },
      { id: 'nothing', label: 'Nothing', commands: [] },
    ],
  };
  let asked: GameState;
  beforeEach(() => {
    asked = stateAfter(context, aliceInHall, {
      type: 'RequestDecision',
      decision: pickReward,
    });
  });

  it('rejects other commands', () => {
    const rejection = rejectionFrom(context, asked, { type: 'PlaceDoom', cardId: hall, amount: 1 });

    expect(rejection).toEqual({ code: 'decisionPending', decisionId: 'pick_reward' });
  });

  it('allows manual adjustments', () => {
    const after = stateAfter(context, asked, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: hall, token: 'clue', delta: 1 },
    });

    expect(after.cards[hall]?.tokens.clue).toBe(1);
    expect(after.pending).toHaveLength(1);
  });

  it('runs the commands of the chosen option and clears the decision in one event list', () => {
    const { state, events } = execute(context, asked, answer('pick_reward', 'gain_resource'));

    expect(events.map((e) => e.type)).toEqual(['DecisionResolved', 'InvestigatorChanged']);
    expect(state.investigators[0]?.resources).toBe(6);
    expect(state.pending).toEqual([]);
  });

  it('runs nothing for an option without commands', () => {
    const { events } = execute(context, asked, answer('pick_reward', 'nothing'));

    expect(events.map((e) => e.type)).toEqual(['DecisionResolved']);
  });

  it('rejects an unknown decision', () => {
    const rejection = rejectionFrom(context, asked, answer('no_such_decision', 'nothing'));

    expect(rejection).toEqual({ code: 'unknownDecision', decisionId: 'no_such_decision' });
  });

  it('rejects an unknown option', () => {
    const rejection = rejectionFrom(context, asked, answer('pick_reward', 'no_such_option'));

    expect(rejection).toEqual({
      code: 'unknownOption',
      decisionId: 'pick_reward',
      optionId: 'no_such_option',
    });
  });

  it('keeps the decision when a consequence is rejected', () => {
    const overspend: Command = { ...gainResource, delta: -6 };
    const state = stateAfter(context, aliceInHall, {
      type: 'RequestDecision',
      decision: {
        ...pickReward,
        id: decisionId('overspend'),
        options: [{ id: 'spend_six', label: 'Spend 6 resources', commands: [overspend] }],
      },
    });

    const rejection = rejectionFrom(context, state, answer('overspend', 'spend_six'));

    expect(rejection).toMatchObject({
      code: 'triggeredCommandRejected',
      command: 'AdjustInvestigator',
    });
    expect(state.pending.map((decision) => decision.id)).toEqual(['overspend']);
  });

  it('rejects a decision requested from outside while another is pending', () => {
    const rejection = rejectionFrom(context, asked, {
      type: 'RequestDecision',
      decision: pickReward,
    });

    expect(rejection).toEqual({ code: 'decisionPending', decisionId: 'pick_reward' });
  });

  it.each([
    { name: 'no options', options: [] },
    {
      name: 'a repeated option id',
      options: [
        { id: 'same', label: 'One', commands: [] },
        { id: 'same', label: 'Two', commands: [] },
      ],
    },
  ])('rejects a decision with $name', ({ options }) => {
    const rejection = rejectionFrom(context, aliceInHall, {
      type: 'RequestDecision',
      decision: { ...pickReward, options },
    });

    expect(rejection).toEqual({ code: 'invalidDecisionOptions', decisionId: 'pick_reward' });
  });
});

describe('skill test result', () => {
  const { context, state: aliceInHall } = hallWithAlice.start();
  const test = { skill: 'intellect', difficulty: 3 } as const;
  const decision = skillTestDecision(
    {
      id: decisionId('investigate_hall'),
      prompt: 'decision.skillTest',
      decider: { kind: 'lead' },
      test,
    },
    {
      onPass: [{ type: 'DiscoverClues', investigatorId: alice, locationId: hall, amount: 1 }],
      onFail: [gainHorror(1)],
      failedBy: { 2: [gainHorror(2)] },
    },
  );
  let asked: GameState;
  beforeEach(() => {
    const hallWithTwoClues = stateAfter(context, aliceInHall, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: hall, token: 'clue', delta: 2 },
    });
    asked = stateAfter(context, hallWithTwoClues, { type: 'RequestDecision', decision });
  });

  it('describes the test to resolve', () => {
    expect(asked.pending).toMatchObject([{ kind: 'skillTestResult', skillTest: test }]);
  });

  it('discovers a clue when the test is passed', () => {
    const after = stateAfter(context, asked, answer('investigate_hall', 'pass'));

    expect(after.investigators[0]?.clues).toBe(1);
    expect(after.cards[hall]?.tokens.clue).toBe(1);
  });

  it('adds one horror when the test is failed', () => {
    const after = stateAfter(context, asked, answer('investigate_hall', 'fail'));

    expect(after.investigators[0]?.sanity.horror).toBe(1);
    expect(after.investigators[0]?.clues).toBe(0);
  });

  it('adds two horror when the test is failed by 2', () => {
    const after = stateAfter(context, asked, answer('investigate_hall', 'failedBy:2'));

    expect(after.investigators[0]?.sanity.horror).toBe(2);
  });
});

describe('skill test outcome record', () => {
  const { context, state: aliceInHall } = hallWithAlice.start();
  const test = { skill: 'intellect', difficulty: 3 } as const;
  const decision = skillTestDecision(
    {
      id: decisionId('investigate_hall'),
      prompt: 'decision.skillTest',
      subject: hall,
      decider: { kind: 'investigator', investigatorId: alice },
      test,
    },
    {
      onPass: [{ type: 'DiscoverClues', investigatorId: alice, locationId: hall, amount: 1 }],
      onFail: [gainHorror(1)],
      failedBy: { 2: [gainHorror(2)] },
    },
  );
  let asked: GameState;
  beforeEach(() => {
    const hallWithTwoClues = stateAfter(context, aliceInHall, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: hall, token: 'clue', delta: 2 },
    });
    asked = stateAfter(context, hallWithTwoClues, { type: 'RequestDecision', decision });
  });

  it.each([
    {
      option: 'pass',
      recorded: {
        type: 'SkillTestResolved',
        decisionId: 'investigate_hall',
        investigatorId: alice,
        subject: hall,
        skillTest: test,
        outcome: 'pass',
      },
    },
    {
      option: 'fail',
      recorded: {
        type: 'SkillTestResolved',
        decisionId: 'investigate_hall',
        investigatorId: alice,
        subject: hall,
        skillTest: test,
        outcome: 'fail',
      },
    },
    {
      option: 'failedBy:2',
      recorded: {
        type: 'SkillTestResolved',
        decisionId: 'investigate_hall',
        investigatorId: alice,
        subject: hall,
        skillTest: test,
        outcome: 'fail',
        failedBy: 2,
      },
    },
  ])('records "$option" right after the answer', ({ option, recorded }) => {
    const events = handle(context, asked, answer('investigate_hall', option));

    expect(events.slice(0, 2)).toEqual([
      { type: 'DecisionResolved', decisionId: 'investigate_hall', optionId: option },
      recorded,
    ]);
  });

  it('records no investigator or subject for a test the lead answers about no card', () => {
    const leadTest = skillTestDecision(
      {
        id: decisionId('lead_test'),
        prompt: 'decision.skillTest',
        decider: { kind: 'lead' },
        test,
      },
      { onPass: [], onFail: [] },
    );
    const leadAsked = stateAfter(context, aliceInHall, {
      type: 'RequestDecision',
      decision: leadTest,
    });

    expect(handle(context, leadAsked, answer('lead_test', 'pass'))).toEqual([
      { type: 'DecisionResolved', decisionId: 'lead_test', optionId: 'pass' },
      { type: 'SkillTestResolved', decisionId: 'lead_test', skillTest: test, outcome: 'pass' },
    ]);
  });

  it('records the clues the pass discovers', () => {
    const events = handle(context, asked, answer('investigate_hall', 'pass'));

    expect(events).toContainEqual({
      type: 'CluesDiscovered',
      investigatorId: alice,
      locationId: hall,
      amount: 1,
    });
  });

  it('records nothing for a decision that is not a skill test', () => {
    const question: Decision = {
      id: decisionId('open_the_door'),
      kind: 'confirm',
      prompt: 'decision.confirm',
      decider: { kind: 'lead' },
      options: [{ id: 'yes', label: 'decision.yes', commands: [] }],
    };
    const events = handle(
      context,
      stateAfter(context, aliceInHall, {
        type: 'RequestDecision',
        decision: question,
      }),
      answer('open_the_door', 'yes'),
    );

    expect(events.map((event) => event.type)).toEqual(['DecisionResolved']);
  });
});

describe('decisions raised by hooks', () => {
  const { state: aliceInHall } = hallWithAlice.start();
  const offerResource: Command = {
    type: 'RequestDecision',
    decision: {
      id: decisionId('offer_resource'),
      kind: 'confirm',
      prompt: 'decision.applyForcedEffect',
      decider: { kind: 'lead' },
      options: [
        { id: 'yes', label: 'decision.yes', commands: [gainResource] },
        { id: 'no', label: 'decision.no', commands: [] },
      ],
    },
  };
  const placeDoomOnHall: Command = { type: 'PlaceDoom', cardId: hall, amount: 1 };

  it('lets a scenario hook ask the players after doom is placed', () => {
    const hooked = hallWithAlice.withHooks({ afterDoomPlaced: () => [offerResource] }).context();

    const asked = stateAfter(hooked, aliceInHall, placeDoomOnHall);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['offer_resource']);
  });

  it('rejects a hook that raises the same decision twice', () => {
    const hooked = hallWithAlice
      .withHooks({ afterDoomPlaced: () => [offerResource, offerResource] })
      .context();

    const rejection = rejectionFrom(hooked, aliceInHall, placeDoomOnHall);

    expect(rejection).toEqual({
      code: 'triggeredCommandRejected',
      command: 'RequestDecision',
      reason: { code: 'duplicateDecision', decisionId: 'offer_resource' },
    });
  });
});

describe('pending decision invariants', () => {
  const { context, state: aliceInHall } = hallWithAlice.start();
  const blocked: Command[] = [
    { type: 'PlaceDoom', cardId: hall, amount: 1 },
    { type: 'MoveHunters' },
    { type: 'DrawEncounter', investigatorId: alice },
    gainResource,
    { type: 'RevealLocation', locationId: hall },
    { type: 'AdvanceAgenda' },
  ];
  const decisions: { name: string; decision: Decision }[] = [
    {
      name: 'a confirm with one option and no commands',
      decision: {
        id: decisionId('confirm_noop'),
        kind: 'confirm',
        prompt: 'decision.confirm',
        decider: { kind: 'group' },
        options: [{ id: 'ok', label: 'OK', commands: [] }],
      },
    },
    {
      name: 'a location choice with two options',
      decision: {
        id: decisionId('choose_cellar'),
        kind: 'chooseLocation',
        prompt: 'decision.chooseCellar',
        decider: { kind: 'lead' },
        options: [
          { id: 'north', label: 'North cellar', target: cellarNorth, commands: [] },
          { id: 'south', label: 'South cellar', target: cellarSouth, commands: [] },
        ],
      },
    },
    {
      name: 'an option choice whose options change state',
      decision: {
        id: decisionId('choose_boon'),
        kind: 'chooseOption',
        prompt: 'decision.chooseBoon',
        decider: { kind: 'group' },
        options: [
          { id: 'resource', label: 'Resource', commands: [gainResource] },
          { id: 'horror', label: 'Horror', commands: [gainHorror(1)] },
        ],
      },
    },
    {
      name: 'a skill test result with consequences',
      decision: skillTestDecision(
        {
          id: decisionId('test_willpower'),
          prompt: 'decision.skillTest',
          decider: { kind: 'lead' },
          test: { skill: 'willpower', difficulty: 2 },
        },
        { onPass: [gainResource], onFail: [gainHorror(1)] },
      ),
    },
  ];

  it.each(decisions)('keeps $name pending when another command is rejected', ({ decision }) => {
    const asked = stateAfter(context, aliceInHall, {
      type: 'RequestDecision',
      decision,
    });

    const rejections = blocked.map((command) => rejectionFrom(context, asked, command).code);

    expect(rejections).toEqual(blocked.map(() => 'decisionPending'));
    expect(asked.pending).toEqual([decision]);
  });

  it.each(decisions)('clears $name whichever option resolves it', ({ decision }) => {
    const asked = stateAfter(context, aliceInHall, {
      type: 'RequestDecision',
      decision,
    });

    const results = decision.options.map((option) =>
      stateAfter(context, asked, answer(decision.id, option.id)),
    );

    expect(results.map((state) => state.pending)).toEqual(decision.options.map(() => []));
    expect(results.flatMap((state) => checkInvariants(state))).toEqual([]);
  });
});

describe('who answers', () => {
  const { context, state: aliceAndBobInHall } = hallWithAliceAndBob.start();
  /** Alice and bob in the hall, bob made the lead, then asked `decider`'s decision. */
  const askedBy = (decider: Decider, ...before: Command[]): GameState =>
    stateAfter(
      context,
      aliceAndBobInHall,
      { type: 'SetLeadInvestigator', investigatorId: bob },
      ...before,
      {
        type: 'RequestDecision',
        decision: {
          id: decisionId('pick_reward'),
          kind: 'chooseOption',
          prompt: 'decision.pickReward',
          decider,
          options: [{ id: 'gain_resource', label: 'Gain a resource', commands: [gainResource] }],
        },
      },
    );
  const answerBy = (answeredBy?: InvestigatorId): Command => ({
    ...answer('pick_reward', 'gain_resource'),
    ...(answeredBy === undefined ? {} : { answeredBy }),
  });
  const aliceDecides: Decider = { kind: 'investigator', investigatorId: alice };

  it.each<{ decider: Decider; answeredBy?: InvestigatorId }>([
    { decider: aliceDecides, answeredBy: alice },
    { decider: { kind: 'lead' }, answeredBy: bob },
    { decider: { kind: 'group' }, answeredBy: bob },
    { decider: aliceDecides, answeredBy: undefined },
  ])('accepts $answeredBy answering for $decider.kind', ({ decider, answeredBy }) => {
    expect(stateAfter(context, askedBy(decider), answerBy(answeredBy)).pending).toEqual([]);
  });

  it.each<{ decider: Decider; answeredBy: InvestigatorId }>([
    { decider: aliceDecides, answeredBy: bob },
    { decider: { kind: 'lead' }, answeredBy: alice },
    { decider: { kind: 'group' }, answeredBy: investigatorId('carol') },
  ])('rejects $answeredBy answering for $decider.kind', ({ decider, answeredBy }) => {
    expect(rejectionFrom(context, askedBy(decider), answerBy(answeredBy))).toEqual({
      code: 'notTheDecider',
      decisionId: 'pick_reward',
      answeredBy,
      decider,
    });
  });

  it('rejects a defeated investigator answering for the group', () => {
    const aliceDefeated: Command = {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'horror',
      delta: 6,
    };
    const decider: Decider = { kind: 'group' };

    expect(rejectionFrom(context, askedBy(decider, aliceDefeated), answerBy(alice))).toEqual({
      code: 'notTheDecider',
      decisionId: 'pick_reward',
      answeredBy: alice,
      decider,
    });
  });
});
