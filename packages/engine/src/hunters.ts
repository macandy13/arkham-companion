import type { EngineContext } from './cards';
import { cardHasKeyword } from './card_keywords';
import type { MoveEnemy, MoveHunters } from './commands';
import { cardOptionLabels, requestDecision } from './decisions';
import type { Event } from './events';
import { handleMoveEnemy } from './handle_enemy';
import { decisionId, type InstanceId } from './ids';
import { cardsOfType } from './lookup';
import type { CardInstance, GameState } from './state';

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
 *   `EnemyDestination`);
 * - two or more would move: a `chooseCard` decision `hunterOrder` for the lead
 *   investigator, one option per such hunter (option id and target: the
 *   hunter's instance ID), and nothing moves yet.
 *
 * Answering `hunterOrder` is `ResolveDecision` (M1.9). The chosen option must
 * run the chosen hunter's step (`MoveEnemy` toward its prey), then `MoveHunters
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
    .filter((hunter) => !state.pending.some((decision) => decision.subject === hunter.id))
    .map((hunter) => ({ hunter, events: handleMoveEnemy(ctx, state, huntStep(hunter.id)) }))
    .filter(({ events }) => events.length > 0);
  const [only] = movers;
  if (only === undefined) return [];
  if (movers.length === 1) return only.events;
  const labels = cardOptionLabels(
    ctx,
    state,
    movers.map(({ hunter }) => hunter.id),
  );
  return requestDecision(state, {
    id: decisionId('hunterOrder'),
    kind: 'chooseCard',
    decider: { kind: 'lead' },
    prompt: 'decision.chooseHunterOrder',
    options: movers.map(({ hunter }, i) => ({
      id: hunter.id,
      label: labels[i] ?? hunter.id,
      target: hunter.id,
      commands: [
        huntStep(hunter.id),
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
      cardHasKeyword(ctx, state, card, 'hunter'),
  );
}

/** A hunter's step: toward its prey (Rules Reference, "Hunter"). */
function huntStep(enemyId: InstanceId): MoveEnemy {
  return { type: 'MoveEnemy', enemyId, toward: 'prey' };
}
