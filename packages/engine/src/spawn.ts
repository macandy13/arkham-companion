import { candidatesOf } from './abilities/resolve';
import { locationsInPlay, locationsNamed, requireLocationInPlay } from './board';
import type { CardStats, EngineContext } from './cards';
import type { SpawnEnemy } from './commands';
import { chooseInvestigator, chooseLocation, engageEvents } from './engagement';
import type { Event } from './events';
import { enemyOf, isEnemyOnTable } from './enemies';
import { activeInvestigator, activeInvestigators, findInvestigator } from './investigators';
import type { InstanceId, InvestigatorId } from './ids';
import { cardMoved } from './placement';
import { discardPileOf } from './player_cards';
import { preferredByPrey, preyPrompt } from './prey';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { SpawnAlternative, SpawnInstruction } from './spawn_instruction';
import type { CardInstance, GameState, Investigator } from './state';
import type { Zone } from './zone';

/**
 * The zone an enemy enters when it spawns at the location `locationId`.
 * Every place that spawns an enemy (setup's `spawn` step, `SpawnEnemy` and
 * encounter draws) goes through this module, so the spawn rule lives in one
 * place. Setup only needs the zone (engagement follows once the scenario has
 * started, see `readyEnemyEngagements`); during play `spawnEvents` adds the
 * spawn instruction, the discard and the engagement.
 */
export function spawnZone(locationId: InstanceId): Zone {
  return { kind: 'atLocation', locationId };
}

/**
 * Where an enemy is spawned: the explicit location, the investigator it spawns engaged with, and
 * the investigator who drew it.
 */
export interface SpawnTarget {
  at?: InstanceId;
  engagedWith?: InvestigatorId;
  investigatorId?: InvestigatorId;
}

/** `SpawnEnemy`: see `spawnEvents`. */
export function handleSpawnEnemy(ctx: EngineContext, state: GameState, cmd: SpawnEnemy): Event[] {
  return spawnEvents(ctx, state, cmd.enemyId, cmd);
}

/**
 * Puts the enemy into play at its spawn location and lets it engage. Shared by
 * `SpawnEnemy` and `DrawCard`, so a drawn enemy follows exactly the same
 * rules as one spawned by a card effect. See `spawnPlan` for where it appears.
 *
 * Rules Reference, "Spawn": with several qualifying locations the investigator
 * who drew it chooses (the lead for an enemy no one drew), with none the enemy is discarded. A
 * choice (several matches, or spawn text the engine cannot read) raises a `chooseLocation`
 * decision (id `spawn:<enemy>`) and leaves the enemy where it is; each option runs
 * `SpawnEnemy` with the chosen `at`, which then engages as usual.
 * A drawn enemy without a spawn instruction engages the drawer, whatever its
 * prey ("Spawn" in the Rules Reference), unless its prey says "only" and leaves
 * the drawer out; prey only picks among investigators for an enemy that spawns elsewhere.
 */
export function spawnEvents(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
  target: SpawnTarget,
): Event[] {
  const { enemy, stats } = enemyOf(ctx, state, enemyId);
  if (isEnemyOnTable(enemy))
    throw new CommandRejected({ code: 'enemyAlreadyInPlay', cardId: enemyId });
  const plan = spawnPlan(ctx, state, enemy, stats, target);
  if (plan.kind === 'chooseInvestigator')
    return chooseInvestigator(
      state,
      enemyId,
      `spawn:${enemyId}`,
      preyPrompt(ctx, state, enemy, 'decision.chooseEngagement'),
      plan.candidates,
      (chosen) => ({ type: 'SpawnEnemy', enemyId, engagedWith: chosen.id }),
    );
  if (plan.kind === 'choose')
    return chooseLocation(
      ctx,
      state,
      enemyId,
      `spawn:${enemyId}`,
      'decision.chooseSpawnLocation',
      plan.candidates,
      (chosen) => ({ type: 'SpawnEnemy', enemyId, at: chosen }),
      // Rules Reference, "Spawn": the investigator encountering the card chooses, not the lead.
      target.investigatorId === undefined
        ? { kind: 'lead' }
        : { kind: 'investigator', investigatorId: target.investigatorId },
    );
  // Index 0 is the top, and the discard's top is what "topmost" effects look for.
  if (plan.kind === 'discard') return [cardMoved(state, enemy, discardPileOf(ctx, enemy), 0)];
  const placed = cardMoved(state, enemy, spawnZone(plan.locationId));
  return [
    placed,
    ...engageEvents(ctx, replay([placed], state), enemyId, plan.engageId, plan.whateverPrey),
  ];
}

/**
 * Where the enemy spawns: `target.at`; else engaged with `target.engagedWith`; else its `spawn`
 * instruction; else the drawer's location. `engageId` is the investigator it engages there
 * before other prey: the drawer (unless an "only" prey leaves them out), or, `whateverPrey`,
 * the one named by `engagedWith` or settled on by "Engaged with prey".
 */
type SpawnPlan =
  | { kind: 'at'; locationId: InstanceId; engageId?: InvestigatorId; whateverPrey?: boolean }
  | { kind: 'choose'; candidates: InstanceId[] }
  | { kind: 'chooseInvestigator'; candidates: Investigator[] }
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
  if (target.engagedWith !== undefined) return engagedSpawn(state, target.engagedWith);
  if (stats.spawnAt !== undefined)
    return instructedSpawn(ctx, state, enemy, stats.spawnAt, target.investigatorId);
  if (target.investigatorId === undefined)
    throw new CommandRejected({ code: 'noSpawnLocation', cardId: enemy.id });
  const drawer = activeInvestigator(state, target.investigatorId);
  if (drawer.locationId === undefined)
    throw new CommandRejected({
      code: 'investigatorHasNoLocation',
      investigatorId: drawer.id,
    });
  return { kind: 'at', locationId: drawer.locationId, engageId: drawer.id };
}

/**
 * At the investigator's location, engaged with them whatever the prey: the target "Engaged with
 * prey" resolved to, or the answer to its tie.
 */
function engagedSpawn(state: GameState, investigatorId: InvestigatorId): SpawnPlan {
  const investigator = activeInvestigator(state, investigatorId);
  if (investigator.locationId === undefined)
    throw new CommandRejected({ code: 'investigatorHasNoLocation', investigatorId });
  return {
    kind: 'at',
    locationId: investigator.locationId,
    engageId: investigator.id,
    whateverPrey: true,
  };
}

/**
 * Follows a spawn instruction (`SpawnInstruction`), alternative by alternative: the first that
 * gives a location or an investigator decides. A selector that names locations no card in the
 * game has, or locations connected to yours when nobody drew the enemy, is no instruction the
 * engine can read, so the players choose among all locations in play instead of the engine
 * guessing. No location at all discards the enemy.
 */
function instructedSpawn(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  instruction: SpawnInstruction,
  drawer: InvestigatorId | undefined,
): SpawnPlan {
  for (const alternative of instruction) {
    const plan = alternativeSpawn(ctx, state, enemy, alternative, drawer);
    if (plan.kind !== 'discard') return plan;
  }
  return { kind: 'discard' };
}

function alternativeSpawn(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  alternative: SpawnAlternative,
  drawer: InvestigatorId | undefined,
): SpawnPlan {
  if (alternative.kind === 'engagedWithPrey') return preySpawn(ctx, state, enemy);
  const { select } = alternative;
  const candidates = candidatesOf(ctx, state, select, enemy.id, drawer) as InstanceId[];
  const { name, connectedTo } = select.among;
  const unreadable =
    (name !== undefined && !namesALocation(ctx, state, name)) ||
    (connectedTo !== undefined && drawerLocation(state, drawer) === undefined);
  if (candidates.length === 0 && unreadable)
    return { kind: 'choose', candidates: locationsInPlay(ctx, state).map((card) => card.id) };
  return locationAmong(candidates);
}

/** Where the investigator who drew the enemy is, if anyone did. */
function drawerLocation(
  state: GameState,
  drawer: InvestigatorId | undefined,
): InstanceId | undefined {
  return drawer === undefined ? undefined : findInvestigator(state, drawer)?.locationId;
}

/** Whether a location card in the game, in play or not, has one of `names`. */
function namesALocation(
  ctx: EngineContext,
  state: GameState,
  names: string | readonly string[],
): boolean {
  return [names].flat().some((name) => locationsNamed(ctx, state, name).length > 0);
}

/** The only candidate, a choice between several, or a discard when there is none. */
function locationAmong(candidates: readonly InstanceId[]): SpawnPlan {
  const [only] = candidates;
  if (only === undefined) return { kind: 'discard' };
  if (candidates.length === 1) return { kind: 'at', locationId: only };
  return { kind: 'choose', candidates: [...candidates] };
}

/**
 * "Spawn - Engaged with prey": engaged with the investigator its prey picks among every active
 * investigator, wherever they are. A tie, or prey the engine can't read, goes to the lead
 * investigator; with nobody left the enemy is discarded.
 */
function preySpawn(ctx: EngineContext, state: GameState, enemy: CardInstance): SpawnPlan {
  const candidates = preferredByPrey(
    ctx,
    state,
    enemy,
    activeInvestigators(state).filter((inv) => inv.locationId !== undefined),
  );
  const [only] = candidates;
  if (only === undefined) return { kind: 'discard' };
  if (candidates.length > 1) return { kind: 'chooseInvestigator', candidates };
  return engagedSpawn(state, only.id);
}
