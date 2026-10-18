import type { EngineContext } from './cards';
import type { AdvanceAct, AdvanceAgenda, Command, CommandType } from './commands';
import { handleDealEnemyAttack } from './attacks_of_opportunity';
import { handleRequestDecision, handleResolveDecision } from './decisions';
import { agendaThresholdDecision } from './doom';
import type { Event } from './events';
import {
  handleAddConnection,
  handleAddMap,
  handleRemoveConnection,
  handleRevealLocation,
} from './handle_board';
import {
  handleDrawEncounter,
  handleFromSetAside,
  handleShuffleEncounterDiscard,
  handleShuffleInto,
  surgeDraw,
} from './handle_encounter';
import {
  handleDamageEnemy,
  handleDefeatEnemy,
  handleDisengageEnemy,
  handleEngageEnemy,
  handleExhaustEnemy,
  handleReadyEnemy,
} from './handle_enemy';
import {
  handleAdjustInvestigator,
  handleDefeatInvestigator,
  handleDiscoverClues,
  handleMoveInvestigator,
  handleSetLeadInvestigator,
} from './handle_investigator';
import { handleManualAdjust, handleMoveCard } from './handle_manual_adjust';
import {
  handleAdvanceAct,
  handleAdvanceAgenda,
  handleEndScenario,
  handlePlaceDoom,
} from './handle_scenario';
import { handleStartScenario } from './handle_start_scenario';
import { handleMoveHunter, handleMoveHunters } from './hunters';
import { handleNextPhase, handleResolveEnemyAttack } from './phases';
import { handleEvade, handleFight, handleInvestigate } from './skill_tests';
import { handleSpawnEnemy } from './spawn';
import type { GameState, HeldAction, QueuedStep } from './state';
import { handleAdjustActions, handleEndTurn, handleResign, handleStartTurn } from './turns';

/**
 * Everything `handle` needs to know about one kind of command, in one place:
 * its handler and the policies the pipeline applies to it. Only `handle` is
 * required; every other field is off when absent, which is the case for most
 * commands.
 */
export interface CommandSpec<C extends Command> {
  /** The command's own events, without the forced effects they trigger. Throws `CommandRejected`. */
  handle(ctx: EngineContext, state: GameState, command: C): Event[];
  /**
   * Set for corrections and setup, which are not game events: fixing a
   * misplaced token must not re-fire "after doom is placed", and cards put
   * out during setup do not "enter play".
   */
  firesNoTriggers?: true;
  /**
   * Accepted from outside while a decision is pending: corrections, and the
   * answer itself. Every other command would act on a state the pending
   * decision is about to change. Follow-ups always run, because they belong
   * to the chain that is allowed.
   */
  allowedWhilePending?: true;
  /**
   * Accepted from outside once the scenario has ended (`GameMeta.ended`):
   * the players may still correct the final board, since a miscounted clue
   * changes what goes to the victory display. Undo works on the log, outside
   * `handle`.
   */
  allowedAfterEnd?: true;
  /**
   * The command as an action that provokes attacks of opportunity, if it is
   * one; `handle` asks only for a player command in that investigator's own
   * turn (`isOwnTurnAction`). The engine does not count actions (the players
   * do, see `Investigator.actionsRemaining`), so it recognises only the
   * action-like commands it sees. `Fight` and `Evade` never provoke: the
   * rules exempt them. `AdjustActions` does not either, even with a negative
   * delta: the players count off the actions the engine saw as well, so
   * treating every -1 as an action would ask twice for the same action, and
   * actions the engine cannot see are left to the players (M1.12 follow-up).
   */
  provokes?(command: C): HeldAction | undefined;
  /**
   * The rest of a command whose rules continue only after the forced effects
   * of its own events (`own`) have resolved. `handle` runs these steps after
   * those effects, and stores them while one of the effects asks the players
   * something.
   */
  continueWith?(command: C, own: readonly Event[]): Continuation[];
}

/**
 * One step of a resolution (`handle`): a `QueuedStep`, or the next of the
 * outstanding phase steps after `NextPhase`. A phase step is never stored:
 * once one waits for the players, they go on with the next "Next".
 */
export type Step = QueuedStep | { kind: 'phaseStep'; origin?: CommandType };

/** The steps a command's spec continues with (`CommandSpec.continueWith`). */
export type Continuation = Exclude<Step, { kind: 'command' | 'action' }>;

/**
 * `AdvanceAgenda`/`AdvanceAct`, continued: the advanced card is replaced
 * once its reverse side has resolved (`completeAdvance`).
 */
function finishAdvance(command: AdvanceAgenda | AdvanceAct, own: readonly Event[]): Continuation[] {
  const advanced = own.find(
    (event) => event.type === 'AgendaAdvanced' || event.type === 'ActAdvanced',
  );
  return advanced ? [{ kind: 'finishAdvance', command, cardId: advanced.cardId }] : [];
}

/** One spec per command type; the mapped type makes a missing or mistyped entry a type error. */
type CommandSpecs = { readonly [K in Command['type']]: CommandSpec<Extract<Command, { type: K }>> };

/** The commands, in the order of the `Command` union; see `CommandSpec` for what each field means. */
const COMMAND_SPECS: CommandSpecs = {
  StartScenario: { handle: handleStartScenario, firesNoTriggers: true },
  ManualAdjust: {
    handle: handleManualAdjust,
    firesNoTriggers: true,
    allowedWhilePending: true,
    allowedAfterEnd: true,
  },
  MoveCard: { handle: (_ctx, state, command) => [handleMoveCard(state, command)] },
  AddMap: { handle: handleAddMap },
  AddConnection: { handle: handleAddConnection },
  RemoveConnection: { handle: handleRemoveConnection },
  RevealLocation: { handle: handleRevealLocation },
  MoveInvestigator: {
    handle: handleMoveInvestigator,
    // A move that ignores connections is always a card effect, never the move action.
    provokes: (command) => (command.ignoreConnections ? undefined : command),
  },
  AdjustInvestigator: {
    handle: (_ctx, state, command) => handleAdjustInvestigator(state, command),
  },
  DefeatInvestigator: {
    handle: (_ctx, state, command) => handleDefeatInvestigator(state, command),
  },
  DiscoverClues: { handle: (_ctx, state, command) => handleDiscoverClues(state, command) },
  PlaceDoom: { handle: (_ctx, state, command) => handlePlaceDoom(state, command) },
  AdvanceAgenda: {
    handle: (_ctx, state, command) => handleAdvanceAgenda(state, command),
    // The reverse side resolves before the next agenda becomes current.
    continueWith: finishAdvance,
  },
  AdvanceAct: {
    handle: handleAdvanceAct,
    continueWith: finishAdvance,
  },
  EndScenario: { handle: (_ctx, _state, command) => handleEndScenario(command) },
  DrawEncounter: {
    handle: handleDrawEncounter,
    // The card's revelation resolves before the card is placed.
    continueWith: (_command, own) => {
      const drawn = own.find((event) => event.type === 'EncounterCardDrawn');
      const surge = surgeDraw(own);
      return [
        ...(drawn ? [{ kind: 'placeDrawnCard' as const, drawn }] : []),
        ...(surge ? [{ kind: 'surge' as const, draw: surge }] : []),
      ];
    },
  },
  FromSetAside: { handle: (_ctx, state, command) => handleFromSetAside(state, command) },
  ShuffleInto: { handle: (_ctx, state, command) => handleShuffleInto(state, command) },
  ShuffleEncounterDiscard: { handle: (_ctx, state) => handleShuffleEncounterDiscard(state) },
  SpawnEnemy: { handle: handleSpawnEnemy },
  EngageEnemy: {
    handle: handleEngageEnemy,
    // The other engaged enemies attack: the one being engaged is not engaged yet, and a massive
    // one cannot be engaged (`massiveNotEngageable`). An engagement by rule (entering a location
    // with a ready enemy) is part of the move, not an `EngageEnemy`.
    provokes: (command) => command,
  },
  DisengageEnemy: { handle: handleDisengageEnemy },
  DamageEnemy: { handle: handleDamageEnemy },
  DefeatEnemy: { handle: handleDefeatEnemy },
  ExhaustEnemy: { handle: handleExhaustEnemy },
  ReadyEnemy: { handle: handleReadyEnemy },
  MoveHunters: { handle: handleMoveHunters },
  MoveHunter: { handle: handleMoveHunter },
  RequestDecision: { handle: handleRequestDecision },
  ResolveDecision: {
    handle: (_ctx, state, command) => handleResolveDecision(state, command),
    allowedWhilePending: true,
  },
  CheckDoomThreshold: { handle: (ctx, state) => agendaThresholdDecision(ctx, state) },
  NextPhase: {
    handle: (ctx, state) => handleNextPhase(ctx, state),
    continueWith: () => [{ kind: 'phaseStep' }],
  },
  StartTurn: { handle: (_ctx, state, command) => handleStartTurn(state, command) },
  EndTurn: { handle: handleEndTurn },
  Resign: { handle: (_ctx, state, command) => handleResign(state, command) },
  SetLeadInvestigator: {
    handle: (_ctx, state, command) => handleSetLeadInvestigator(state, command),
  },
  AdjustActions: { handle: (_ctx, state, command) => handleAdjustActions(state, command) },
  ResolveEnemyAttack: { handle: handleResolveEnemyAttack },
  DealEnemyAttack: { handle: handleDealEnemyAttack },
  Investigate: { handle: handleInvestigate, provokes: (command) => command },
  Fight: { handle: handleFight },
  Evade: { handle: handleEvade },
};

/** The spec of `command`'s type (`CommandSpec`). */
export function commandSpec<C extends Command>(command: C): CommandSpec<C> {
  // TypeScript cannot correlate `command.type` with the mapped entry; `CommandSpecs` guarantees it.
  return COMMAND_SPECS[command.type] as unknown as CommandSpec<C>;
}
