import type { MapEnemyView } from '@arkham/engine';

/**
 * The health `enemy` has left: its health for the game's player count less the damage on it;
 * `undefined` for an enemy whose health the card data does not give.
 */
export function healthLeft(enemy: MapEnemyView): number | undefined {
  return enemy.health === undefined ? undefined : enemy.health - (enemy.damage ?? 0);
}
