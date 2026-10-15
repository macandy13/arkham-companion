// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chosenScenario,
  clearChoices,
  defaultChoices,
  loadChoices,
  parseMode,
  parseStep,
  saveChoices,
} from './wizardState';

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('parseMode and parseStep', () => {
  it('accepts the two entry points only', () => {
    expect(parseMode('campaign')).toBe('campaign');
    expect(parseMode('quick')).toBe('quick');
    expect(parseMode('other')).toBeUndefined();
    expect(parseMode(null)).toBeUndefined();
  });

  it('falls back to the first step for unknown values', () => {
    expect(parseStep('summary')).toBe('summary');
    expect(parseStep('nonsense')).toBe('setup');
    expect(parseStep(null)).toBe('setup');
  });
});

describe('chosenScenario', () => {
  it('starts the chosen scenario in a quick game', () => {
    const choices = { ...defaultChoices('quick'), targetId: 'the-gathering' };

    expect(chosenScenario(choices)?.id).toBe('the-gathering');
  });

  it("starts a campaign's first scenario", () => {
    const choices = { ...defaultChoices('campaign'), targetId: 'night-of-the-zealot' };

    expect(chosenScenario(choices)?.id).toBe('the-gathering');
  });

  it('is undefined for unknown ids', () => {
    expect(chosenScenario({ ...defaultChoices('quick'), targetId: 'nope' })).toBeUndefined();
    expect(chosenScenario({ ...defaultChoices('campaign'), targetId: 'nope' })).toBeUndefined();
  });
});

describe('saved choices', () => {
  it('restores what was saved for the same mode', () => {
    const choices = { ...defaultChoices('quick'), difficulty: 'hard' as const, seats: ['a', 'b'] };
    saveChoices(choices);

    expect(loadChoices('quick')).toEqual(choices);
  });

  it('starts fresh for the other mode', () => {
    saveChoices({ ...defaultChoices('quick'), seats: ['a'] });

    expect(loadChoices('campaign')).toEqual(defaultChoices('campaign'));
  });

  it('starts fresh after clearChoices', () => {
    saveChoices({ ...defaultChoices('quick'), seats: ['a'] });
    clearChoices();

    expect(loadChoices('quick')).toEqual(defaultChoices('quick'));
  });

  it.each([
    'not json',
    '{"mode":"quick"}',
    '{"mode":"quick","targetId":"x","difficulty":"easy","seats":[1]}',
    '5',
  ])('ignores unusable stored value %s', (stored) => {
    sessionStorage.setItem('arkham.newGameWizard', stored);

    expect(loadChoices('quick')).toEqual(defaultChoices('quick'));
  });

  it('works without usable storage', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked');
      });
    }

    saveChoices(defaultChoices('quick'));
    clearChoices();

    expect(loadChoices('quick')).toEqual(defaultChoices('quick'));
  });
});
