import type { InstanceId } from './ids';
import type { Zone } from './zone';

/**
 * The zone an enemy enters when it spawns at the location `locationId`.
 * Every place that spawns an enemy (setup's `spawn` step now, the
 * `SpawnEnemy` command and encounter draws later) goes through this function,
 * so the spawn rule lives in one place. For now the enemy always stays
 * unengaged at the location; M1.8 extends it to engage an investigator there
 * (asking via a decision when several qualify), which is why it takes the
 * location rather than callers building the zone themselves.
 */
export function spawnZone(locationId: InstanceId): Zone {
  return { kind: 'atLocation', locationId };
}
