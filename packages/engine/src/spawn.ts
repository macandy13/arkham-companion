import { locationsInPlay, locationsNamed, requireLocationInPlay } from './board';
import type { CardStats, EngineContext } from './cards';
import type { SpawnEnemy } from './commands';
import { chooseLocation, engageEvents } from './engagement';
import type { Event } from './events';
import { enemyOf, isOnTable } from './enemies';
import { activeInvestigator } from './investigators';
import type { InstanceId, InvestigatorId } from './ids';
import { cardMoved } from './placement';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import type { Zone } from './zone';

const ENCOUNTER_DISCARD: Zone = { kind: 'encounterDiscard' };

/**
 * The zone an enemy enters when it spawns at the location `locationId`.
 * Every place that spawns an enemy (setup's `spawn` step, `SpawnEnemy` and
 * encounter draws) goes through this module, so the spawn rule lives in one
 * place. Setup only needs the zone (engagement follows once the scenario has
 * started, see `startingEngagements`); during play `spawnEvents` adds the
 * spawn instruction, the discard and the engagement.
 */
export function spawnZone(locationId: InstanceId): Zone {
  return { kind: 'atLocation', locationId };
}

/** Where an enemy is spawned: the explicit location and the investigator who drew it. */
export interface SpawnTarget {
  at?: InstanceId;
  investigatorId?: InvestigatorId;
}

/** `SpawnEnemy`: see `spawnEvents`. */
export function handleSpawnEnemy(ctx: EngineContext, state: GameState, cmd: SpawnEnemy): Event[] {
  return spawnEvents(ctx, state, cmd.enemyId, cmd);
}

/**
 * Puts the enemy into play at its spawn location and lets it engage. Shared by
 * `SpawnEnemy` and `DrawEncounter`, so a drawn enemy follows exactly the same
 * rules as one spawned by a card effect. See `spawnPlan` for where it appears.
 *
 * Rules Reference, "Spawn": with several qualifying locations the investigator
 * chooses, with none the enemy is discarded. A choice (several matches, or
 * spawn text the engine cannot read) raises a `chooseLocation` decision (id
 * `spawn:<enemy>`) and leaves the enemy where it is; each option runs
 * `SpawnEnemy` with the chosen `at`, which then engages as usual.
 * A drawn enemy without a spawn instruction engages the drawer, whatever its
 * prey ("Spawn" in the Rules Reference); prey only picks among investigators
 * for an enemy that spawns elsewhere.
 */
export function spawnEvents(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
  target: SpawnTarget,
): Event[] {
  const { enemy, stats } = enemyOf(ctx, state, enemyId);
  if (isOnTable(enemy)) throw new CommandRejected({ code: 'enemyAlreadyInPlay', cardId: enemyId });
  const plan = spawnPlan(ctx, state, enemy, stats, target);
  if (plan.kind === 'choose')
    return chooseLocation(
      ctx,
      state,
      enemyId,
      `spawn:${enemyId}`,
      'decision.chooseSpawnLocation',
      plan.candidates,
      (chosen) => ({ type: 'SpawnEnemy', enemyId, at: chosen }),
    );
  // Index 0 is the top, and the discard's top is what "topmost" effects look for.
  if (plan.kind === 'discard') return [cardMoved(state, enemy, ENCOUNTER_DISCARD, 0)];
  const placed = cardMoved(state, enemy, spawnZone(plan.locationId));
  return [placed, ...engageEvents(ctx, replay([placed], state), enemyId, plan.drawerId)];
}

/**
 * Where the enemy spawns: `target.at`; else its `spawn` instruction; else the
 * drawer's location, where the drawer (`drawerId`) is engaged regardless of prey.
 */
type SpawnPlan =
  | { kind: 'at'; locationId: InstanceId; drawerId?: InvestigatorId }
  | { kind: 'choose'; candidates: InstanceId[] }
  | { kind: 'discard' };

function spawnPlan(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  stats: CardStats,
  target: SpawnTarget,
): SpawnPlan {
  if (target.at !== undefined)
    return { kind: 'at', locationId: requireLocationInPlay(state, target.at).id };
  const detail = stats.keywords?.find((keyword) => keyword.name === 'spawn')?.detail;
  if (detail !== undefined) return instructedSpawn(ctx, state, detail);
  if (target.investigatorId === undefined)
    throw new CommandRejected({ code: 'noSpawnLocation', cardId: enemy.id });
  const drawer = activeInvestigator(state, target.investigatorId);
  if (drawer.locationId === undefined)
    throw new CommandRejected({
      code: 'investigatorHasNoLocation',
      investigatorId: drawer.id,
    });
  return { kind: 'at', locationId: drawer.locationId, drawerId: drawer.id };
}

/**
 * Reads a spawn instruction that names a location, e.g. "Spawn - Hallway".
 * Text that matches no location card at all (e.g. "the location with the most
 * clues") cannot be interpreted, so the players choose among all locations in
 * play instead of the engine guessing. A name that no location in play has
 * (the location is set aside or gone) discards the enemy.
 */
function instructedSpawn(ctx: EngineContext, state: GameState, detail: string): SpawnPlan {
  const inPlay = locationsNamed(ctx, state, detail, { inPlay: true });
  const [only] = inPlay;
  if (only !== undefined && inPlay.length === 1) return { kind: 'at', locationId: only.id };
  if (inPlay.length > 1) return { kind: 'choose', candidates: inPlay.map((card) => card.id) };
  if (locationsNamed(ctx, state, detail).length > 0) return { kind: 'discard' };
  return { kind: 'choose', candidates: locationsInPlay(ctx, state).map((card) => card.id) };
}
