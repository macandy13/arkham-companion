import { assertNever, shallowEqual } from '@arkham/util';
import type { ChangeCause } from './change_cause';
import type { Event } from './events';
import type { CausedEvents } from './handle';

/**
 * What part of the game a notice is about, so the screens can filter or group notices (M1C.2):
 * tokens on cards (doom, clues, damage on an enemy), the chaos bag, the board (cards moving, turning over,
 * the agenda or act advancing), an investigator (health, sanity, resources, moving, defeat),
 * enemies (engaging, attacking, readying), the encounter deck, and effects the players carry out
 * by hand because the app could not.
 */
export type NoticeKind =
  'tokens' | 'chaosBag' | 'board' | 'investigator' | 'enemy' | 'encounter' | 'byHand';

/**
 * One thing the engine did by itself in a step (M1C.2): consecutive events of one kind with the
 * same cause, which is never the players' own command (they know what they did). `events` are in
 * the order they happened; the screens word them (the web app's game log).
 */
export interface ChangeNotice {
  readonly kind: NoticeKind;
  readonly cause: Exclude<ChangeCause, { kind: 'player' }>;
  readonly events: readonly Event[];
}

/**
 * The automatic changes among `events` as notices: each event the players didn't cause and that
 * shows at the table (`noticeKindOf`), grouped while kind and cause stay the same. Bookkeeping
 * events in between (a phase step done, a decision asked) don't split a group.
 */
export function changeNotices({ events, causes }: CausedEvents): ChangeNotice[] {
  const notices: ChangeNotice[] = [];
  events.forEach((event, index) => {
    const cause = causes[index];
    const kind = noticeKindOf(event);
    if (cause === undefined || cause.kind === 'player' || kind === undefined) return;
    const last = notices.at(-1);
    if (last && last.kind === kind && sameCause(last.cause, cause)) {
      notices[notices.length - 1] = { ...last, events: [...last.events, event] };
    } else {
      notices.push({ kind, cause, events: [event] });
    }
  });
  return notices;
}

function sameCause(a: ChangeNotice['cause'], b: ChangeNotice['cause']): boolean {
  switch (a.kind) {
    case 'card':
      return b.kind === 'card' && a.cardId === b.cardId && shallowEqual(a.window, b.window);
    case 'rule':
      return b.kind === 'rule' && a.step === b.step;
    default:
      return assertNever(a);
  }
}

/**
 * The kind of notice `event` belongs to, or `undefined` for bookkeeping the table doesn't see
 * as a change: phases and turns moving on (the screen shows them), decisions asked and answered
 * (the decision is its own notice), the engine's queue.
 */
export function noticeKindOf(event: Event): NoticeKind | undefined {
  switch (event.type) {
    case 'TokensChanged':
    case 'CluesDiscovered':
      return 'tokens';
    case 'ChaosBagChanged':
    case 'ChaosTokenSealed':
    case 'ChaosTokenReleased':
      return 'chaosBag';
    case 'CardMoved':
    case 'CardFlipped':
    case 'ConnectionChanged':
    case 'MapAdded':
    case 'LayoutCellSet':
    case 'AgendaAdvanced':
    case 'ActAdvanced':
    case 'CurrentCardChanged':
    case 'ScenarioEnded':
      return 'board';
    case 'InvestigatorMoved':
    case 'InvestigatorChanged':
    case 'InvestigatorDefeated':
    case 'InvestigatorResigned':
    case 'LeadInvestigatorChanged':
    case 'ActionsAdjusted':
    case 'ActionsReset':
    case 'SkillBoostChanged':
      return 'investigator';
    case 'EnemyEngaged':
    case 'EnemyAttacked':
    case 'EnemyDisengaged':
    case 'EnemyEvaded':
    case 'EnemyDefeated':
    case 'ExhaustChanged':
      return 'enemy';
    case 'DeckShuffled':
    case 'EncounterCardDrawn':
    case 'SurgeGained':
      return 'encounter';
    case 'CommandDeferred':
    case 'AbilityEffectSkipped':
      return 'byHand';
    case 'ScenarioStarted':
    case 'DecisionRequested':
    case 'DecisionResolved':
    case 'CardActionUsed':
    case 'SkillTestResolved':
    case 'PhaseChanged':
    case 'PhaseStepsChanged':
    case 'RoundEnded':
    case 'TurnStarted':
    case 'TurnEnded':
    case 'StepsQueued':
    case 'StepResumed':
    case 'ActionDropped':
      return undefined;
    default:
      return assertNever(event);
  }
}
