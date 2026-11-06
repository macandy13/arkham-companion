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
