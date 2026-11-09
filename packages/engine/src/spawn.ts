import {
  locationsInPlay,
  locationsNamed,
  neighbours,
  requireLocationInPlay,
  shortestPaths,
} from './board';
import { cardStats, comparableName, type CardStats, type EngineContext } from './cards';
import type { SpawnEnemy } from './commands';
import {
  chooseInvestigator,
  chooseLocation,
  engageEvents,
  investigatorsAt,
  preferredByPrey,
} from './engagement';
import type { Event } from './events';
import { enemiesAt, enemyOf, isEnemyOnTable } from './enemies';
import { activeInvestigator, activeInvestigators } from './investigators';
import type { InstanceId, InvestigatorId } from './ids';
import { cardMoved } from './placement';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, Investigator } from './state';
import type { Zone } from './zone';

const ENCOUNTER_DISCARD: Zone = { kind: 'encounterDiscard' };

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
 * `SpawnEnemy` and `DrawEncounter`, so a drawn enemy follows exactly the same
 * rules as one spawned by a card effect. See `spawnPlan` for where it appears.
 *
 * Rules Reference, "Spawn": with several qualifying locations the investigator
 * who drew it chooses (the lead for an enemy no one drew), with none the enemy is discarded. A
 * choice (several matches, or spawn text the engine cannot read) raises a `chooseLocation`
 * decision (id `spawn:<enemy>`) and leaves the enemy where it is; each option runs
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
  if (isEnemyOnTable(enemy))
    throw new CommandRejected({ code: 'enemyAlreadyInPlay', cardId: enemyId });
  const plan = spawnPlan(ctx, state, enemy, stats, target);
  if (plan.kind === 'chooseInvestigator')
    return chooseInvestigator(
      state,
      enemyId,
      `spawn:${enemyId}`,
      'decision.chooseEngagement',
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
  if (plan.kind === 'discard') return [cardMoved(state, enemy, ENCOUNTER_DISCARD, 0)];
  const placed = cardMoved(state, enemy, spawnZone(plan.locationId));
  return [placed, ...engageEvents(ctx, replay([placed], state), enemyId, plan.engageId)];
}

/**
 * Where the enemy spawns: `target.at`; else engaged with `target.engagedWith`; else its `spawn`
 * instruction; else the drawer's location. `engageId` is the investigator it engages there
 * regardless of prey: the drawer, or the one "Engaged with prey" settled on.
 */
type SpawnPlan =
  | { kind: 'at'; locationId: InstanceId; engageId?: InvestigatorId }
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
  const detail = stats.keywords?.find((keyword) => keyword.name === 'spawn')?.detail;
  if (detail !== undefined)
    return instructedSpawn(ctx, state, stats, detail, target.investigatorId);
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
  return { kind: 'at', locationId: investigator.locationId, engageId: investigator.id };
}

/**
 * Reads a spawn instruction (Rules Reference, "Spawn"), alternative by alternative: "Your House.
 * Otherwise, Rivertown." tries Rivertown only when Your House gives no location. Each alternative
 * is "Engaged with prey", a location filter (`spawnFilter`), or a location name. A name that no
 * location in play has (the location is set aside or gone) gives no location; text that is
 * neither a filter nor a location card's name cannot be interpreted, so the players choose among
 * all locations in play instead of the engine guessing. No location at all discards the enemy.
 */
function instructedSpawn(
  ctx: EngineContext,
  state: GameState,
  stats: CardStats,
  detail: string,
  drawer: InvestigatorId | undefined,
): SpawnPlan {
  const from = drawer === undefined ? undefined : activeInvestigator(state, drawer).locationId;
  for (const alternative of detail.split(OTHERWISE)) {
    const plan = alternativeSpawn(ctx, state, stats, alternative.trim(), from);
    if (plan.kind !== 'discard') return plan;
  }
  return { kind: 'discard' };
}

const OTHERWISE = /\.\s*otherwise,\s*/i;

function alternativeSpawn(
  ctx: EngineContext,
  state: GameState,
  stats: CardStats,
  text: string,
  from: InstanceId | undefined,
): SpawnPlan {
  if (comparableName(text) === 'engaged with prey') return preySpawn(state, stats);
  const filtered = spawnFilter(ctx, state, text, from);
  if (filtered !== undefined) return locationAmong(filtered);
  const inPlay = locationsNamed(ctx, state, text, { inPlay: true });
  if (inPlay.length > 0) return locationAmong(inPlay.map((card) => card.id));
  if (locationsNamed(ctx, state, text).length > 0) return { kind: 'discard' };
  return { kind: 'choose', candidates: locationsInPlay(ctx, state).map((card) => card.id) };
}

/**
 * The locations a filtered spawn instruction allows, or undefined for text that is no filter (a
 * location name, or one the engine can't read). Distances count from `from`, the location of the
 * investigator spawning the enemy ("you"); without one a distance filter can't be read either.
 *
 * - "Any empty location", "Any location (empty, if able)": no investigators and no enemies there
 *   (`emptyLocations`), the second falling back to any location.
 * - "Nearest / Farthest [empty] location", "Location nearest to / farthest from you".
 * - "Any [[Trait]] location", "Location with the most clues", "Any location connected to yours".
 * - "A or B (whichever is nearest to you)".
 */
function spawnFilter(
  ctx: EngineContext,
  state: GameState,
  text: string,
  from: InstanceId | undefined,
): InstanceId[] | undefined {
  const lower = comparableName(text);
  const all = locationsInPlay(ctx, state);
  const ids = all.map((card) => card.id);
  if (lower === 'any empty location') return emptyLocations(ctx, state);
  if (lower === 'any location (empty, if able)') {
    const empty = emptyLocations(ctx, state);
    return empty.length > 0 ? empty : ids;
  }
  if (lower.replace(/^the /, '') === 'location with the most clues') {
    const most = Math.max(...all.map((card) => card.tokens.clue ?? 0));
    return all.filter((card) => (card.tokens.clue ?? 0) === most).map((card) => card.id);
  }
  const distance = DISTANCE.exec(lower);
  if (distance !== null) {
    if (from === undefined) return undefined;
    const pool = distance.groups?.['empty'] === undefined ? ids : emptyLocations(ctx, state);
    const extreme = distance.groups?.['near'] ?? distance.groups?.['nearYou'];
    return extremes(ctx, state, from, pool, extreme === undefined ? 'farthest' : 'nearest');
  }
  if (lower === 'any location connected to yours')
    return from === undefined ? undefined : neighbours(ctx, state, from);
  const whichever = WHICHEVER_NEAREST.exec(text);
  if (whichever !== null) {
    if (from === undefined) return undefined;
    const named = [whichever[1], whichever[2]].flatMap((name) =>
      locationsNamed(ctx, state, name ?? '', { inPlay: true }).map((card) => card.id),
    );
    return extremes(ctx, state, from, named, 'nearest');
  }
  const withTrait = TRAIT_LOCATION.exec(text);
  if (withTrait !== null && comparableName(withTrait[1] ?? '') !== 'empty') {
    const wanted = comparableName(withTrait[1] ?? '');
    return all
      .filter((card) =>
        cardStats(ctx.cards, card.code).traits.some((t) => comparableName(t) === wanted),
      )
      .map((card) => card.id);
  }
  return undefined;
}

const DISTANCE =
  /^(?:the )?(?:(?:(?<near>nearest)|farthest) (?<empty>empty )?location|location (?:(?<nearYou>nearest to)|farthest from) you)$/;
const WHICHEVER_NEAREST = /^(.+?) or (.+?) \(whichever is nearest to you\)\.?$/i;
const TRAIT_LOCATION = /^any (\S+) location\.?$/i;

/**
 * The locations of `pool` nearest to or farthest from `from`, counted in connections; one with
 * no path there is never the farthest, as "farthest" needs a distance.
 */
function extremes(
  ctx: EngineContext,
  state: GameState,
  from: InstanceId,
  pool: readonly InstanceId[],
  which: 'nearest' | 'farthest',
): InstanceId[] {
  const reachable = pool
    .map((id) => {
      const [path] = shortestPaths(ctx, state, from, id);
      return { id, distance: path === undefined ? undefined : path.length - 1 };
    })
    .filter((entry): entry is { id: InstanceId; distance: number } => entry.distance !== undefined);
  const distances = reachable.map(({ distance }) => distance);
  const best = which === 'nearest' ? Math.min(...distances) : Math.max(...distances);
  return reachable.filter(({ distance }) => distance === best).map(({ id }) => id);
}

/** The only candidate, a choice between several, or a discard when there is none. */
function locationAmong(candidates: readonly InstanceId[]): SpawnPlan {
  const [only] = candidates;
  if (only === undefined) return { kind: 'discard' };
  if (candidates.length === 1) return { kind: 'at', locationId: only };
  return { kind: 'choose', candidates: [...candidates] };
}

/**
 * The locations in play with no investigators and no enemies at them (Rules Reference, "Empty
 * Location"). Other cards at a location, such as a story asset, don't count.
 */
function emptyLocations(ctx: EngineContext, state: GameState): InstanceId[] {
  return locationsInPlay(ctx, state)
    .map((card) => card.id)
    .filter(
      (id) => investigatorsAt(state, id).length === 0 && enemiesAt(ctx, state, id).length === 0,
    );
}

/**
 * "Spawn - Engaged with prey": engaged with the investigator its prey picks among every active
 * investigator, wherever they are. A tie, or prey the engine can't read, goes to the lead
 * investigator; with nobody left the enemy is discarded.
 */
function preySpawn(state: GameState, stats: CardStats): SpawnPlan {
  const candidates = preferredByPrey(
    stats,
    activeInvestigators(state).filter((inv) => inv.locationId !== undefined),
  );
  const [only] = candidates;
  if (only === undefined) return { kind: 'discard' };
  if (candidates.length > 1) return { kind: 'chooseInvestigator', candidates };
  return engagedSpawn(state, only.id);
}
