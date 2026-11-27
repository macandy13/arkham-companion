import { assertNever, unique } from '@arkham/util';
import { cardStats, type EngineContext } from '../cards';
import { cardsWithActiveAbilities } from '../doom';
import type { Event, SkillTestResolved } from '../events';
import type { InstanceId, InvestigatorId } from '../ids';
import { findInvestigator, playerOrder } from '../investigators';
import { cardsInZone, cardsWhoseLocationIs, locationOfCard } from '../lookup';
import type { Decision, GameState } from '../state';
import type { Zone } from '../zone';
import { type ListenerScope, type WindowEvent, isEndingPhase } from './types';

/**
 * A window an event opened for one card: the event (`window`), how the card hears it (`scope`,
 * matched against its abilities' `TimingWindow.of`), the card the event is about (`subjectId`,
 * which a window's `filter` checks) and the investigator it names, if any (the drawer of an
 * encounter card).
 */
export interface OpenedWindow {
  window: WindowEvent;
  scope: ListenerScope;
  cardId: InstanceId;
  subjectId?: InstanceId;
  investigatorId?: InvestigatorId;
  /** The location it names itself, if any (where a defeated enemy was); see `windowLocation`. */
  locationId?: InstanceId;
  /** How much the test that opened it succeeded by, when the answer said (`succeeded`). */
  margin?: number;
  /** The card a repetition of a `forEach` ability is for (`thatCard`). */
  thatCardId?: InstanceId;
}

/** One event as the windows see it, before it is opened for each listening card (`openFor`). */
interface Occurrence {
  window: WindowEvent;
  subjectId?: InstanceId;
  investigatorId?: InvestigatorId;
  locationId?: InstanceId;
  margin?: number;
  /** The `self` listeners when more than the subject: a tested card and its attachments. */
  self?: readonly InstanceId[];
}

/** `occurrence` opened for every card each of `scopes` names, scope by scope in that order. */
function openFor(
  state: GameState,
  occurrence: Occurrence,
  ...scopes: ListenerScope[]
): OpenedWindow[] {
  const { window, subjectId, investigatorId, locationId, margin } = occurrence;
  const named = {
    ...(subjectId && { subjectId }),
    ...(investigatorId && { investigatorId }),
    ...(locationId && { locationId }),
    ...(margin === undefined ? {} : { margin }),
  };
  return scopes.flatMap((scope) =>
    listeners(state, occurrence, scope).map((cardId) => ({ window, scope, cardId, ...named })),
  );
}

/** The cards that hear `occurrence` in `scope` (`ListenerScope`). */
function listeners(state: GameState, occurrence: Occurrence, scope: ListenerScope): InstanceId[] {
  const { subjectId, investigatorId } = occurrence;
  switch (scope) {
    case 'self':
      return [...(occurrence.self ?? (subjectId === undefined ? [] : [subjectId]))];
    case 'yours': {
      if (investigatorId === undefined) return [];
      const here = findInvestigator(state, investigatorId)?.locationId;
      return [
        ...cardsInZone(state, { kind: 'threatArea', investigatorId }),
        ...(here === undefined ? [] : [here]),
      ];
    }
    case 'inPlay':
      return cardsWithActiveAbilities(state).map((card) => card.id);
    case 'currentActOrAgenda':
      return objectiveCards(state);
    case 'here': {
      const { locationId } = occurrence;
      if (locationId === undefined) return [];
      return cardsWhoseLocationIs(state, locationId).map((card) => card.id);
    }
    default:
      return assertNever(scope);
  }
}

/** The `revealed` window of the card turned face up, naming who drew it when it was drawn. */
function revealed(state: GameState, cardId: InstanceId, investigatorId?: InvestigatorId) {
  return openFor(state, { window: { on: 'revealed' }, subjectId: cardId, investigatorId }, 'self');
}

/**
 * The windows `event` opens; `state` is the state right after it. `events`
 * is the whole batch it belongs to: a drawn card is turned face up in the
 * same batch as its `EncounterCardDrawn`, which is the only record of who
 * drew it.
 */
export function windowsOpenedBy(
  state: GameState,
  event: Event,
  events: readonly Event[],
): OpenedWindow[] {
  switch (event.type) {
    case 'CardFlipped': {
      if (!event.faceUp) return [];
      const drawn = events.find(
        (e) => e.type === 'EncounterCardDrawn' && e.cardId === event.cardId,
      );
      if (drawn?.type !== 'EncounterCardDrawn') return revealed(state, event.cardId);
      // A treachery's revelation waits for the players' answer (`RevelationResolved`).
      if (drawn.asksRevelation) return [];
      return revealed(state, event.cardId, drawn.investigatorId);
    }
    case 'RevelationResolved':
      // A cancelled revelation (Ward of Protection) resolves none of the card's revealed abilities.
      if (event.cancelled) return [];
      return revealed(state, event.cardId, event.investigatorId);
    case 'InvestigatorMoved': {
      if (event.from === undefined) return [];
      const { investigatorId } = event;
      const entered = { window: { on: 'entered' }, subjectId: event.to, investigatorId } as const;
      return openFor(state, entered, 'self', 'currentActOrAgenda');
    }
    case 'TurnEnded': {
      const { investigatorId } = event;
      return openFor(state, { window: { on: 'turnEnds' }, investigatorId }, 'yours', 'inPlay');
    }
    case 'TurnStarted':
      return openFor(
        state,
        { window: { on: 'turnBegins' }, investigatorId: event.investigatorId },
        'yours',
      );
    case 'PhaseChanged': {
      const phase = event.ended;
      if (!isEndingPhase(phase)) return [];
      return openFor(state, { window: { on: 'phaseEnds', phase } }, 'inPlay');
    }
    case 'EnemyEngaged':
    case 'EnemyAttacked':
    case 'EnemyEvaded': {
      const on = ENEMY_WINDOWS[event.type];
      const { enemyId, investigatorId } = event;
      const opened = openFor(state, { window: { on }, subjectId: enemyId, investigatorId }, 'self');
      if (event.type !== 'EnemyEvaded' || !event.successful) return opened;
      const successful = { on: 'evaded', successful: true } as const;
      return [
        ...opened,
        ...openFor(state, { window: successful, subjectId: enemyId, investigatorId }, 'self'),
      ];
    }
    case 'CluesDiscovered': {
      const { locationId, investigatorId } = event;
      const discovered = {
        window: { on: 'cluesDiscovered' },
        subjectId: locationId,
        investigatorId,
      } as const;
      return openFor(state, discovered, 'self');
    }
    case 'SkillTestResolved': {
      const { action, subject, outcome, investigatorId } = event;
      const succeeded = outcome === 'pass' ? succeededWindows(state, event) : [];
      if (action === undefined || subject === undefined) return succeeded;
      const self = [subject, ...cardsInZone(state, { kind: 'attachedTo', hostId: subject })];
      const window = { on: 'tested', action, outcome } as const;
      return [
        ...openFor(state, { window, subjectId: subject, investigatorId, self }, 'self'),
        ...succeeded,
      ];
    }
    case 'SkillTestEnded': {
      const { action, outcome, subject, investigatorId } = event;
      const window = { on: 'testEnded', action, outcome } as const;
      return openFor(state, { window, subjectId: subject, investigatorId }, 'self');
    }
    case 'RoundEnded':
      return openFor(state, { window: { on: 'roundEnds' } }, 'inPlay');
    case 'InvestigatorDefeated':
    case 'InvestigatorResigned': {
      // With nobody left the scenario ends ("no resolution"): no objective may still fire.
      if (playerOrder(state).length === 0) return [];
      const { investigatorId } = event;
      return openFor(state, { window: { on: 'eliminated' }, investigatorId }, 'currentActOrAgenda');
    }
    case 'AgendaAdvanced':
    case 'ActAdvanced':
      return openFor(state, { window: { on: 'advanced' }, subjectId: event.cardId }, 'self');
    case 'CardMoved':
      return event.to.kind === 'victoryDisplay' || isBeneathAct(state, event.to)
        ? addedToVictoryDisplay(state, event.cardId)
        : [];
    case 'TokensChanged': {
      if (event.delta <= 0) return [];
      const window = { on: 'tokensPlaced', token: event.token } as const;
      return openFor(state, { window, subjectId: event.cardId }, 'self');
    }
    case 'EnemyDefeated': {
      const { enemyId, locationId } = event;
      // The enemy's own ability before the objectives: a fixed stand-in, as the rules let the
      // lead order simultaneous forced effects (M1V).
      return [
        ...openFor(
          state,
          { window: { on: 'defeated' }, subjectId: enemyId, locationId },
          'self',
          'currentActOrAgenda',
        ),
        ...(event.to.kind === 'victoryDisplay' ? addedToVictoryDisplay(state, enemyId) : []),
      ];
    }
    default:
      return [];
  }
}

/**
 * The `succeeded` windows of a passed test, for the cards at its location (`testLocation`): one
 * for any test and one more for the basic action it belongs to.
 */
function succeededWindows(state: GameState, event: SkillTestResolved): OpenedWindow[] {
  const { action, subject, investigatorId, margin } = event;
  if (investigatorId === undefined) return [];
  const locationId = testLocation(state, subject, investigatorId);
  if (locationId === undefined) return [];
  const windows: WindowEvent[] = [
    { on: 'succeeded' },
    ...(action === undefined ? [] : [{ on: 'succeeded' as const, action }]),
  ];
  return windows.flatMap((window) =>
    openFor(
      state,
      {
        window,
        investigatorId,
        locationId,
        ...(subject && { subjectId: subject }),
        ...(margin === undefined ? {} : { margin }),
      },
      'here',
    ),
  );
}

/**
 * Where a test about `subject` by `investigatorId` takes place, for "at [its] location": the
 * subject's location, or the tester's own for a subject at no location (a revelation).
 */
function testLocation(
  state: GameState,
  subject: InstanceId | undefined,
  investigatorId: InvestigatorId,
): InstanceId | undefined {
  const about = subject === undefined ? undefined : state.cards[subject];
  return (
    (about === undefined ? undefined : locationOfCard(state, about)) ??
    findInvestigator(state, investigatorId)?.locationId
  );
}

/**
 * Whether how much the skill test `decision` passes by matters to a card at its location: one
 * there has a `succeeded` ability with a `margin` condition (Margaret Liu's "by 2 or more"), so
 * the answer says the margin (`DecisionView.asksMargin`), as a threshold counts only with a
 * margin the players confirm.
 */
export function passMarginMatters(
  ctx: EngineContext,
  state: GameState,
  decision: Decision,
): boolean {
  if (decision.decider.kind !== 'investigator') return false;
  const where = testLocation(state, decision.subject, decision.decider.investigatorId);
  if (where === undefined) return false;
  return cardsWhoseLocationIs(state, where).some((card) =>
    (cardStats(ctx.cards, card.code).abilities ?? []).some(
      (ability) => ability.window.on === 'succeeded' && ability.condition?.kind === 'margin',
    ),
  );
}

/** The window each enemy event opens for the enemy. */
const ENEMY_WINDOWS = {
  EnemyEngaged: 'engaged',
  EnemyAttacked: 'attacked',
  EnemyEvaded: 'evaded',
} as const;

/**
 * The cards whose objectives an event can fulfil: the current agenda, then the current act, a
 * fixed order for the lead's choice between simultaneous forced effects (M1V). Only the current
 * ones, so a used-up act or agenda never fires again.
 */
function objectiveCards(state: GameState): InstanceId[] {
  // One card that is act and agenda at once (`BecomeActAndAgenda`) fulfils its objective once.
  return unique([state.agenda.current, state.act.current].filter((cardId) => cardId !== undefined));
}

/** Whether `zone` is beneath the current act, which some objectives count with the victory display. */
function isBeneathAct(state: GameState, zone: Zone): boolean {
  return zone.kind === 'beneath' && zone.hostId === state.act.current;
}

function addedToVictoryDisplay(state: GameState, cardId: InstanceId): OpenedWindow[] {
  const added = { window: { on: 'addedToVictoryDisplay' }, subjectId: cardId } as const;
  return openFor(state, added, 'currentActOrAgenda');
}
