import { scenarioId } from '../ids';
import { describe, expect, it } from 'vitest';
import { daisyMember, makeCampaignLog, rolandMember, wendyMember } from '../../test/utils';
import {
  countAvailableXp,
  findInvestigator,
  findCurrentScenarioId,
  createEmptyLog,
  isStarted,
  findTraumaFate,
  countTrauma,
  changeTrauma,
  storyHolds,
  type CampaignInvestigator,
} from './campaign_log';

describe('campaign log queries', () => {
  const woundedRoland: CampaignInvestigator = {
    code: rolandMember.code,
    name: 'Roland Banks',
    health: 9,
    sanity: 5,
    physicalTrauma: 2,
    mentalTrauma: 1,
    xpEarned: 5,
    xpSpent: 2,
    fate: 'alive',
    earnedCards: [],
  };

  it('an empty log has not started, a started one has', () => {
    expect(isStarted(createEmptyLog())).toBe(false);
    expect(isStarted(makeCampaignLog())).toBe(true);
  });

  it('finds a current team member by code', () => {
    const log = makeCampaignLog({ investigators: [rolandMember, daisyMember] });
    const notOnTeam = wendyMember.code;
    expect(findInvestigator(log, daisyMember.code)).toBe(daisyMember);
    expect(findInvestigator(log, notOnTeam)).toBeUndefined();
  });

  it('available XP is earned minus spent', () => {
    expect(countAvailableXp(woundedRoland)).toBe(3);
  });

  it('reads and raises trauma of one kind without touching the other', () => {
    expect(countTrauma(woundedRoland, 'physical')).toBe(2);
    expect(countTrauma(woundedRoland, 'mental')).toBe(1);
    expect(changeTrauma(woundedRoland, 'physical', 3)).toMatchObject({
      physicalTrauma: 5,
      mentalTrauma: 1,
    });
    expect(changeTrauma(woundedRoland, 'mental', 3)).toMatchObject({
      physicalTrauma: 2,
      mentalTrauma: 4,
    });
  });

  it.each([
    {
      name: 'physical trauma 8 of health 9',
      trauma: { physicalTrauma: 8 },
      kind: 'physical',
      fate: undefined,
    },
    {
      name: 'physical trauma 9 of health 9',
      trauma: { physicalTrauma: 9 },
      kind: 'physical',
      fate: 'killed',
    },
    {
      name: 'mental trauma 4 of sanity 5',
      trauma: { mentalTrauma: 4 },
      kind: 'mental',
      fate: undefined,
    },
    {
      name: 'mental trauma 5 of sanity 5',
      trauma: { mentalTrauma: 5 },
      kind: 'mental',
      fate: 'insane',
    },
  ] as const)('$name leads to $fate', ({ trauma, kind, fate }) => {
    expect(findTraumaFate({ ...woundedRoland, ...trauma }, kind)).toBe(fate);
  });

  it('the current scenario is the one at the position, none once complete', () => {
    const log = makeCampaignLog({
      scenarioIds: [scenarioId('the-gathering'), scenarioId('the-midnight-masks')],
    });
    expect(findCurrentScenarioId(log)).toBe('the-gathering');
    expect(findCurrentScenarioId({ ...log, position: 2 })).toBeUndefined();
  });
});

describe('storyHolds', () => {
  const cultistsWhoGotAway = {
    kind: 'crossableList',
    entries: [
      { name: 'Wolf-Man Drew', crossedOut: false },
      { name: 'Herman Collins', crossedOut: true },
      { name: 'Peter Warren', crossedOut: false },
    ],
  } as const;

  it.each([
    ['a flag that matches', { houseStillStanding: { kind: 'flag', value: true } }, true],
    ['a flag that does not match', { houseStillStanding: { kind: 'flag', value: false } }, false],
    ['a flag never written', {}, false],
  ] as const)('answers "the house still stands" for %s', (_, story, holds) => {
    expect(storyHolds(story, { kind: 'flag', key: 'houseStillStanding', value: true })).toBe(holds);
  });

  it('reads a flag never written as false', () => {
    expect(storyHolds({}, { kind: 'flag', key: 'houseStillStanding', value: false })).toBe(true);
  });

  it.each([
    [2, true],
    [3, false],
  ])('counts only names not crossed out: at least %i is %s', (count, holds) => {
    expect(
      storyHolds(
        { cultistsWhoGotAway },
        { kind: 'atLeastNames', key: 'cultistsWhoGotAway', count },
      ),
    ).toBe(holds);
  });

  it.each([
    ['a plain list', { cultistsWhoGotAway: { kind: 'list', entries: ['Wolf-Man Drew'] } }, 1, true],
    ['a list never written', {}, 1, false],
    ['a list never written, asked for none', {}, 0, true],
  ] as const)('counts the names of %s', (_, story, count, holds) => {
    expect(storyHolds(story, { kind: 'atLeastNames', key: 'cultistsWhoGotAway', count })).toBe(
      holds,
    );
  });

  it.each([
    ['Peter Warren', true],
    ['Herman Collins', false],
    ['Ruth Turner', false],
  ])('finds %s on the list only while not crossed out: %s', (name, holds) => {
    expect(
      storyHolds({ cultistsWhoGotAway }, { kind: 'listsName', key: 'cultistsWhoGotAway', name }),
    ).toBe(holds);
  });

  it('has no answer for a record of another kind than the condition asks about', () => {
    expect(
      storyHolds(
        { cultistsWhoGotAway: { kind: 'flag', value: true } },
        { kind: 'atLeastNames', key: 'cultistsWhoGotAway', count: 1 },
      ),
    ).toBeUndefined();
  });
});
