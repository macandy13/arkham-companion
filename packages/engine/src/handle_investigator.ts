import { neighbours } from './board';
import type { EngineContext } from './cards';
import type {
  AdjustInvestigator,
  DiscoverClues,
  MoveInvestigator,
  SetLeadInvestigator,
} from './commands';
import { investigatorLeavesEvents } from './elimination';
import type {
  CardFlipped,
  Event,
  InvestigatorChanged,
  InvestigatorMoved,
  LeadInvestigatorChanged,
  TokensChanged,
} from './events';
import { handleRevealLocation } from './handle_board';
import type { InvestigatorId } from './ids';
import { defeatCause, statValue, withStatDelta } from './investigators';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { GameState, Investigator } from './state';

/**
 * `MoveInvestigator`: moves to a connected location (or any location in play
 * with `ignoreConnections`). The reveal goes through `handleRevealLocation`, so
 * clues are placed exactly as for an explicit `RevealLocation`.
 */
export function handleMoveInvestigator(
  ctx: EngineContext,
  state: GameState,
  cmd: MoveInvestigator,
): (InvestigatorMoved | CardFlipped | TokensChanged)[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const destination = requireCard(state.cards, cmd.to);
  if (destination.zone.kind !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId: cmd.to });
  if (investigator.locationId === cmd.to)
    throw new CommandRejected({
      code: 'alreadyAtLocation',
      investigatorId: investigator.id,
      locationId: cmd.to,
    });
  // An investigator without a location is being placed on the map, not moving along it.
  if (
    investigator.locationId !== undefined &&
    !cmd.ignoreConnections &&
    !neighbours(state, investigator.locationId).includes(cmd.to)
  )
    throw new CommandRejected({ code: 'notConnected', from: investigator.locationId, to: cmd.to });

  const moved: InvestigatorMoved = {
    type: 'InvestigatorMoved',
    investigatorId: investigator.id,
    to: cmd.to,
  };
  if (destination.faceUp) return [moved];
  const reveal = handleRevealLocation(ctx, state, { type: 'RevealLocation', locationId: cmd.to });
  return [moved, ...reveal];
}

/**
 * `AdjustInvestigator`: changes one counter and defeats the investigator in
 * the same step if that uses up their health or sanity, so no state ever
 * shows an active investigator with nothing left. A defeat comes with the
 * clean-up of `investigatorLeavesEvents`.
 */
export function handleAdjustInvestigator(state: GameState, cmd: AdjustInvestigator): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (!Number.isInteger(cmd.delta) || cmd.delta === 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.delta });
  const current = statValue(investigator, cmd.stat);
  if (current + cmd.delta < 0)
    throw new CommandRejected({
      code: 'negativeInvestigatorStat',
      investigatorId: investigator.id,
      stat: cmd.stat,
      current,
      delta: cmd.delta,
    });

  const changed: InvestigatorChanged = {
    type: 'InvestigatorChanged',
    investigatorId: investigator.id,
    stat: cmd.stat,
    delta: cmd.delta,
  };
  const cause = defeatCause(withStatDelta(investigator, cmd.stat, cmd.delta));
  if (cause === undefined) return [changed];
  return [
    changed,
    ...investigatorLeavesEvents(state, investigator, {
      type: 'InvestigatorDefeated',
      investigatorId: investigator.id,
      cause,
    }),
  ];
}

/** `SetLeadInvestigator`: the lead investigator is an active investigator, and a change needs a different one. */
export function handleSetLeadInvestigator(
  state: GameState,
  cmd: SetLeadInvestigator,
): LeadInvestigatorChanged[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (state.meta.leadInvestigator === investigator.id)
    throw new CommandRejected({
      code: 'alreadyLeadInvestigator',
      investigatorId: investigator.id,
    });
  return [{ type: 'LeadInvestigatorChanged', investigatorId: investigator.id }];
}

/** `DiscoverClues`: moves `amount` clues from the investigator's own location to them. */
export function handleDiscoverClues(
  state: GameState,
  cmd: DiscoverClues,
): (TokensChanged | InvestigatorChanged)[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  const location = requireCard(state.cards, cmd.locationId);
  if (investigator.locationId !== cmd.locationId)
    throw new CommandRejected({
      code: 'investigatorNotAtLocation',
      investigatorId: investigator.id,
      locationId: cmd.locationId,
    });
  const available = location.tokens.clue ?? 0;
  if (available < cmd.amount)
    throw new CommandRejected({
      code: 'notEnoughClues',
      cardId: location.id,
      available,
      requested: cmd.amount,
    });

  return [
    { type: 'TokensChanged', cardId: location.id, token: 'clue', delta: -cmd.amount },
    {
      type: 'InvestigatorChanged',
      investigatorId: investigator.id,
      stat: 'clues',
      delta: cmd.amount,
    },
  ];
}

/** The investigator, rejecting unknown IDs and those who are no longer in the scenario. */
export function activeInvestigator(state: GameState, id: InvestigatorId): Investigator {
  const investigator = state.investigators.find((inv) => inv.id === id);
  if (!investigator) throw new CommandRejected({ code: 'unknownInvestigator', investigatorId: id });
  if (investigator.status !== 'active')
    throw new CommandRejected({ code: 'investigatorNotActive', investigatorId: id });
  return investigator;
}
