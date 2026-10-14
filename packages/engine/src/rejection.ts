import type { InstanceId, InvestigatorId, MapId } from './ids';
import type { TokenKind } from './state';

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
  /** Placing `cardId` on `hostId` would make the card (indirectly) host itself. */
  | { code: 'hostingCycle'; cardId: InstanceId; hostId: InstanceId }
  | { code: 'indexOutOfRange'; index: number; max: number }
  | { code: 'invalidTokenDelta'; delta: number }
  /** A starting card's token count is not a non-negative integer. */
  | { code: 'invalidStartingTokens'; cardId: InstanceId; token: TokenKind; amount: number }
  /** `cardId` is used as a location (investigator position, connection) but is not on a map. */
  | { code: 'notALocation'; cardId: InstanceId }
  /** A connection of map `mapId` ends at `cardId`, a location on a different map. */
  | { code: 'locationOnOtherMap'; cardId: InstanceId; mapId: MapId }
  /** A setup step refers to `cardCode`, but no earlier step created an instance of it. */
  | { code: 'setupTargetNotFound'; cardCode: string }
  /** A setup step refers to `cardCode`, but several instances of it exist. */
  | { code: 'setupTargetAmbiguous'; cardCode: string }
  /** No card in the `CardDb` belongs to `encounterCode` (usually a typo in scenario data). */
  | { code: 'unknownEncounterSet'; encounterCode: string }
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
    case 'locationOnOtherMap':
      return `a connection of map ${r.mapId} ends at ${r.cardId}, which is on another map`;
    case 'setupTargetNotFound':
      return `setup refers to ${r.cardCode}, which no earlier step created`;
    case 'setupTargetAmbiguous':
      return `setup refers to ${r.cardCode}, which exists more than once`;
    case 'unknownEncounterSet':
      return `no cards in encounter set ${r.encounterCode}`;
    case 'negativeTokens':
      return `${r.token} on ${r.cardId} would become ${r.current + r.delta}`;
  }
}
