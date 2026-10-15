import { describe, expect, it } from 'vitest';
import {
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
  cards: [{ id: rats, code: 'rat', zone: { kind: 'setAside' } }],
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
