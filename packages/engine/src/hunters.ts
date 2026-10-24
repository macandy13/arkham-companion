import { firstSteps, neighbours, shortestPaths } from './board';
import type { MoveHunter, MoveHunters } from './commands';
import { CommandRejected } from './rejection';
import { cardStats, type EngineContext } from './cards';
import { chooseInvestigator, chooseLocation, engageEvents, preferredByPrey } from './engagement';
import { requestDecision } from './decisions';
import type { Event } from './events';
import { moveCardEvent } from './placement';
import { decisionId, type InstanceId } from './ids';
import { activeInvestigators } from './investigators';
import { hasKeyword } from './keywords';
import { cardsOfType, requireCard } from './lookup';
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
 * `MoveHunters`: the ready, unengaged hunters in play without an investigator
 * at their location each move one step towards the nearest one (Rules
 * Reference, "Hunter"). Hunters that move at the same time are resolved in an
 * order the lead investigator chooses (our reading of Rules Reference,
 * "Choices": the lead settles a choice between several valid options; no rule
 * orders hunters explicitly), one at a time, so a hunter's engagement on
 * arrival and its own choices are settled before the next hunter moves. Hence:
 *
 * - no hunter would move: no events;
 * - exactly one would move: it moves (or raises its own tie decision, see
 *   `hunterEvents`);
 * - two or more would move: a `chooseCard` decision `hunterOrder` for the lead
 *   investigator, one option per such hunter (option id and target: the
 *   hunter's instance ID), and nothing moves yet.
 *
 * Answering `hunterOrder` is `ResolveDecision` (M1.9). The chosen option must
 * run `MoveHunter { enemyId }` for the chosen hunter, then `MoveHunters
 * { hunters: <the other options> }`, which asks again if two or more of the rest
 * would still move. The `hunters` list is what keeps a hunter that has already
 * moved this phase (and did not engage) from moving a second time; omit it to
 * consider every hunter in play. A hunter with an open decision about itself
 * is skipped until that is answered.
 */
export function handleMoveHunters(
  ctx: EngineContext,
  state: GameState,
  command: MoveHunters,
): Event[] {
  const movers = hunters(ctx, state, command.hunters)
    .map((hunter) => ({ hunter, events: hunterEvents(ctx, state, hunter) }))
    .filter(({ events }) => events.length > 0);
  const [only] = movers;
  if (only === undefined) return [];
  if (movers.length === 1) return only.events;
  return requestDecision(state, {
    id: decisionId('hunterOrder'),
    kind: 'chooseCard',
    decider: { kind: 'lead' },
    prompt: 'decision.chooseHunterOrder',
    options: movers.map(({ hunter }) => ({
      id: hunter.id,
      label: cardStats(ctx.cards, hunter.code).name,
      target: hunter.id,
      commands: [
        { type: 'MoveHunter', enemyId: hunter.id },
        {
          type: 'MoveHunters',
          hunters: movers
            .filter((mover) => mover.hunter.id !== hunter.id)
            .map((mover) => mover.hunter.id),
        },
      ],
    })),
  });
}

/**
 * `MoveHunter`: the step a decision settled. `towards` re-runs the route
 * choice for the chosen investigator only, which can leave a location tie.
 * Without `to` and `towards` the hunter follows its own rule (`hunterEvents`),
 * which is what the `hunterOrder` answer needs: the lead only picks who goes
 * first, the hunter's tie-breaking decisions stay the ones `MoveHunters` would
 * have raised.
 */
export function handleMoveHunter(
  ctx: EngineContext,
  state: GameState,
  command: MoveHunter,
): Event[] {
  const hunter = requireCard(state.cards, command.enemyId);
  if (hunter.zone.kind !== 'atLocation' || ctx.cards.get(hunter.code)?.typeCode !== 'enemy')
    throw new CommandRejected({ code: 'notAHunter', cardId: hunter.id });
  if (command.to === undefined && command.towards === undefined)
    return hunterEvents(ctx, state, hunter);
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

/** Ready, unengaged hunters at a location, in card order; only those in `only` when it is given. */
function hunters(
  ctx: EngineContext,
  state: GameState,
  only?: readonly InstanceId[],
): CardInstance[] {
  return cardsOfType(ctx, state, 'enemy').filter(
    (card) =>
      (only === undefined || only.includes(card.id)) &&
      card.zone.kind === 'atLocation' &&
      !card.exhausted &&
      hasKeyword(cardStats(ctx.cards, card.code), 'hunter'),
  );
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
    'decision.chooseEnemyDestination',
    steps,
    (chosen) => ({ type: 'MoveHunter', enemyId: hunter.id, to: chosen }),
  );
}

/** The routes to the nearest investigators; empty if no investigator is elsewhere and reachable. */
function nearestRoutes(state: GameState, from: InstanceId): Route[] {
  const active = activeInvestigators(state).filter(
    (investigator) => investigator.locationId !== undefined,
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
  return [{ investigator, distance: first.length - 1, steps: firstSteps(paths) }];
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
  const moved = moveCardEvent(hunter, { kind: 'atLocation', locationId: destination });
  return [moved, ...engageEvents(ctx, replay([moved], state), hunter.id)];
}
