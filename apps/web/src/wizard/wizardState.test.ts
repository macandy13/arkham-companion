// @vitest-environment jsdom
import { toCardCode } from '@arkham/carddata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chosenScenario,
  clearChoices,
  defaultChoices,
  loadChoices,
  offeredTargets,
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
    expect(parseStep('nonsense')).toBe('scenario');
    expect(parseStep(null)).toBe('scenario');
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

describe('offeredTargets', () => {
  const ids = (mode: 'campaign' | 'quick', owned?: string[]) =>
    offeredTargets(mode, owned && new Set(owned)).map((target) => target.entry.id);

  it.each([
    {
      owned: undefined,
      scenarios: ['the-gathering', 'the-midnight-masks', 'the-devourer-below', 'spreading-flames'],
    },
    {
      owned: ['rcore'],
      scenarios: ['the-gathering', 'the-midnight-masks', 'the-devourer-below', 'spreading-flames'],
    },
    { owned: ['dwl'], scenarios: ['spreading-flames'] },
  ])(
    'offers the scenarios of the packs $owned, a scenario outside any campaign always',
    ({ owned, scenarios }) => {
      expect(ids('quick', owned)).toEqual(scenarios);
    },
  );

  it.each([
    { owned: undefined, campaigns: ['night-of-the-zealot'] },
    { owned: ['core'], campaigns: ['night-of-the-zealot'] },
    { owned: ['dwl'], campaigns: [] },
  ])('offers the campaigns of the packs $owned', ({ owned, campaigns }) => {
    expect(ids('campaign', owned)).toEqual(campaigns);
  });
});

describe('saved choices', () => {
  it('restores what was saved for the same mode', () => {
    const choices = {
      ...defaultChoices('quick'),
      difficulty: 'hard' as const,
      seats: [toCardCode('a'), toCardCode('b')],
    };
    saveChoices(choices);

    expect(loadChoices('quick')).toEqual(choices);
  });

  it('starts fresh for the other mode', () => {
    saveChoices({ ...defaultChoices('quick'), seats: [toCardCode('a')] });

    expect(loadChoices('campaign')).toEqual(defaultChoices('campaign'));
  });

  it('starts fresh after clearChoices', () => {
    saveChoices({ ...defaultChoices('quick'), seats: [toCardCode('a')] });
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

  it('works without usable storage, warning for each failed access', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked');
      });
    }

    saveChoices(defaultChoices('quick'));
    clearChoices();

    expect(loadChoices('quick')).toEqual(defaultChoices('quick'));
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('save'), expect.any(Error));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('clear'), expect.any(Error));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('restore'), expect.any(Error));
  });
});
