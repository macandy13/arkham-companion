import { neighbours, requireLocationInPlay, revealEvents } from './board';
import type { EngineContext } from './cards';
import type {
  AdjustInvestigator,
  DefeatInvestigator,
  DiscoverClues,
  MoveInvestigator,
  PlaceClues,
  SetLeadInvestigator,
} from './commands';
import { investigatorLeavesEvents } from './elimination';
import { arrivalEngagements } from './engagement';
import type {
  CluesDiscovered,
  Event,
  InvestigatorChanged,
  InvestigatorMoved,
  LeadInvestigatorChanged,
  TokensChanged,
} from './events';
import {
  activeInvestigator,
  cluesToLocationEvents,
  defeatCause,
  discoverCluesEvents,
  statValue,
  withStatDelta,
} from './investigators';
import { requireCard } from './lookup';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { GameState } from './state';

/**
 * `MoveInvestigator`: moves to a connected location (or any location in play
 * with `ignoreConnections`). The reveal goes through `revealEvents`, so
 * clues are placed exactly as for an explicit `RevealLocation`. Ready,
 * unengaged enemies at the destination then engage (`arrivalEngagements`),
 * whether the move is an action or a card effect, unless the effect avoids
 * engagement (`avoidEngagement`).
 */
export function handleMoveInvestigator(
  ctx: EngineContext,
  state: GameState,
  cmd: MoveInvestigator,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const destination = requireLocationInPlay(state, cmd.to);
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
    ...(investigator.locationId !== undefined && { from: investigator.locationId }),
    to: cmd.to,
  };
  const reveal = destination.faceUp ? [] : revealEvents(ctx, state, cmd.to);
  const arrived = [moved, ...reveal];
  if (cmd.avoidEngagement) return arrived;
  return [...arrived, ...arrivalEngagements(ctx, replay(arrived, state), cmd.to)];
}

/**
 * `AdjustInvestigator`: changes one counter and defeats the investigator in
 * the same step if that uses up their health or sanity, so no state ever
 * shows an active investigator with nothing left. A defeat comes with the
 * clean-up of `investigatorLeavesEvents`.
 */
export function handleAdjustInvestigator(
  ctx: EngineContext,
  state: GameState,
  cmd: AdjustInvestigator,
): Event[] {
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
    ...investigatorLeavesEvents(ctx, state, investigator, {
      type: 'InvestigatorDefeated',
      investigatorId: investigator.id,
      cause,
    }),
  ];
}

/** `DefeatInvestigator`: a card effect defeats the investigator, with the clean-up of any defeat. */
export function handleDefeatInvestigator(
  ctx: EngineContext,
  state: GameState,
  cmd: DefeatInvestigator,
): Event[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  return investigatorLeavesEvents(ctx, state, investigator, {
    type: 'InvestigatorDefeated',
    investigatorId: investigator.id,
    cause: 'cardEffect',
    ...(cmd.trauma === undefined ? {} : { trauma: cmd.trauma }),
  });
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
): (TokensChanged | InvestigatorChanged | CluesDiscovered)[] {
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

  return discoverCluesEvents(investigator.id, location.id, cmd.amount);
}

/** `PlaceClues`: the investigator's clues, as many as they have up to `amount`, move to their location. */
export function handlePlaceClues(
  state: GameState,
  cmd: PlaceClues,
): (InvestigatorChanged | TokensChanged)[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (!Number.isInteger(cmd.amount) || cmd.amount <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: cmd.amount });
  // "Place 1 of your clues" for each point: an investigator who runs out places what they have,
  // and one not on the map yet has no location to place them on.
  const placed = Math.min(cmd.amount, investigator.clues);
  if (placed === 0 || investigator.locationId === undefined) return [];
  return cluesToLocationEvents(investigator.id, investigator.locationId, placed);
}
