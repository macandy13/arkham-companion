import type { TFunction } from 'i18next';
import type {
  CardMoved,
  ChangeCause,
  EngineContext,
  Event,
  GameState,
  InstanceId,
  InvestigatorId,
  InvestigatorStat,
  LoggedEvent,
  EventType,
  Phase,
  PlayerCardCommand,
  Reliance,
  SkillTestResolved,
  TokenKind,
} from '@arkham/engine';
import { DEFAULT_RELIANCE, noticeKindOf, PHASE_OF_STEP, showsNotice } from '@arkham/engine';
import { assertNever, runsBy } from '@arkham/util';
import type { GameLogSource } from '../state/appStore';

/**
 * One line of the log: what one event did, in words, with the event it tells and who did it (the
 * investigator it names, or the enemy that engaged or attacked), for a reader that sorts or marks
 * lines by kind or actor.
 */
export interface LogLine {
  readonly event: EventType;
  /** The printed name of who did it; absent for what the game does by itself (doom, shuffles). */
  readonly actor?: string;
  readonly text: string;
  /**
   * Why the game did it by itself, in words: the card whose forced ability it was ("Rotting
   * Remains") or the step of the round ("mythos phase"). Absent for what the players did.
   */
  readonly cause?: string;
}

/**
 * One step of the game as the log shows it: the events of one undo group (`LoggedEvent.commandId`,
 * the unit `GameSession.undo` takes back) as readable lines, in the order they happened, with the
 * round and phase it ended in, whose turn it was and when it was stored.
 */
export interface LogStep {
  /** The `LoggedEvent.commandId` of the step's undo group, which a jump back names. */
  readonly id: string;
  /** The round and phase the game is in after the step; a step that starts a phase belongs to it. */
  readonly round: number;
  readonly phase: Phase;
  /** The investigator whose turn the step was taken in (or began); absent outside turns. */
  readonly actor?: string;
  /** When the step was stored (epoch ms, `StoredEvent.timestamp`); absent until it is. */
  readonly timestamp?: number;
  readonly lines: readonly LogLine[];
  /**
   * How many undo groups came after it, the ones without a line included: what going back to it
   * takes back (`GameSession.undoTo`).
   */
  readonly later: number;
}

/**
 * The game log `entries` as steps (`LogStep`), oldest first. A step whose events are all
 * bookkeeping has no line and is left out. `state` is the game after `entries`; it names the cards
 * and investigators, which stay in the state once set up. `stepTimes` holds when each stored step
 * was stored, by its `commandId`.
 */
export function gameLog(
  t: TFunction,
  ctx: EngineContext,
  state: GameState,
  { entries, stepTimes }: Pick<GameLogSource, 'entries' | 'stepTimes'>,
): LogStep[] {
  let round = 0;
  let phase: Phase = 'setup';
  let turn: InvestigatorId | undefined;
  const names = namesIn(ctx, state);
  const runs = runsBy(entries, (entry) => entry.commandId);
  return runs.flatMap(({ key, items }, index) => {
    const turnAtStart = turn;
    for (const { event } of items) {
      if (event.type === 'PhaseChanged') ({ round, phase } = event);
      if (event.type === 'TurnStarted') turn = event.investigatorId;
      if (event.type === 'TurnEnded') turn = undefined;
    }
    // The heading names the phase, so a phase step's cause would only repeat it.
    const lines = eventLines(t, ctx, state, items, phase);
    if (lines.length === 0) return [];
    const actor = turnAtStart ?? turn;
    const timestamp = stepTimes.get(key);
    return [
      {
        id: key,
        round,
        phase,
        ...(actor === undefined ? {} : { actor: names.investigator(actor) }),
        ...(timestamp === undefined ? {} : { timestamp }),
        lines,
        later: runs.length - 1 - index,
      },
    ];
  });
}

/** Steps of one round and phase, for a heading over them. */
export interface LogSection {
  readonly round: number;
  readonly phase: Phase;
  readonly steps: readonly LogStep[];
}

/**
 * `steps` (oldest first, as `gameLog` lists them) cut into the runs of one round and phase, in the
 * same order, so the log reads down like the game was played.
 */
export function logSections(steps: readonly LogStep[]): LogSection[] {
  return runsBy(steps, (step) => `${step.round}:${step.phase}`).map(({ items }) => ({
    round: items[0]?.round ?? 0,
    phase: items[0]?.phase ?? 'setup',
    steps: items,
  }));
}

/**
 * What `entries` (one step's) did, one line per event the players care about, with its cause when
 * the game did it by itself, unless the cause is a step of `headingPhase`, which the reader sees
 * named already. Bookkeeping that only the engine reads (phase steps, queues, decisions
 * asked, map layout, exhaustion) has no line, and neither have the counters a clue discovery
 * moves, since its own line says it all.
 */
export function eventLines(
  t: TFunction,
  ctx: EngineContext,
  state: GameState,
  entries: readonly LoggedEvent[],
  headingPhase?: Phase,
): LogLine[] {
  const discoveries = entries.flatMap(({ event }) =>
    event.type === 'CluesDiscovered' ? [event] : [],
  );
  const names = namesIn(ctx, state);
  return entries.flatMap(({ event, cause }) => {
    // A discovery is the only clue change of its step: no rule moves clues while a test resolves.
    const isDiscovery =
      (event.type === 'TokensChanged' &&
        event.token === 'clue' &&
        discoveries.some((found) => found.locationId === event.cardId)) ||
      (event.type === 'InvestigatorChanged' &&
        event.stat === 'clues' &&
        discoveries.some((found) => found.investigatorId === event.investigatorId));
    if (isDiscovery) return [];
    const text = eventLine(t, names, state, event);
    if (text === undefined) return [];
    const actor = actorOf(names, event);
    const told =
      cause === undefined || (cause.kind === 'rule' && PHASE_OF_STEP[cause.step] === headingPhase);
    const why = told ? undefined : causeOf(t, names, cause);
    return [
      {
        event: event.type,
        ...(actor === undefined ? {} : { actor }),
        text,
        ...(why === undefined ? {} : { cause: why }),
      },
    ];
  });
}

/** The words for why the game did something by itself; none for what the players did. */
function causeOf(t: TFunction, names: Names, cause: ChangeCause): string | undefined {
  switch (cause.kind) {
    case 'player':
      return undefined;
    case 'card':
      return names.card(cause.cardId);
    case 'rule':
      return t(`log.cause.${cause.step}`);
    default:
      return assertNever(cause);
  }
}

/**
 * Events the screen already tells another way: where the game is (the phase tracker, the turn
 * controls) and the encounter cards drawn (`DrawnCardsNotice`).
 */
const TOLD_ELSEWHERE: ReadonlySet<EventType> = new Set<EventType>([
  'PhaseChanged',
  'RoundEnded',
  'TurnStarted',
  'TurnEnded',
  'EncounterCardDrawn',
]);

/**
 * What the game changed by itself in a step: its id (`LoggedEvent.commandId`) and what it did, in
 * the log's words (`eventLines`).
 */
export interface AutomaticChanges {
  readonly step: string;
  readonly lines: readonly LogLine[];
}

/**
 * What the game did by itself in the last step of `entries` (M3.13a, M1C.2): the lines of the
 * events a rule or a card's forced ability caused (`LoggedEvent.cause`), but those the screen tells
 * another way (`TOLD_ELSEWHERE`): the doom of the mythos phase, the resources of the upkeep, the
 * horror a treachery deals, of the kinds the players' `reliance` on the helpers shows
 * (`showsNotice`). `undefined` when the players did all of the step themselves.
 */
export function automaticChanges(
  t: TFunction,
  ctx: EngineContext,
  state: GameState,
  entries: readonly LoggedEvent[],
  reliance: Reliance = DEFAULT_RELIANCE,
): AutomaticChanges | undefined {
  const last = runsBy(entries, (entry) => entry.commandId).at(-1);
  if (last === undefined) return undefined;
  const automatic = last.items.filter(({ event, cause }) => {
    const kind = noticeKindOf(event);
    return cause !== undefined && (kind === undefined || showsNotice(reliance, kind));
  });
  const lines = eventLines(t, ctx, state, automatic).filter(
    (line) => !TOLD_ELSEWHERE.has(line.event),
  );
  return lines.length === 0 ? undefined : { step: last.key, lines };
}

/** Who did what `event` tells: the enemy that engaged or attacked, else the investigator it names. */
function actorOf(names: Names, event: Event): string | undefined {
  if (event.type === 'EnemyEngaged' || event.type === 'EnemyAttacked') {
    return names.card(event.enemyId);
  }
  return 'investigatorId' in event && event.investigatorId !== undefined
    ? names.investigator(event.investigatorId)
    : undefined;
}

/** The printed names of the cards and investigators of `state`. */
function namesIn(ctx: EngineContext, state: GameState): Names {
  return {
    card: (id) => {
      const code = state.cards[id]?.code;
      // A card the state doesn't know (a log from other data) has no name; its id is all there is.
      return (code && ctx.cards.get(code)?.name) ?? id;
    },
    investigator: (id) => state.investigators.find((inv) => inv.id === id)?.name ?? id,
  };
}

/** Printed names of the cards and investigators an event refers to. */
interface Names {
  card(id: InstanceId): string;
  investigator(id: InvestigatorId): string;
}

/** The line for one event, or none for bookkeeping. */
function eventLine(t: TFunction, names: Names, state: GameState, event: Event): string | undefined {
  switch (event.type) {
    case 'ScenarioStarted':
      return t('log.scenarioStarted');
    case 'ScenarioEnded':
      return event.resolution === undefined
        ? t('log.scenarioEndedUnresolved')
        : t('log.scenarioEnded', { resolution: event.resolution });
    case 'DeckShuffled':
      return event.zone.kind === 'encounterDeck' ? t('log.encounterDeckShuffled') : undefined;
    case 'CardMoved':
      return cardMovedLine(t, names, event);
    case 'CardFlipped':
      // Agendas and acts turn over as they advance, which their own line says.
      return event.faceUp && state.cards[event.cardId]?.zone.kind === 'location'
        ? t('log.revealed', { card: names.card(event.cardId) })
        : undefined;
    case 'TokensChanged':
      return t(event.delta > 0 ? 'log.tokensPlaced' : 'log.tokensRemoved', {
        amount: amount(t, event.token, event.delta),
        card: names.card(event.cardId),
      });
    case 'ChaosBagChanged':
      return t(`log.chaosBag.${event.change}.${event.lasts}`, {
        token: t(`chaosToken.${event.token}`),
      });
    case 'InvestigatorChanged':
      return t(`log.investigator.${event.stat}.${event.delta > 0 ? 'up' : 'down'}`, {
        investigator: names.investigator(event.investigatorId),
        amount: amount(t, STAT_TOKENS[event.stat], event.delta),
      });
    case 'InvestigatorMoved':
      return t(event.from === undefined ? 'log.placedAt' : 'log.moved', {
        investigator: names.investigator(event.investigatorId),
        location: names.card(event.to),
      });
    case 'InvestigatorDefeated':
      return t('log.defeated', { investigator: names.investigator(event.investigatorId) });
    case 'InvestigatorResigned':
      return t('log.resigned', { investigator: names.investigator(event.investigatorId) });
    case 'LeadInvestigatorChanged':
      return t('log.lead', { investigator: names.investigator(event.investigatorId) });
    case 'AgendaAdvanced':
      return t('log.agendaAdvanced', { card: names.card(event.cardId) });
    case 'ActAdvanced':
      return t('log.actAdvanced', { card: names.card(event.cardId) });
    case 'EncounterCardDrawn':
      return t('log.drawn', {
        investigator: names.investigator(event.investigatorId),
        card: names.card(event.cardId),
      });
    case 'SurgeGained':
      return t('log.surge', { card: names.card(event.cardId) });
    case 'CardActionUsed':
      return t('log.cardAction', {
        investigator: names.investigator(event.investigatorId),
        card: names.card(event.cardId),
      });
    case 'CommandDeferred':
      return playerCardLine(t, names, event.command);
    case 'CluesDiscovered':
      return t('log.discovered', {
        investigator: names.investigator(event.investigatorId),
        amount: amount(t, 'clue', event.amount),
        location: names.card(event.locationId),
      });
    case 'SkillTestResolved':
      return testLine(t, names, event);
    case 'EnemyEngaged':
      return t('log.engaged', {
        enemy: names.card(event.enemyId),
        investigator: names.investigator(event.investigatorId),
      });
    case 'EnemyAttacked':
      return t('log.attacked', {
        enemy: names.card(event.enemyId),
        investigator: names.investigator(event.investigatorId),
      });
    case 'EnemyEvaded':
      return t('log.evaded', {
        enemy: names.card(event.enemyId),
        investigator: names.investigator(event.investigatorId),
      });
    case 'EnemyDefeated':
      return t('log.enemyDefeated', { enemy: names.card(event.enemyId) });
    case 'PhaseChanged':
      // The round and phase head the steps in it (`LogStep`); the line says only that one began.
      return t('log.phaseBegins', { phase: t(`games.phases.${event.phase}`) });
    case 'RoundEnded':
      return t('log.roundEnded', { round: event.round });
    case 'TurnStarted':
      return t('log.turnStarted', { investigator: names.investigator(event.investigatorId) });
    case 'TurnEnded':
      return t('log.turnEnded', { investigator: names.investigator(event.investigatorId) });
    // The players see the question in the decision dialog and its answer in the lines that follow;
    // the rest is the engine's own bookkeeping, or a notice the play screen shows by itself.
    case 'MapAdded':
    case 'LayoutCellSet':
    case 'ConnectionChanged':
    case 'DecisionRequested':
    case 'DecisionResolved':
    case 'CurrentCardChanged':
    case 'AbilityEffectSkipped':
    case 'EnemyDisengaged':
    case 'ExhaustChanged':
    case 'PhaseStepsChanged':
    case 'ActionsAdjusted':
    case 'SkillBoostChanged':
    case 'ActionsReset':
    case 'StepsQueued':
    case 'StepResumed':
    case 'ActionDropped':
      return undefined;
    default:
      return assertNever(event);
  }
}

/**
 * A location put into play, or an enemy spawning at or moving to a location; other moves (a card
 * discarded, set aside, attached) follow from a line of their own, such as the draw or the defeat.
 */
function cardMovedLine(t: TFunction, names: Names, { cardId, from, to }: CardMoved) {
  if (to.kind === 'location') return t('log.entersPlay', { card: names.card(cardId) });
  if (to.kind !== 'atLocation') return undefined;
  const fromPlay = from.kind === 'atLocation' || from.kind === 'engaged';
  return t(fromPlay ? 'log.enemyMoved' : 'log.spawned', {
    enemy: names.card(cardId),
    location: names.card(to.locationId),
  });
}

/** What an investigator does with their own cards, which the players carry out at the table. */
function playerCardLine(t: TFunction, names: Names, command: PlayerCardCommand): string {
  const investigator = names.investigator(command.investigatorId);
  switch (command.type) {
    case 'DrawCards':
      return t('log.playerCards.draw', { investigator, count: command.amount });
    case 'DiscardFromHand':
      return t('log.playerCards.discard', { investigator, count: command.amount });
    case 'PlayCard':
      return t('log.playerCards.play', { investigator });
    case 'SearchDeck':
      return t('log.playerCards.search', { investigator });
    default:
      return assertNever(command);
  }
}

/** The token each investigator counter counts, to name its amount. */
const STAT_TOKENS: Readonly<Record<InvestigatorStat, TokenKind>> = {
  damage: 'damage',
  horror: 'horror',
  clues: 'clue',
  resources: 'resource',
  doomOnPlayerCards: 'doom',
};

/** "2 doom", "1 clue": `delta` tokens of `token`, whichever way they went. */
function amount(t: TFunction, token: TokenKind, delta: number): string {
  return t(`log.amount.${token}`, { count: Math.abs(delta) });
}

/** "Roland Banks: Willpower test (4) failed by 2", without a name when no one investigator tested. */
function testLine(t: TFunction, names: Names, event: SkillTestResolved): string {
  const { skill, difficulty } = event.skillTest;
  const key = event.margin === undefined ? event.outcome : `${event.outcome}By`;
  const line = t(`log.test.${key}`, {
    skill: t(`skill.${skill}`),
    difficulty,
    margin: event.margin,
  });
  return event.investigatorId === undefined
    ? line
    : t('log.by', { investigator: names.investigator(event.investigatorId), line });
}
