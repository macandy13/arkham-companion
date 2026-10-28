import type { TFunction } from 'i18next';
import type {
  CardMoved,
  EngineContext,
  Event,
  GameState,
  InstanceId,
  InvestigatorId,
  InvestigatorStat,
  LoggedEvent,
  PlayerCardCommand,
  SkillTestResolved,
  TokenKind,
} from '@arkham/engine';
import { assertNever, runsBy } from '@arkham/util';

/**
 * One step of the game as the log shows it: the events of one undo group (`LoggedEvent.commandId`,
 * the unit `GameSession.undo` takes back) as readable lines, in the order they happened.
 */
export interface LogStep {
  /** The `LoggedEvent.commandId` of the step's undo group, which a jump back names. */
  readonly id: string;
  readonly lines: readonly string[];
  /**
   * How many undo groups came after it, the ones without a line included: what going back to it
   * takes back (`GameSession.undoTo`).
   */
  readonly later: number;
}

/**
 * The game log `entries` as steps of readable lines (`eventLines`), oldest first. A step whose
 * events are all bookkeeping has no line and is left out. `state` is the game after `entries`; it
 * names the cards and investigators, which stay in the state once set up.
 */
export function gameLog(
  t: TFunction,
  ctx: EngineContext,
  state: GameState,
  entries: readonly LoggedEvent[],
): LogStep[] {
  const runs = runsBy(entries, (entry) => entry.commandId);
  return runs.flatMap(({ key, items }, index) => {
    const lines = eventLines(
      t,
      ctx,
      state,
      items.map((entry) => entry.event),
    );
    return lines.length > 0 ? [{ id: key, lines, later: runs.length - 1 - index }] : [];
  });
}

/**
 * What `events` (one step's) did, one line per event the players care about. Bookkeeping that
 * only the engine reads (phase steps, queues, decisions asked, map layout, exhaustion) has no
 * line, and neither have the counters a clue discovery moves, since its own line says it all.
 */
export function eventLines(
  t: TFunction,
  ctx: EngineContext,
  state: GameState,
  events: readonly Event[],
): string[] {
  const discoveries = events.flatMap((event) => (event.type === 'CluesDiscovered' ? [event] : []));
  const names: Names = {
    card: (id) => {
      const code = state.cards[id]?.code;
      // A card the state doesn't know (a log from other data) has no name; its id is all there is.
      return (code && ctx.cards.get(code)?.name) ?? id;
    },
    investigator: (id) => state.investigators.find((inv) => inv.id === id)?.name ?? id,
  };
  return events.flatMap((event) => {
    // A discovery is the only clue change of its step: no rule moves clues while a test resolves.
    const isDiscovery =
      (event.type === 'TokensChanged' &&
        event.token === 'clue' &&
        discoveries.some((found) => found.locationId === event.cardId)) ||
      (event.type === 'InvestigatorChanged' &&
        event.stat === 'clues' &&
        discoveries.some((found) => found.investigatorId === event.investigatorId));
    if (isDiscovery) return [];
    const line = eventLine(t, names, state, event);
    return line === undefined ? [] : [line];
  });
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
      return t('log.phase', { round: event.round, phase: t(`games.phases.${event.phase}`) });
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
