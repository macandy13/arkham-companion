import type { CommandType, EncounterMatch, EncounterSource } from './commands';
import type { DecisionId, InstanceId, InvestigatorCode, InvestigatorId, MapId } from './ids';
import type { InvestigatorStat, Phase, TokenKind } from './state';

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
  /** A seat in `SetupOptions` names a code that has no card in the `EngineContext`'s `InvestigatorDb`. */
  | { code: 'unknownInvestigatorCard'; investigatorCode: InvestigatorCode }
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
  /** A command after the scenario ended (`GameMeta.ended`); only `ManualAdjust` is still accepted. */
  | { code: 'scenarioEnded'; command: CommandType }
  /** `AdvanceAgenda`/`AdvanceAct` names a fallback resolution although further cards follow. */
  | { code: 'unexpectedResolution'; deck: 'agenda' | 'act' }
  /** `AdvanceAct` pays clues for an act whose card data has no clue threshold. */
  | { code: 'noClueThreshold'; cardId: InstanceId }
  /** The clues paid for an act do not add up to its requirement. */
  | { code: 'wrongClueTotal'; required: number; spent: number }
  /**
   * The forced effects a command triggered kept triggering each other beyond
   * `MAX_TRIGGERED_COMMANDS` follow-up commands; usually a hook that re-triggers itself.
   */
  /** `DrawEncounter` with the encounter deck and its discard both empty. */
  | { code: 'encounterDeckEmpty' }
  /** `DrawEncounter` brought an enemy for an investigator who is not at a location. */
  | { code: 'investigatorHasNoLocation'; investigatorId: InvestigatorId }
  /** `DrawEncounter` with a `match` that no card of the searched `from` encounter cards fulfils. */
  | { code: 'noMatchingCard'; from: EncounterSource; match: EncounterMatch }
  /** No card with code `match` is set aside. */
  | { code: 'cardNotInZone'; zone: 'setAside'; match: string }
  /** An enemy command names a card whose type is not `enemy`. */
  | { code: 'notAnEnemy'; cardId: InstanceId }
  /** `SpawnEnemy` for an enemy that is already in play. */
  | { code: 'enemyAlreadyInPlay'; cardId: InstanceId }
  /** An enemy command (engage, damage, exhaust, …) for an enemy that is not in play. */
  | { code: 'enemyNotInPlay'; cardId: InstanceId }
  /** `SpawnEnemy` without `at`, a unique `spawn` location or a drawing investigator. */
  | { code: 'noSpawnLocation'; cardId: InstanceId }
  /** `EngageEnemy` for the investigator the enemy is already engaged with. */
  | { code: 'alreadyEngaged'; cardId: InstanceId; investigatorId: InvestigatorId }
  /** `DisengageEnemy` for an enemy that is not engaged. */
  | { code: 'notEngaged'; cardId: InstanceId }
  /**
   * `Fight` against an aloof enemy nobody is engaged with (Rules Reference,
   * "Aloof"); it has to be engaged first, e.g. with the Engage action.
   */
  | { code: 'aloofNotEngaged'; cardId: InstanceId }
  /**
   * `EngageEnemy` for a massive enemy: it is never placed in a threat area but
   * counts as engaged with every investigator at its location (Rules
   * Reference, "Massive"), so there is nothing to engage.
   */
  | { code: 'massiveNotEngageable'; cardId: InstanceId }
  /** Exhausting an exhausted card or readying a ready one. */
  | { code: 'exhaustUnchanged'; cardId: InstanceId; exhausted: boolean }
  /** A hunter command names an enemy that is not an unengaged hunter at a location. */
  | { code: 'notAHunter'; cardId: InstanceId }
  /** `MoveHunter` to a location that is not connected to the hunter's. */
  | { code: 'hunterCannotMove'; cardId: InstanceId; to: InstanceId }
  /** `MoveHunter` towards an investigator the hunter cannot reach. */
  | { code: 'noRoute'; cardId: InstanceId; investigatorId: InvestigatorId }
  /** A command other than `ManualAdjust`/`ResolveDecision` while `decisionId` is pending. */
  | { code: 'decisionPending'; decisionId: DecisionId }
  /** `RequestDecision` with an id that is already pending. */
  | { code: 'duplicateDecision'; decisionId: DecisionId }
  /** `RequestDecision` without options, or with two options of the same id. */
  | { code: 'invalidDecisionOptions'; decisionId: DecisionId }
  /** `ResolveDecision` for a decision that is not pending. */
  | { code: 'unknownDecision'; decisionId: DecisionId }
  /** `ResolveDecision` with an option the decision does not have. */
  | { code: 'unknownOption'; decisionId: DecisionId; optionId: string }
  /** A skill test modifier that is not a whole number. */
  | { code: 'invalidModifierAmount'; amount: number }
  /** `NextPhase` while an enemy attack of the enemy phase still has to be resolved. */
  | { code: 'enemyAttackPending'; enemyId: InstanceId; investigatorId: InvestigatorId }
  /** `ResolveEnemyAttack` for an attack that is not an outstanding, due step. */
  | { code: 'attackNotDue'; enemyId: InstanceId; investigatorId: InvestigatorId }
  /** `ResolveEnemyAttack` with damage or horror that is not a non-negative integer. */
  | { code: 'invalidAttackAmount'; amount: number }
  /** A command that belongs to another phase (e.g. `EndTurn` outside investigation). */
  | { code: 'wrongPhase'; expected: Phase; actual: Phase }
  /** `EndTurn` for an investigator who has already taken their turn this round. */
  | { code: 'turnAlreadyTaken'; investigatorId: InvestigatorId }
  /** `SetLeadInvestigator` for the investigator who already is the lead. */
  | { code: 'alreadyLeadInvestigator'; investigatorId: InvestigatorId }
  /** `StartTurn` while another turn is in progress, or `NextPhase` before it ended. */
  | { code: 'turnInProgress'; investigatorId: InvestigatorId }
  /**
   * `EndTurn` for an investigator whose turn is not in progress
   * (`activeInvestigatorId`: whose is, if any).
   */
  | {
      code: 'turnNotInProgress';
      investigatorId: InvestigatorId;
      activeInvestigatorId?: InvestigatorId;
    }
  /** `AdjustActions` with a delta that is zero, fractional or takes the remaining actions below zero. */
  | {
      code: 'invalidActionAdjustment';
      investigatorId: InvestigatorId;
      delta: number;
      actionsRemaining: number;
    }
  /** `NextPhase` out of investigation while these active investigators have not taken their turn. */
  | { code: 'turnsNotTaken'; investigatorIds: InvestigatorId[] }
  /**
   * `ResolveDecision` with an `amount` (or a named one in `amounts`, then
   * `name`) for an option that has no such adjustable count.
   */
  | { code: 'amountNotAdjustable'; decisionId: DecisionId; optionId: string; name?: string }
  /** `ResolveDecision` with an `amount` (or the named one `name`) outside the option's range. */
  | {
      code: 'amountOutOfRange';
      decisionId: DecisionId;
      optionId: string;
      name?: string;
      amount: number;
      min: number;
      max?: number;
    }
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
    case 'unknownInvestigatorCard':
      return `no investigator card ${r.investigatorCode}`;
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
    case 'scenarioEnded':
      return `the scenario has ended, ${r.command} is not possible any more`;
    case 'unexpectedResolution':
      return `a resolution is only allowed for the last ${r.deck}`;
    case 'noClueThreshold':
      return `${r.cardId} has no clue threshold to pay`;
    case 'wrongClueTotal':
      return `${r.required} clues are required, ${r.spent} spent`;
    case 'encounterDeckEmpty':
      return 'the encounter deck and its discard are empty';
    case 'investigatorHasNoLocation':
      return `investigator ${r.investigatorId} is not at a location`;
    case 'noMatchingCard':
      return `no card matching ${JSON.stringify(r.match)} in ${r.from}`;
    case 'cardNotInZone':
      return `no ${r.match} in ${r.zone}`;
    case 'notAnEnemy':
      return `${r.cardId} is not an enemy`;
    case 'enemyAlreadyInPlay':
      return `${r.cardId} is already in play`;
    case 'enemyNotInPlay':
      return `${r.cardId} is not in play`;
    case 'noSpawnLocation':
      return `no spawn location for ${r.cardId}`;
    case 'alreadyEngaged':
      return `${r.cardId} is already engaged with ${r.investigatorId}`;
    case 'notEngaged':
      return `${r.cardId} is not engaged`;
    case 'aloofNotEngaged':
      return `${r.cardId} is aloof and must be engaged before it can be attacked`;
    case 'massiveNotEngageable':
      return `${r.cardId} is massive and already engaged with everyone at its location`;
    case 'exhaustUnchanged':
      return `${r.cardId} is already ${r.exhausted ? 'exhausted' : 'ready'}`;
    case 'notAHunter':
      return `${r.cardId} is not an unengaged hunter at a location`;
    case 'hunterCannotMove':
      return `${r.cardId} cannot move to ${r.to}`;
    case 'noRoute':
      return `${r.cardId} has no route to ${r.investigatorId}`;
    case 'decisionPending':
      return `decision ${r.decisionId} must be resolved first`;
    case 'duplicateDecision':
      return `decision ${r.decisionId} is already pending`;
    case 'invalidDecisionOptions':
      return `decision ${r.decisionId} needs at least one option, each with a unique id`;
    case 'unknownDecision':
      return `no pending decision ${r.decisionId}`;
    case 'unknownOption':
      return `decision ${r.decisionId} has no option ${r.optionId}`;
    case 'invalidModifierAmount':
      return `skill test modifier ${r.amount} is not allowed here`;
    case 'enemyAttackPending':
      return `the attack of ${r.enemyId} on ${r.investigatorId} must be resolved first`;
    case 'attackNotDue':
      return `${r.enemyId} has no attack on ${r.investigatorId} to resolve`;
    case 'invalidAttackAmount':
      return `attack damage and horror must be non-negative integers, got ${r.amount}`;
    case 'wrongPhase':
      return `only allowed in the ${r.expected} phase, not in ${r.actual}`;
    case 'turnAlreadyTaken':
      return `investigator ${r.investigatorId} has already taken their turn this round`;
    case 'alreadyLeadInvestigator':
      return `investigator ${r.investigatorId} is already the lead investigator`;
    case 'turnInProgress':
      return `the turn of ${r.investigatorId} is still in progress`;
    case 'turnNotInProgress':
      return r.activeInvestigatorId === undefined
        ? `no turn is in progress, so ${r.investigatorId} cannot end one`
        : `it is the turn of ${r.activeInvestigatorId}, not ${r.investigatorId}`;
    case 'invalidActionAdjustment':
      return `cannot change the ${r.actionsRemaining} remaining actions of ${r.investigatorId} by ${r.delta}`;
    case 'turnsNotTaken':
      return `the investigation phase ends after each turn; still to go: ${r.investigatorIds.join(', ')}`;
    case 'amountNotAdjustable':
      return `option ${r.optionId} of decision ${r.decisionId} has no adjustable ${r.name ?? 'amount'}`;
    case 'amountOutOfRange':
      return `${r.name ?? 'amount'} of option ${r.optionId} of decision ${r.decisionId} takes ${r.min}${r.max === undefined ? ' or more' : `–${r.max}`}, got ${r.amount}`;
    case 'triggerLoop':
      return `forced effects triggered more than ${r.limit} follow-up commands`;
    case 'triggeredCommandRejected':
      return `forced effect ${r.command} rejected: ${describe(r.reason)}`;
    case 'negativeTokens':
      return `${r.token} on ${r.cardId} would become ${r.current + r.delta}`;
  }
}
