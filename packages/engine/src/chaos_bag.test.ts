import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  execute,
  removeChaosToken,
  whenRevealed,
  instanceId,
  investigatorId,
  newGame,
  type ChaosBagChange,
  type ChaosBagChangeLasts,
  type ChaosToken,
  type Command,
  type SealedToken,
  type TokenCount,
  tokenCounts,
} from './index';
import { stateAfter } from '../test/utils';

const study = instanceId('study');
const alice = investigatorId('alice');

/** Alice in the study, with a bag of a skull, a -1 and an auto-fail. */
const table = newGame()
  .withLocation(study, blankLocation('study'), { revealed: true })
  .withInvestigator(alice, { locationId: study })
  .withChaosBag(['skull', '-1', 'autoFail']);

describe('ChangeChaosBag', () => {
  it.each<[string, Command, readonly ChaosToken[]]>([
    [
      'adds a token to the bag',
      { type: 'ChangeChaosBag', token: 'cultist', change: 'add', lasts: 'scenario' },
      ['skull', '-1', 'autoFail', 'cultist'],
    ],
    [
      'removes one copy of a token from the bag',
      { type: 'ChangeChaosBag', token: '-1', change: 'remove', lasts: 'scenario' },
      ['skull', 'autoFail'],
    ],
  ])('%s', (_, command, bag) => {
    const { context, state } = table.start();

    expect(stateAfter(context, state, command).chaosBag).toEqual(bag);
  });

  it.each<[string, ChaosBagChangeLasts, readonly ChaosBagChange[]]>([
    ['forgets a change for the scenario at its end', 'scenario', []],
    [
      'keeps a change for the campaign, for the resolution to write',
      'campaign',
      [
        { token: 'elderThing', change: 'add' },
        { token: 'skull', change: 'remove' },
      ],
    ],
  ])('%s', (_, lasts, kept) => {
    const { context, state } = table.start();

    const changed = stateAfter(
      context,
      state,
      { type: 'ChangeChaosBag', token: 'elderThing', change: 'add', lasts },
      { type: 'ChangeChaosBag', token: 'skull', change: 'remove', lasts },
    );

    expect(changed.chaosBagChanges).toEqual(kept);
  });

  it('changes nothing when removing a token the bag does not hold', () => {
    const { context, state } = table.start();

    const changed = stateAfter(context, state, {
      type: 'ChangeChaosBag',
      token: 'tablet',
      change: 'remove',
      lasts: 'campaign',
    });

    expect([changed.chaosBag, changed.chaosBagChanges]).toEqual([['skull', '-1', 'autoFail'], []]);
  });

  it("takes out the skull a card's reveal removes", () => {
    const cellar = instanceId('cellar');
    const { context, state } = table
      .withLocation(
        cellar,
        blankLocation('skull_cellar', {
          abilities: [whenRevealed(removeChaosToken('skull', 'scenario'))],
        }),
      )
      .withConnection(study, cellar)
      .start();

    const moved = execute(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
    });

    expect(moved.state.chaosBag).toEqual(['-1', 'autoFail']);
  });
});

describe('SealChaosToken and ReleaseChaosToken', () => {
  it.each<[string, Command[], readonly ChaosToken[], readonly SealedToken[]]>([
    [
      'seals one copy of a token out of the bag on Alice',
      [{ type: 'SealChaosToken', token: '-1', investigatorId: alice }],
      ['skull', 'autoFail'],
      [{ token: '-1', investigatorId: alice }],
    ],
    [
      'seals nothing when the bag holds no such token',
      [{ type: 'SealChaosToken', token: 'elderSign', investigatorId: alice }],
      ['skull', '-1', 'autoFail'],
      [],
    ],
    [
      'releases the sealed token back into the bag',
      [
        { type: 'SealChaosToken', token: 'skull', investigatorId: alice },
        { type: 'ReleaseChaosToken', token: 'skull', investigatorId: alice },
      ],
      ['-1', 'autoFail', 'skull'],
      [],
    ],
    [
      'releases nothing when no such token is sealed on Alice',
      [{ type: 'ReleaseChaosToken', token: 'skull', investigatorId: alice }],
      ['skull', '-1', 'autoFail'],
      [],
    ],
  ])('%s', (_, commands, bag, sealed) => {
    const { context, state } = table.start();

    const after = stateAfter(context, state, ...commands);

    expect([after.chaosBag, after.sealedTokens]).toEqual([bag, sealed]);
  });

  it('releases the tokens sealed on Alice when she leaves the scenario', () => {
    const bob = investigatorId('bob');
    const { context, state } = table.withInvestigator(bob, { locationId: study }).start();

    const after = stateAfter(
      context,
      state,
      { type: 'SealChaosToken', token: 'skull', investigatorId: alice },
      { type: 'SealChaosToken', token: '-1', investigatorId: bob },
      { type: 'DefeatInvestigator', investigatorId: alice },
    );

    expect([after.chaosBag, after.sealedTokens]).toEqual([
      ['autoFail', 'skull'],
      [{ token: '-1', investigatorId: bob }],
    ]);
  });
});

describe('tokenCounts', () => {
  it.each<[string, ChaosToken[], TokenCount[]]>([
    ['an empty bag', [], []],
    [
      'each kind once, in the game order rather than the bag order',
      ['skull', '-1', '0', '-1', 'autoFail'],
      [
        { token: '0', count: 1 },
        { token: '-1', count: 2 },
        { token: 'skull', count: 1 },
        { token: 'autoFail', count: 1 },
      ],
    ],
  ])('counts %s', (_, bag, counts) => {
    expect(tokenCounts(bag)).toEqual(counts);
  });
});
