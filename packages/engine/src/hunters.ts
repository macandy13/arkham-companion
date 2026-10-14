import { neighbours, shortestPaths } from './board';
import type { MoveHunter } from './commands';
import { CommandRejected } from './rejection';
import { cardStats, type EngineContext } from './cards';
import { chooseInvestigator, chooseLocation, engageEvents, preferredByPrey } from './engagement';
import type { CardMoved, Event } from './events';
import type { InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { replay } from './reducer';
import type { CardInstance, GameState, Investigator } from './state';

/** The first steps towards one investigator along its shortest paths, and how far away they are. */
interface Route {
  investigator: Investigator;
  distance: number;
  /** Distinct neighbours of the hunter's location that start a shortest path. */
  steps: InstanceId[];
}

/**
 * `MoveHunters`: every ready, unengaged hunter in play that has no investigator
 * at its location moves one step towards the nearest one (Rules Reference,
 * "Hunter"). Hunters are independent of each other because investigators do
 * not move during the step, so the order does not matter; each hunter is
 * decided against the state its predecessors left behind only so that a
 * decision or engagement of one is visible to the next.
 */
export function handleMoveHunters(ctx: EngineContext, state: GameState): Event[] {
  let current = state;
  const events: Event[] = [];
  for (const hunter of hunters(ctx, state)) {
    const next = hunterEvents(ctx, current, hunter);
    events.push(...next);
    current = replay(next, current);
  }
  return events;
}

/**
 * `MoveHunter`: the step a decision settled. `towards` re-runs the route
 * choice for the chosen investigator only, which can leave a location tie.
 */
export function handleMoveHunter(
  ctx: EngineContext,
  state: GameState,
  command: MoveHunter,
): Event[] {
  const hunter = state.cards[command.enemyId];
  if (!hunter) throw new CommandRejected({ code: 'unknownCard', cardId: command.enemyId });
  if (hunter.zone.kind !== 'atLocation' || ctx.cards.get(hunter.code)?.typeCode !== 'enemy')
    throw new CommandRejected({ code: 'notAHunter', cardId: hunter.id });
  if (command.to !== undefined) {
    if (!neighbours(state, hunter.zone.locationId).includes(command.to))
      throw new CommandRejected({ code: 'hunterCannotMove', cardId: hunter.id, to: command.to });
    return moveTo(ctx, state, hunter, command.to);
  }
  const investigator = state.investigators.find((inv) => inv.id === command.towards);
  if (!investigator)
    throw new CommandRejected({ code: 'unknownInvestigator', investigatorId: command.towards });
  const routes = routeTo(state, hunter.zone.locationId, investigator);
  const steps = distinctSteps(routes);
  const [only] = steps;
  if (only === undefined)
    throw new CommandRejected({
      code: 'noRoute',
      cardId: hunter.id,
      investigatorId: investigator.id,
    });
  if (steps.length === 1) return moveTo(ctx, state, hunter, only);
  return chooseHunterLocation(ctx, state, hunter, steps);
}

/** Ready, unengaged hunters at a location, in card order. */
function hunters(ctx: EngineContext, state: GameState): CardInstance[] {
  return Object.values(state.cards).filter((card) => {
    if (card.zone.kind !== 'atLocation' || card.exhausted) return false;
    const stats = ctx.cards.get(card.code);
    return stats?.typeCode === 'enemy' && hasKeyword(stats, 'hunter');
  });
}

/**
 * The events for one hunter: nothing if it has to stay, a move (and engagement
 * on arrival) if the way is clear, or a decision when the rules leave a tie.
 * Ties are broken in the order the rules give: nearest investigator, then
 * prey, then the players. Investigators whose routes begin with the same step
 * are no tie at all, because the hunter moves the same way for each.
 */
function hunterEvents(ctx: EngineContext, state: GameState, hunter: CardInstance): Event[] {
  if (hunter.zone.kind !== 'atLocation') return [];
  const from = hunter.zone.locationId;
  const stats = cardStats(ctx.cards, hunter.code);
  const nearest = nearestRoutes(state, from);
  if (nearest.length === 0 || state.pending.some((decision) => decision.subject === hunter.id))
    return [];
  if (distinctSteps(nearest).length === 1) return moveTowards(ctx, state, hunter, nearest);

  const preferredIds = new Set(
    preferredByPrey(
      stats,
      nearest.map((route) => route.investigator),
    ).map((investigator) => investigator.id),
  );
  const preferred = nearest.filter((route) => preferredIds.has(route.investigator.id));
  const steps = distinctSteps(preferred);
  if (steps.length === 1) return moveTowards(ctx, state, hunter, preferred);
  // Investigators whose routes begin alike need no choice between them, only the destination.
  if (new Set(preferred.map((route) => [...route.steps].sort().join())).size > 1)
    return chooseInvestigator(
      state,
      hunter.id,
      `hunter:${hunter.id}:investigator`,
      'decision.chooseHunterTarget',
      preferred.map((route) => route.investigator),
      (chosen) => ({ type: 'MoveHunter', enemyId: hunter.id, towards: chosen.id }),
    );
  return chooseHunterLocation(ctx, state, hunter, steps);
}

function chooseHunterLocation(
  ctx: EngineContext,
  state: GameState,
  hunter: CardInstance,
  steps: readonly InstanceId[],
): Event[] {
  return chooseLocation(
    ctx,
    state,
    hunter.id,
    `hunter:${hunter.id}:location`,
    'decision.chooseHunterDestination',
    steps,
    (chosen) => ({ type: 'MoveHunter', enemyId: hunter.id, to: chosen }),
  );
}

/** The routes to the nearest investigators; empty if no investigator is elsewhere and reachable. */
function nearestRoutes(state: GameState, from: InstanceId): Route[] {
  const active = state.investigators.filter(
    (investigator) => investigator.status === 'active' && investigator.locationId !== undefined,
  );
  // A hunter does not move while an investigator is at its location.
  if (active.some((investigator) => investigator.locationId === from)) return [];
  const routes = active.flatMap((investigator) => routeTo(state, from, investigator));
  const shortest = Math.min(...routes.map((route) => route.distance));
  return routes.filter((route) => route.distance === shortest);
}

function routeTo(state: GameState, from: InstanceId, investigator: Investigator): Route[] {
  if (investigator.locationId === undefined) return [];
  const paths = shortestPaths(state, from, investigator.locationId);
  const [first] = paths;
  if (first === undefined) return [];
  const steps = [...new Set(paths.flatMap((path) => path.slice(1, 2)))];
  return [{ investigator, distance: first.length - 1, steps }];
}

function distinctSteps(routes: readonly Route[]): InstanceId[] {
  return [...new Set(routes.flatMap((route) => route.steps))];
}

function moveTowards(
  ctx: EngineContext,
  state: GameState,
  hunter: CardInstance,
  routes: readonly Route[],
): Event[] {
  const [destination] = distinctSteps(routes);
  if (destination === undefined) return [];
  return moveTo(ctx, state, hunter, destination);
}

function moveTo(
  ctx: EngineContext,
  state: GameState,
  hunter: CardInstance,
  destination: InstanceId,
): Event[] {
  const moved: CardMoved = {
    type: 'CardMoved',
    cardId: hunter.id,
    from: hunter.zone,
    to: { kind: 'atLocation', locationId: destination },
  };
  return [moved, ...engageEvents(ctx, replay([moved], state), hunter.id)];
}
