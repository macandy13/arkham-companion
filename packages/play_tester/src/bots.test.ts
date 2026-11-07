import { describe, expect, it } from 'vitest';
import { range, sum } from '@arkham/util';
import {
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  resignAction,
} from '@arkham/engine';
import { botStep, botWeights } from './bots';
import { offeredSteps } from './random_bot';
import { BOT_KINDS, SeededRandom, type BotKind } from './run';

const alice = investigatorId('alice');
const study = instanceId('study');
const parlor = instanceId('parlor');

describe('the step a bot plays', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withInvestigator(alice, { locationId: study })
    .withTurnOf(alice);

  it.each(BOT_KINDS)('%s answers an open test by a token drawn from the bag', (bot) => {
    const table = PlayTable.start(game.withChaosBag(['+1']));
    table.investigate(alice, { result: 'open' });

    expect(botStep(bot, table, new SeededRandom(7))).toMatchObject({
      verb: 'resolveTest',
      investigator: 'alice',
      tokens: ['+1'],
    });
  });

  it.each(BOT_KINDS)('%s picks the same steps from the same seed', (bot) => {
    const table = PlayTable.start(game);
    const fivePicks = (random: SeededRandom) => range(5).map(() => botStep(bot, table, random));

    const picked = fivePicks(new SeededRandom(7));

    expect(fivePicks(new SeededRandom(7))).toEqual(picked);
  });
});

describe('how the chaos bot weighs resigning', () => {
  const table = PlayTable.start(
    newGame()
      .withLocation(parlor, blankLocation('parlor', { actions: [resignAction()] }), {
        revealed: true,
      })
      .withInvestigator(alice, { locationId: parlor })
      .withTurnOf(alice),
  );
  const offered = offeredSteps(table);
  const resign = offered.findIndex(({ verb }) => verb === 'useCardAction');

  const resignShare = (bot: BotKind) => {
    const weights = botWeights(bot, table, offered);
    return weights[resign]! / sum(weights);
  };

  it('resigns more often than the random bot', () => {
    expect(resignShare('chaos')).toBeGreaterThan(resignShare('random'));
  });
});
