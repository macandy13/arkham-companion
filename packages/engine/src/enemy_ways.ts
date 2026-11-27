import {
  firstSteps,
  isLocationInPlay,
  neighbours,
  requireLocationInPlay,
  shortestPaths,
} from './board';
import type { EngineContext } from './cards';
import type { EnemyDestination } from './commands';
import { locationOf } from './enemies';
import { investigatorsAt } from './engagement';
import type { InstanceId } from './ids';
import { activeInvestigators } from './investigators';
import { preferredByPrey, preyAllows } from './prey';
import { isClosedToEnemy } from './restrictions';
import type { CardInstance, GameState, Investigator } from './state';

/**
 * Where a destination rule (`MoveEnemy.toward`) leads an enemy from where it is: the first steps
 * it may take and, for the hunter's rule, the investigators the players choose between first.
 * `MoveEnemy` moves along it.
 */
interface EnemyWay {
  /** Neighbours of its location that start a way it may go; empty when it stays. */
  steps: InstanceId[];
  /**
   * Equally near investigators whose ways begin differently, to choose between before a step;
   * absent when no such choice is left. The chosen one's location is where the enemy heads.
   */
  investigators?: PlacedInvestigator[];
}

/** An investigator at a location, one an enemy can head for. */
type PlacedInvestigator = Investigator & { locationId: InstanceId };

/** The first steps towards one investigator along its shortest paths, and how far away they are. */
interface Route {
  investigator: PlacedInvestigator;
  distance: number;
  /** Distinct neighbours of the enemy's location that start a shortest path. */
  steps: InstanceId[];
}

/** The way `toward` leads `enemy`: to a location, to its prey, or away from investigators. */
export function enemyWay(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  toward: EnemyDestination,
): EnemyWay {
  if (toward === 'prey') return preyWay(ctx, state, enemy);
  if (toward === 'awayFromInvestigators') return { steps: awaySteps(ctx, state, enemy) };
  return { steps: stepsToward(ctx, state, enemy, toward) };
}

/**
 * The first steps of the enemy's shortest paths to `toward`: none while `toward` is out of play
 * (the Parlor while act 1 holds it set aside) or out of reach. Like a hunter, it does not step
 * into a location closed to it (RR "Hunter").
 */
function stepsToward(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  toward: InstanceId,
): InstanceId[] {
  if (!isLocationInPlay(state, toward)) return [];
  return openSteps(
    ctx,
    state,
    enemy,
    firstSteps(shortestPaths(ctx, state, locationOf(state, enemy), toward)),
  );
}

/** Rules Reference, "Elusive": to a connecting location, one without investigators if able. */
function awaySteps(ctx: EngineContext, state: GameState, enemy: CardInstance): InstanceId[] {
  const open = openSteps(ctx, state, enemy, neighbours(ctx, state, locationOf(state, enemy)));
  const empty = open.filter((step) => investigatorsAt(state, step).length === 0);
  return empty.length > 0 ? empty : open;
}

/**
 * Rules Reference, "Hunter": one step towards the nearest investigator. Ties are broken in the
 * order the rules give: nearest investigator, then prey, then the players. Investigators whose
 * routes begin with the same steps are no tie at all, because the hunter moves the same way for
 * each; only investigators whose routes begin differently are a choice.
 */
function preyWay(ctx: EngineContext, state: GameState, hunter: CardInstance): EnemyWay {
  const nearest = nearestRoutes(ctx, state, hunter);
  if (distinctSteps(nearest).length <= 1) return { steps: distinctSteps(nearest) };
  const preferredIds = new Set(
    preferredByPrey(
      ctx,
      state,
      hunter,
      nearest.map((route) => route.investigator),
    ).map((investigator) => investigator.id),
  );
  const preferred = nearest.filter((route) => preferredIds.has(route.investigator.id));
  const steps = distinctSteps(preferred);
  if (
    steps.length > 1 &&
    new Set(preferred.map((route) => [...route.steps].sort().join())).size > 1
  )
    return { steps, investigators: preferred.map((route) => route.investigator) };
  return { steps };
}

/** The routes to the nearest investigators; empty if no investigator is elsewhere and reachable. */
function nearestRoutes(ctx: EngineContext, state: GameState, hunter: CardInstance): Route[] {
  const from = locationOf(state, hunter);
  // Rules Reference, "Prey": a hunter whose prey says "only" moves towards no one else.
  const active = preyAllows(
    ctx,
    state,
    hunter,
    activeInvestigators(state).filter((investigator) => investigator.locationId !== undefined),
  );
  // A hunter does not move while an investigator is at its location.
  if (active.some((investigator) => investigator.locationId === from)) return [];
  const routes = active.flatMap((investigator) => routeTo(ctx, state, from, investigator));
  const shortest = Math.min(...routes.map((route) => route.distance));
  // RR "Hunter": distance counts through a location closed to it (Barricade), but it does not
  // step into one; with no other step on its shortest routes, it stays.
  return routes
    .filter((route) => route.distance === shortest)
    .map((route) => ({ ...route, steps: openSteps(ctx, state, hunter, route.steps) }))
    .filter((route) => route.steps.length > 0);
}

function routeTo(
  ctx: EngineContext,
  state: GameState,
  from: InstanceId,
  investigator: Investigator,
): Route[] {
  const { locationId } = investigator;
  if (locationId === undefined) return [];
  const paths = shortestPaths(ctx, state, from, locationId);
  const [first] = paths;
  if (first === undefined) return [];
  return [
    {
      investigator: { ...investigator, locationId },
      distance: first.length - 1,
      steps: firstSteps(paths),
    },
  ];
}

function openSteps(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  steps: readonly InstanceId[],
): InstanceId[] {
  return steps.filter(
    (step) => !isClosedToEnemy(ctx, state, enemy, requireLocationInPlay(state, step)),
  );
}

function distinctSteps(routes: readonly Route[]): InstanceId[] {
  return [...new Set(routes.flatMap((route) => route.steps))];
}
