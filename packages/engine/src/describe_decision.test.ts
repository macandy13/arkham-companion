import { describe, expect, it } from 'vitest';
import {
  cardCode,
  confirmOptions,
  decisionId,
  describeDecision,
  instanceId,
  optionNamed,
  type Decision,
} from './index';
import { contextWith, makeCard, startBoard } from '../test/utils';

const ctx = contextWith(makeCard({ code: 'rat', name: 'Swarm of Rats', typeCode: 'enemy' }));
const rats = instanceId('rats');
const state = startBoard(ctx, {
  maps: {},
  investigators: [],
  cards: [{ id: rats, code: cardCode('rat'), zone: { kind: 'setAside' } }],
});

const engage: Decision = {
  id: decisionId('engage:rats'),
  kind: 'chooseInvestigator',
  subject: rats,
  prompt: 'decision.chooseEngagement',
  decider: { kind: 'lead' },
  options: [
    { id: 'roland', label: 'Roland Banks', commands: [] },
    { id: 'daisy', label: 'Daisy Walker', commands: [] },
  ],
};

describe('describeDecision', () => {
  it('asks the question about the subject and lists the options by name', () => {
    expect(describeDecision(ctx, state, engage)).toEqual(
      'Whom does Swarm of Rats engage? Roland Banks / Daisy Walker [chooseInvestigator]',
    );
  });

  it('words the answers of a confirm decision', () => {
    const advance: Decision = {
      ...engage,
      kind: 'confirm',
      prompt: 'decision.advanceAgenda',
      options: confirmOptions([], rats),
    };

    expect(describeDecision(ctx, state, advance)).toEqual(
      'Advance agenda Swarm of Rats yes / no [confirm]',
    );
  });

  it('words a failed-by margin with its number', () => {
    const test: Decision = {
      ...engage,
      prompt: 'decision.skillTest',
      options: [{ id: 'failedBy:2', label: 'decision.failedBy', commands: [] }],
    };

    expect(describeDecision(ctx, state, test)).toEqual(
      'decision.skillTest failed by 2 [chooseInvestigator]',
    );
  });

  it('names the test of a skill test and the adjustable count of an option', () => {
    const fight: Decision = {
      ...engage,
      kind: 'skillTestResult',
      prompt: 'decision.fight',
      skillTest: { skill: 'combat', difficulty: 1 },
      options: [
        { id: 'pass', label: 'decision.pass', amount: { default: 1, min: 1 }, commands: [] },
        { id: 'fail', label: 'decision.fail', commands: [] },
      ],
    };

    expect(describeDecision(ctx, state, fight)).toEqual(
      'Fight Swarm of Rats: combat (1) pass ×1 (1+) / fail [skillTestResult]',
    );
  });

  it('names the upper bound of an adjustable count', () => {
    const investigate: Decision = {
      ...engage,
      kind: 'skillTestResult',
      prompt: 'decision.investigate',
      options: [
        {
          id: 'pass',
          label: 'decision.pass',
          amount: { default: 1, min: 1, max: 3 },
          commands: [],
        },
      ],
    };

    expect(describeDecision(ctx, state, investigate)).toEqual(
      'Investigate Swarm of Rats: pass ×1 (1–3) [skillTestResult]',
    );
  });

  it('names each named count of an attack of opportunity', () => {
    const attack: Decision = {
      ...engage,
      kind: 'confirm',
      prompt: 'decision.attackOfOpportunity',
      options: [
        {
          id: 'attack',
          label: 'decision.attack',
          amounts: { damage: { default: 1, min: 0 }, horror: { default: 0, min: 0 } },
          commands: [],
        },
        { id: 'skip', label: 'decision.doesNotProvoke', commands: [] },
      ],
    };

    expect(describeDecision(ctx, state, attack)).toEqual(
      'Attack of opportunity by Swarm of Rats: attack damage ×1 (0+) horror ×0 (0+) / does not provoke [confirm]',
    );
  });

  it.each([
    { prompt: 'decision.retaliate', question: 'Swarm of Rats retaliates:' },
    { prompt: 'decision.alert', question: 'Swarm of Rats attacks after the failed evasion:' },
  ])('words the keyword attack $prompt', ({ prompt, question }) => {
    const attack: Decision = {
      ...engage,
      kind: 'confirm',
      prompt,
      options: [{ id: 'skip', label: 'decision.attackCancelled', commands: [] }],
    };

    expect(describeDecision(ctx, state, attack)).toEqual(`${question} attack cancelled [confirm]`);
  });

  it('shows the key of a prompt without a sentence', () => {
    const custom: Decision = { ...engage, subject: undefined, prompt: 'decision.chooseCellar' };

    expect(describeDecision(ctx, state, custom)).toMatch(/^decision\.chooseCellar /);
  });
});

describe('optionNamed', () => {
  it('finds an option by its readable name', () => {
    expect(optionNamed(engage, 'Daisy Walker')?.id).toEqual('daisy');
  });

  it('does not accept the id', () => {
    expect(optionNamed(engage, 'daisy')).toBeUndefined();
  });
});
