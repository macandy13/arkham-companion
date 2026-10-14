import type { CommandType } from './commands';
import type { InstanceId, InvestigatorId, MapId } from './ids';
import type { InvestigatorStat, TokenKind } from './state';

/**
 * Structured reason why `handle` refused a command. The UI can switch on
 * `code` to show a translated message or highlight the offending card;
 * `CommandRejected.message` is only a developer-facing fallback.
 */
export type Rejection =
  | { code: 'invalidSeed'; seed: number }
  | { code: 'duplicateInvestigator'; investigatorId: InvestigatorId }
  | { code: 'duplicateCard'; cardId: InstanceId }
  | { code: 'unknownCard'; cardId: InstanceId }
  /** `cardCode` has no definition in the `CardDb` passed to `handle`. */
  | { code: 'unknownCardCode'; cardCode: string }
  | { code: 'unknownInvestigator'; investigatorId: InvestigatorId }
  | { code: 'unknownMap'; mapId: MapId }
  /** `AddMap` names a map that is already on the board. */
  | { code: 'duplicateMap'; mapId: MapId }
  /** `AddMap` names a location that is already in play. */
  | { code: 'cardAlreadyInPlay'; cardId: InstanceId }
  /** Placing `cardId` on `hostId` would make the card (indirectly) host itself. */
  | { code: 'hostingCycle'; cardId: InstanceId; hostId: InstanceId }
  | { code: 'indexOutOfRange'; index: number; max: number }
  | { code: 'invalidTokenDelta'; delta: number }
  /** A starting card's token count is not a non-negative integer. */
  | { code: 'invalidStartingTokens'; cardId: InstanceId; token: TokenKind; amount: number }
  /** `cardId` is used as a location but is not one: not on a map (investigator position, reveal) or not a location card (connection). */
  | { code: 'notALocation'; cardId: InstanceId }
  /** A setup step refers to `cardCode`, but no earlier step created an instance of it. */
  | { code: 'setupTargetNotFound'; cardCode: string }
  /** A setup step refers to `cardCode`, but several instances of it exist. */
  | { code: 'setupTargetAmbiguous'; cardCode: string }
  /** No card in the `CardDb` belongs to `encounterCode` (usually a typo in scenario data). */
  | { code: 'unknownEncounterSet'; encounterCode: string }
  /** `AddConnection` for an edge that already exists. */
  | { code: 'duplicateConnection'; from: InstanceId; to: InstanceId }
  /** `RemoveConnection` for an edge that does not exist. */
  | { code: 'connectionNotFound'; from: InstanceId; to: InstanceId }
  /** A connection from a location to itself. */
  | { code: 'selfConnection'; cardId: InstanceId }
  /** `RevealLocation` for a location that is already face up. */
  | { code: 'alreadyRevealed'; cardId: InstanceId }
  /** The investigator has resigned or been defeated and can no longer act. */
  | { code: 'investigatorNotActive'; investigatorId: InvestigatorId }
  /** `MoveInvestigator` to a location that is not a neighbour of the current one. */
  | { code: 'notConnected'; from: InstanceId; to: InstanceId }
  /** `MoveInvestigator` to the location the investigator is already at. */
  | { code: 'alreadyAtLocation'; investigatorId: InvestigatorId; locationId: InstanceId }
  /** The investigator is not at the location they would take clues from. */
  | { code: 'investigatorNotAtLocation'; investigatorId: InvestigatorId; locationId: InstanceId }
  /** `DiscoverClues` for more clues than the location has. */
  | { code: 'notEnoughClues'; cardId: InstanceId; available: number; requested: number }
  /** An investigator counter would drop below zero. */
  | {
      code: 'negativeInvestigatorStat';
      investigatorId: InvestigatorId;
      stat: InvestigatorStat;
      current: number;
      delta: number;
    }
  /** `PlaceDoom` on a card that is not in play (deck, discard, set aside, …). */
  | { code: 'cardNotInPlay'; cardId: InstanceId }
  /** `AdvanceAgenda`/`AdvanceAct` while that deck has no current card. */
  | { code: 'noCurrentCard'; deck: 'agenda' | 'act' }
  /** The last card of a deck advances, but neither its reverse side nor the command names a resolution. */
  | { code: 'resolutionRequired'; deck: 'agenda' | 'act' }
  /** `AdvanceAgenda`/`AdvanceAct` names a fallback resolution although further cards follow. */
  | { code: 'unexpectedResolution'; deck: 'agenda' | 'act' }
  /** The clues paid for an act do not add up to its requirement. */
  | { code: 'wrongClueTotal'; required: number; spent: number }
  /**
   * The forced effects a command triggered kept triggering each other beyond
   * `MAX_TRIGGERED_COMMANDS` follow-up commands; usually a hook that re-triggers itself.
   */
  | { code: 'triggerLoop'; limit: number }
  /** A command returned by a hook or card effect was rejected for `reason`. */
  | { code: 'triggeredCommandRejected'; command: CommandType; reason: Rejection }
  | {
      code: 'negativeTokens';
      cardId: InstanceId;
      token: TokenKind;
      current: number;
      delta: number;
    };

export type RejectionCode = Rejection['code'];

/** Thrown by `handle` when a command is not valid in the current state. */
export class CommandRejected extends Error {
  /** Machine-readable reason, see `Rejection`. */
  readonly rejection: Rejection;

  constructor(rejection: Rejection) {
    super(describe(rejection));
    this.name = 'CommandRejected';
    this.rejection = rejection;
  }
}

function describe(r: Rejection): string {
  switch (r.code) {
    case 'invalidSeed':
      return `seed must be an integer, got ${r.seed}`;
    case 'duplicateInvestigator':
      return `duplicate investigator ${r.investigatorId}`;
    case 'duplicateCard':
      return `duplicate card id ${r.cardId}`;
    case 'unknownCard':
      return `unknown card ${r.cardId}`;
    case 'unknownCardCode':
      return `no card definition for code ${r.cardCode}`;
    case 'unknownInvestigator':
      return `unknown investigator ${r.investigatorId}`;
    case 'unknownMap':
      return `unknown map ${r.mapId}`;
    case 'duplicateMap':
      return `map ${r.mapId} is already on the board`;
    case 'cardAlreadyInPlay':
      return `${r.cardId} is already in play`;
    case 'hostingCycle':
      return `${r.cardId} cannot be placed on ${r.hostId}: it would host itself`;
    case 'indexOutOfRange':
      return `index ${r.index} out of range 0..${r.max}`;
    case 'invalidTokenDelta':
      return `token delta must be a non-zero integer, got ${r.delta}`;
    case 'invalidStartingTokens':
      return `${r.token} on ${r.cardId} must be a non-negative integer, got ${r.amount}`;
    case 'notALocation':
      return `${r.cardId} is not a location on a map`;
    case 'setupTargetNotFound':
      return `setup refers to ${r.cardCode}, but no such card is available`;
    case 'setupTargetAmbiguous':
      return `setup refers to ${r.cardCode}, which exists more than once`;
    case 'unknownEncounterSet':
      return `no cards in encounter set ${r.encounterCode}`;
    case 'duplicateConnection':
      return `${r.from} and ${r.to} are already connected`;
    case 'connectionNotFound':
      return `no connection between ${r.from} and ${r.to}`;
    case 'selfConnection':
      return `${r.cardId} cannot connect to itself`;
    case 'alreadyRevealed':
      return `${r.cardId} is already revealed`;
    case 'investigatorNotActive':
      return `investigator ${r.investigatorId} is no longer in the scenario`;
    case 'notConnected':
      return `${r.from} is not connected to ${r.to}`;
    case 'alreadyAtLocation':
      return `investigator ${r.investigatorId} is already at ${r.locationId}`;
    case 'investigatorNotAtLocation':
      return `investigator ${r.investigatorId} is not at ${r.locationId}`;
    case 'notEnoughClues':
      return `${r.cardId} has ${r.available} clues, ${r.requested} requested`;
    case 'negativeInvestigatorStat':
      return `${r.stat} of ${r.investigatorId} would become ${r.current + r.delta}`;
    case 'cardNotInPlay':
      return `${r.cardId} is not in play`;
    case 'noCurrentCard':
      return `there is no current ${r.deck}`;
    case 'resolutionRequired':
      return `the last ${r.deck} needs a resolution`;
    case 'unexpectedResolution':
      return `a resolution is only allowed for the last ${r.deck}`;
    case 'wrongClueTotal':
      return `${r.required} clues are required, ${r.spent} spent`;
    case 'triggerLoop':
      return `forced effects triggered more than ${r.limit} follow-up commands`;
    case 'triggeredCommandRejected':
      return `forced effect ${r.command} rejected: ${describe(r.reason)}`;
    case 'negativeTokens':
      return `${r.token} on ${r.cardId} would become ${r.current + r.delta}`;
  }
}
