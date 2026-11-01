import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { healthLeft } from './enemyHealth';

describe('healthLeft', () => {
  const study = instanceId('study');
  const alder = investigatorId('alder');

  it.each([
    { enemy: 'without a health', stats: { health: undefined }, damage: 0, left: undefined },
    { enemy: 'undamaged', stats: { health: fixed(3) }, damage: 0, left: 3 },
    { enemy: 'with 1 damage', stats: { health: fixed(3) }, damage: 1, left: 2 },
  ])('leaves $left health for an enemy $enemy', ({ stats, damage, left }) => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, { locationId: study })
        .withCard(instanceId('ghoul'), blankEnemy('ghoul', stats), engagedWith(alder), {
          tokens: { damage },
        }),
    );
    const [ghoul] = table.board.enemiesEngagedWith(alder);
    if (!ghoul) throw new Error('the ghoul is engaged with alder');

    expect(healthLeft(ghoul)).toBe(left);
  });
});
