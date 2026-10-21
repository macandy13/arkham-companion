import { abilitySteps, windowsOpenedBy, type AbilityStep } from './abilities';
import type { EngineContext } from './cards';
import type { Command } from './commands';
import { isInPlay } from './doom';
import type {
  ActAdvanced,
  AgendaAdvanced,
  CardMoved,
  EnemyDefeated,
  Event,
  RoundEnded,
  TokensChanged,
  TurnEnded,
} from './events';
import type { InstanceId } from './ids';
import { apply } from './reducer';
import type { GameState, QueuedStep } from './state';

/**
 * A forced effect as code: given the state after the triggering command and
 * the event that triggered it, returns the commands that resolve the effect.
 * Hooks return commands rather than events so that `handle` validates their
 * effect and they can use card data and the RNG like any player command
 * (architecture "Triggers and card effects"). Must be pure; an empty list means "nothing happens".
 */
export type TriggerHook<E extends Event> = (
  ctx: EngineContext,
  state: GameState,
  event: E,
) => readonly Command[];

/**
 * Scenario-wide forced effects (architecture "Triggers and card effects"), set on
 * `ScenarioDefinition.hooks`; the engine reads them from `EngineContext.scenario`.
 * Each fires once per matching event.
 */
export interface ScenarioHooks {
  /** After doom is placed on any card in play (a positive doom `TokensChanged`). */
  afterDoomPlaced: TriggerHook<TokensChanged>;
  /**
   * The reverse side of an agenda, keyed by the code of the agenda that
   * advanced. Runs while that agenda is still current (the next one becomes
   * current afterwards); returning `EndScenario` names the resolution.
   */
  onAgendaAdvance: Readonly<Record<string, TriggerHook<AgendaAdvanced>>>;
  /** The reverse side of an act, keyed by the code of the act that advanced. */
  onActAdvance: Readonly<Record<string, TriggerHook<ActAdvanced>>>;
  /** At the end of each round, the last step of the upkeep phase (`RoundEnded`). */
  onRoundEnd: TriggerHook<RoundEnded>;
  /**
   * At the end of an investigator's turn (`TurnEnded`, from `EndTurn`). A
   * turn cut short by resignation or defeat fires nothing: the investigator
   * has left the scenario, and with them what their turn end would affect.
   * A treachery's own end-of-turn test needs no hook: it is a card ability
   * (`atEndOfTurn`).
   */
  onTurnEnd: TriggerHook<TurnEnded>;
  /** After any card enters play from outside play (deck, set aside, discard, …). */
  onCardEnters: TriggerHook<CardMoved>;
  /**
   * After an enemy is defeated (`EnemyDefeated`), e.g. an act whose objective
   * is "if the Ghoul Priest is defeated, advance". The hook sees the enemy
   * already in its discard pile or the victory display.
   */
  afterEnemyDefeated: TriggerHook<EnemyDefeated>;
}

/**
 * Upper bound on the follow-up commands one player command may cause, counted
 * over the whole chain. Real forced-effect chains are a handful of steps, so
 * reaching it means a hook keeps re-triggering itself.
 */
export const MAX_TRIGGERED_COMMANDS = 50;

/** A forced effect to resolve: a hook's command, or one effect of a card ability. */
export type TriggeredStep = Extract<QueuedStep, { kind: 'command' }> | AbilityStep;

/** A hook or ability that matched an event, not yet evaluated. */
type PendingTrigger = (state: GameState) => readonly TriggeredStep[];

/**
 * The follow-up steps the scenario hooks in `ctx` and the card abilities in
 * its card data return for `events`, which a command produced from
 * `before`: a hook's commands, and each ability effect as a step of its own
 * that resolves when its turn comes (`resolveEffect`). Hooks match against the state right before each event (to tell
 * whether a card entered play) but are evaluated against the state after all
 * of them, so every hook sees the command's complete outcome. Order: by
 * event, scenario hooks before card abilities.
 */
export function triggeredSteps(
  ctx: EngineContext,
  before: GameState,
  events: readonly Event[],
): TriggeredStep[] {
  const pending: PendingTrigger[] = [];
  let state = before;
  for (const event of events) {
    const next = apply(state, event);
    pending.push(...matchingTriggers(ctx, state, next, event));
    pending.push(
      ...windowsOpenedBy(next, event, events).map(
        (opened) => (after: GameState) => abilitySteps(ctx, after, opened),
      ),
    );
    state = next;
  }
  return pending.flatMap((trigger) => trigger(state));
}

function matchingTriggers(
  ctx: EngineContext,
  before: GameState,
  after: GameState,
  event: Event,
): PendingTrigger[] {
  const hooks = ctx.scenario?.hooks ?? {};
  const forCard = <T>(registry: Readonly<Record<string, T>> | undefined, cardId: InstanceId) => {
    const code = after.cards[cardId]?.code;
    return code === undefined ? undefined : registry?.[code];
  };
  const bind = <E extends Event>(hook: TriggerHook<E> | undefined, e: E): PendingTrigger[] =>
    hook ? [(state) => hook(ctx, state, e).map(followUpStep)] : [];
  switch (event.type) {
    case 'TokensChanged':
      return event.token === 'doom' && event.delta > 0 ? bind(hooks.afterDoomPlaced, event) : [];
    case 'AgendaAdvanced':
      return bind(forCard(hooks.onAgendaAdvance, event.cardId), event);
    case 'ActAdvanced':
      return bind(forCard(hooks.onActAdvance, event.cardId), event);
    case 'CardMoved':
      return entersPlay(before, after, event) ? bind(hooks.onCardEnters, event) : [];
    case 'RoundEnded':
      return bind(hooks.onRoundEnd, event);
    case 'TurnEnded':
      return bind(hooks.onTurnEnd, event);
    case 'EnemyDefeated':
      return bind(hooks.afterEnemyDefeated, event);
    default:
      return [];
  }
}

/** A follow-up command as a step of its own, naming its type as the origin a rejection reports. */
export function followUpStep(command: Command): TriggeredStep {
  return { kind: 'command', command, origin: command.type };
}

function entersPlay(before: GameState, after: GameState, event: CardMoved): boolean {
  const was = before.cards[event.cardId];
  const is = after.cards[event.cardId];
  return was !== undefined && is !== undefined && !isInPlay(before, was) && isInPlay(after, is);
}
