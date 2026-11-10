import {
  extremeLocations,
  locationsInPlay,
  locationsNamed,
  locationsWithMostClues,
  neighbours,
  requireLocationInPlay,
} from './board';
import { comparableName, trait, type CardStats, type EngineContext } from './cards';
import type { SpawnEnemy } from './commands';
import { chooseInvestigator, chooseLocation, engageEvents, investigatorsAt } from './engagement';
import type { Event } from './events';
import { enemiesAt, enemyOf, isEnemyOnTable } from './enemies';
import { activeInvestigator, activeInvestigators, findInvestigator } from './investigators';
import type { InstanceId, InvestigatorId } from './ids';
import { matchesCard } from './lookup';
import { cardMoved } from './placement';
import { preferredByPrey, preyPrompt } from './prey';
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
      preyPrompt(state, stats, 'decision.chooseEngagement'),
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
    return instructedSpawn(ctx, state, enemy, detail, target.investigatorId);
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
  enemy: CardInstance,
  detail: string,
  drawer: InvestigatorId | undefined,
): SpawnPlan {
  const from = drawer === undefined ? undefined : findInvestigator(state, drawer)?.locationId;
  for (const alternative of detail.split(OTHERWISE)) {
    const plan = alternativeSpawn(ctx, state, enemy, alternative.trim(), from);
    if (plan.kind !== 'discard') return plan;
  }
  return { kind: 'discard' };
}

const OTHERWISE = /\.\s*otherwise,\s*/i;

function alternativeSpawn(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  text: string,
  from: InstanceId | undefined,
): SpawnPlan {
  if (comparableName(text) === 'engaged with prey') return preySpawn(ctx, state, enemy);
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
 * investigator spawning the enemy ("you"; for "Farthest empty location", which names nobody, our
 * reading). Without one the players choose among the locations that meet the rest of the filter,
 * and "connected to yours" can't be read at all.
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
  const lower = comparableName(text).replace(/^the /, '');
  const ids = locationsInPlay(ctx, state).map((card) => card.id);
  const distance = DISTANCES[lower];
  if (distance !== undefined) {
    const pool = distance.empty ? emptyLocations(ctx, state) : ids;
    return from === undefined ? pool : extremeLocations(ctx, state, from, pool, distance.which);
  }
  if (lower === 'any empty location') return emptyLocations(ctx, state);
  if (lower === 'any location (empty, if able)') {
    const empty = emptyLocations(ctx, state);
    return empty.length > 0 ? empty : ids;
  }
  if (lower === 'location with the most clues') return locationsWithMostClues(ctx, state);
  if (lower === 'any location connected to yours')
    return from === undefined ? undefined : neighbours(ctx, state, from);
  if (lower.endsWith(WHICHEVER_NEAREST)) {
    const names = text.trim().slice(0, -WHICHEVER_NEAREST.length).split(' or ');
    const named = names.flatMap((name) =>
      locationsNamed(ctx, state, name, { inPlay: true }).map((card) => card.id),
    );
    return from === undefined ? named : extremeLocations(ctx, state, from, named, 'nearest');
  }
  const traitName = lower.startsWith('any ') ? text.trim().slice('any '.length) : '';
  if (traitName.length > ' location'.length && lower.endsWith(' location')) {
    const wanted = trait(traitName.slice(0, -' location'.length));
    return locationsInPlay(ctx, state)
      .filter((card) => matchesCard(ctx, card, { trait: wanted }))
      .map((card) => card.id);
  }
  return undefined;
}

const DISTANCES: Readonly<
  Record<string, { which: 'nearest' | 'farthest'; empty: boolean } | undefined>
> = {
  'nearest location': { which: 'nearest', empty: false },
  'farthest location': { which: 'farthest', empty: false },
  'nearest empty location': { which: 'nearest', empty: true },
  'farthest empty location': { which: 'farthest', empty: true },
  'location nearest to you': { which: 'nearest', empty: false },
  'location farthest from you': { which: 'farthest', empty: false },
};
const WHICHEVER_NEAREST = ' (whichever is nearest to you)';

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
