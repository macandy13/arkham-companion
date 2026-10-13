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
  | { code: 'unknownInvestigator'; investigatorId: InvestigatorId }
  | { code: 'unknownMap'; mapId: MapId }
  /** Placing `cardId` on `hostId` would make the card (indirectly) host itself. */
  | { code: 'hostingCycle'; cardId: InstanceId; hostId: InstanceId }
  | { code: 'indexOutOfRange'; index: number; max: number }
  | { code: 'invalidTokenDelta'; delta: number }
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
    case 'negativeTokens':
      return `${r.token} on ${r.cardId} would become ${r.current + r.delta}`;
  }
}
