import { BoardView, boardView, TableError } from './board_view';
import {
  cardMatcher,
  describeMatcher,
  matchingCards,
  type CardRef,
  type EnemyRef,
  type InvestigatorRef,
} from './card_matchers';
import { type EngineContext, type ScenarioContext } from './cards';
import type { Command } from './commands';
import { describeDecision, optionNamed } from './describe_decision';
import type { Event } from './events';
import { formatBoard } from './format_board';
import { decisionId, type InvestigatorId } from './ids';
import { checkInvariants } from './invariants';
import { requireCard } from './lookup';
import { replay } from './reducer';
import { CommandRejected, type Rejection } from './rejection';
import { compileSetup, type InvestigatorSeat } from './setup';
import { execute, type ExecuteResult } from './execute';
import {
  emptyState,
  type Decision,
  type Difficulty,
  type GameState,
  type InvestigatorStat,
  type Phase,
  type PhaseStep,
  type PhaseStepId,
} from './state';
import { undoLastGroup } from './undo';
import type { GameBuilder } from './game_builder';

/**
 * How the players report a skill test they resolve at the table: it passes,
 * fails, or fails by `failedBy` (the margin a card such as a treachery reads).
 */
export type SkillTestResult = 'pass' | 'fail' | { failedBy: number };

/**
 * Where the phase assistant stopped after `PlayTable.nextPhase()`. `step` is
 * the step (`PhaseStepId`) it stopped at: the step whose decision is pending,
 * or `enemiesAttack` while its attacks wait for the players. No `step` means
 * the phase ran all its steps; it is left only by the next "Next", so the
 * players see the phase's outcome before moving on.
 */
export interface PhaseStop {
  round: number;
  phase: Phase;
  step?: PhaseStepId;
}

/**
 * A `CommandRejected` raised by `PlayTable.play`, whose message also ends with
 * the board (`formatBoard`), so a refused step fails with the state in front of
 * the reader. `rejection` is the engine's own, unchanged.
 */
export class TableRejected extends CommandRejected {
  constructor(rejection: Rejection, board: string) {
    super(rejection);
    this.name = 'TableRejected';
    this.message = `${this.message}\n${board}`;
  }
}

/**
 * An event with the id of the table step that produced it, as the store's undo groups them
 * (`StoredEvent.commandId`). All commands of one step (an action and its test) share the id,
 * so undo takes back the whole step.
 */
export interface LoggedEvent {
  commandId: string;
  event: Event;
}

/** How an action's skill test is resolved. */
interface TestOptions {
  /** `open` leaves the test pending, to answer later with `PlayTable.resolveTest`. */
  result?: SkillTestResult | 'open';
}

/**
 * A game being played in a test or a sandbox, driven in game language
 * (`nextPhase()`, `startTurn(daisy)`, `moveTo(daisy, byName('Attic'))`) so a scripted
 * session reads like a session report. Start it from a `GameBuilder`
 * (`PlayTable.start`) or from any start command (`PlayTable.from`, e.g. a
 * scenario's compiled setup). Every step is an engine command run through
 * `execute`; the table keeps the live state and the full event log, so
 * `replay(table.events)` equals `table.state`, and checks `checkInvariants`
 * after each command. Read the board back through `board` (`BoardView`).
 *
 * Mutable on purpose: a script is a sequence of steps against one table, and
 * threading an immutable state through dozens of calls would bury the
 * narrative. A step that fails (a refused command, a broken invariant, a wrong
 * name) leaves state and log as they were, even when it runs several commands
 * (an action and its test, the attacks of a step) and a later one fails.
 * Action methods do not spend actions (the engine leaves that to the players);
 * `spendAction` is explicit. Investigators are given by
 * an `InvestigatorRef` (`byName('Roland Banks')` or the bare `InvestigatorId`),
 * cards by a `CardRef` and enemies by an `EnemyRef` (a matcher or the bare
 * `InstanceId`), all resolved through `board`.
 */
export class PlayTable {
  private current: GameState = emptyState();
  private log: LoggedEvent[] = [];
  private commandCount = 0;
  /** The group id of the step being played; set only while `atomically` runs one. */
  private stepId: string | undefined;

  private constructor(readonly ctx: EngineContext) {}

  /** A table started from the game `game` describes, in the context that knows its cards. */
  static start(game: GameBuilder): PlayTable {
    return PlayTable.from(game.context(), game.startCommand());
  }

  /**
   * A table that goes on from a stored log, e.g. a saved game's events with their
   * `commandId`s, in the `ctx` of its scenario. Undo takes back the log's own groups too.
   */
  static resume(ctx: EngineContext, log: readonly LoggedEvent[]): PlayTable {
    const table = new PlayTable(ctx);
    table.current = replay(log.map((entry) => entry.event));
    table.log = [...log];
    table.commandCount = nextGroupNumber(log);
    return table;
  }

  /** A table started by `start`, e.g. `compileSetup(ctx, …)`, in `ctx`. */
  static from(ctx: EngineContext, start: Command): PlayTable {
    const table = new PlayTable(ctx);
    table.play(start);
    return table;
  }

  /**
   * A table with `ctx.scenario` set up from scratch: its compiled setup is the
   * first command. The seed fixes the shuffled decks; `difficulty` defaults to
   * standard. `investigators` are in seat order, the first being the lead.
   */
  static setUp(
    ctx: ScenarioContext,
    options: {
      investigators: readonly InvestigatorSeat[];
      seed: number;
      difficulty?: Difficulty;
    },
  ): PlayTable {
    return PlayTable.from(
      ctx,
      compileSetup(ctx, { ...options, difficulty: options.difficulty ?? 'standard' }),
    );
  }

  /** The live state after the last command. */
  get state(): GameState {
    return this.current;
  }

  /** Every event so far, start included, in the order they were applied. */
  get events(): readonly Event[] {
    return this.log.map((entry) => entry.event);
  }

  /** The log with each event's group id, so a caller can store what a step added. */
  get entries(): readonly LoggedEvent[] {
    return [...this.log];
  }

  /** The board as it is now; a fresh snapshot per access, so keep it only for one assertion. */
  get board(): BoardView {
    return boardView(this.ctx, this.current);
  }

  /** The board as text (`formatBoard`), for snapshots and failure messages. */
  formatted(): string {
    return formatBoard(this.ctx, this.current);
  }

  /**
   * Runs one command. A refusal is a `TableRejected` (the engine's rejection
   * plus the board); a command that leaves the state inconsistent fails with a
   * `TableError`. Either way the table stays as it was.
   */
  play(command: Command): void {
    let result: ExecuteResult;
    try {
      result = execute(this.ctx, this.current, command);
    } catch (error) {
      if (error instanceof CommandRejected)
        throw new TableRejected(error.rejection, this.formatted());
      throw error;
    }
    this.assertConsistent(command.type, result.state);
    this.current = result.state;
    const commandId = this.stepId ?? this.nextGroupId();
    this.log.push(...result.events.map((event) => ({ commandId, event })));
  }

  /**
   * Takes back the last step with everything it caused (the store's
   * `undoLast`): its group leaves the log and the state is replayed from what
   * remains. Fails if only the start is left, which is the game itself.
   */
  undo(): void {
    const kept = undoLastGroup(this.log).kept;
    if (kept.length === 0) throw this.error('nothing to undo: only the start is left');
    const state = replay(kept.map((entry) => entry.event));
    this.assertConsistent('undo', state);
    this.log = kept;
    this.current = state;
  }

  /**
   * The phase assistant's "Next" (`NextPhase`): runs the steps of the current
   * phase until one needs the players (a decision, an enemy attack), or moves
   * on to the next phase. Returns where it stopped (`PhaseStop`), so a script
   * asserts the round, phase and step at every "Next".
   */
  nextPhase(): PhaseStop {
    const stepsBefore = this.current.meta.steps;
    const logged = this.log.length;
    this.play({ type: 'NextPhase' });
    const { round, phase, steps } = this.current.meta;
    const step =
      this.current.pending.length > 0
        ? lastStepStarted(
            stepsBefore,
            this.log.slice(logged).map((entry) => entry.event),
          )
        : steps[0]?.id;
    return { round, phase, ...(step === undefined ? {} : { step }) };
  }

  /** The group picks `investigator` to take the next turn of the investigation phase. */
  startTurn(investigator: InvestigatorRef): void {
    this.play({ type: 'StartTurn', investigatorId: this.seat(investigator) });
  }

  /** The investigator ends their turn. */
  endTurn(investigator: InvestigatorRef): void {
    this.play({ type: 'EndTurn', investigatorId: this.seat(investigator) });
  }

  /** The investigator resigns as the action of their turn, which ends it. */
  resign(investigator: InvestigatorRef): void {
    this.play({ type: 'Resign', investigatorId: this.seat(investigator) });
  }

  /**
   * The players change the investigator's remaining actions by `delta`: -1 per
   * action they count off in the turn, or what a card grants or takes away.
   */
  adjustActions(investigator: InvestigatorRef, delta: number): void {
    this.play({ type: 'AdjustActions', investigatorId: this.seat(investigator), delta });
  }

  /** The investigator counts off `count` actions (default 1) they took. */
  spendAction(investigator: InvestigatorRef, count = 1): void {
    this.adjustActions(investigator, -count);
  }

  /** A move action along a connection to the location `location` names. */
  moveTo(investigator: InvestigatorRef, location: CardRef): void {
    this.play({
      type: 'MoveInvestigator',
      investigatorId: this.seat(investigator),
      to: this.board.location(location).id,
      asAction: true,
    });
  }

  /**
   * An investigate action. Its intellect test is passed by default,
   * discovering `clues` (default 1; more when a card adds to the result);
   * `result` says otherwise, `open` leaves the test pending for `resolveTest`.
   * When the action provokes attacks of opportunity those come before the test:
   * take them (`takeAttackOfOpportunity`), then use `resolveTest`.
   */
  investigate(
    investigator: InvestigatorRef,
    { result = 'pass', clues }: TestOptions & { clues?: number } = {},
  ): void {
    const seat = this.seat(investigator);
    this.atomically(() => {
      this.play({ type: 'Investigate', investigatorId: seat, asAction: true });
      this.finishTest(`investigate:${seat}`, result, clues);
    });
  }

  /**
   * A fight action against the `enemy`. Its combat test is passed by default,
   * dealing the basic attack's 1 damage or the `damage` the players confirm (a
   * weapon, a skill card); a failed one deals none, and a ready retaliate
   * enemy then asks to attack the fighter.
   */
  fight(
    investigator: InvestigatorRef,
    enemy: EnemyRef,
    { result = 'pass', damage }: TestOptions & { damage?: number } = {},
  ): void {
    const seat = this.seat(investigator);
    const id = this.board.enemyId(enemy);
    this.atomically(() => {
      this.play({ type: 'Fight', investigatorId: seat, enemyId: id });
      this.finishTest(`fight:${seat}:${id}`, result, damage);
    });
  }

  /**
   * An evade action against the `enemy`, engaged with the investigator. Its
   * agility test is passed by default: the enemy is disengaged and exhausted
   * and stays where it is.
   */
  evade(
    investigator: InvestigatorRef,
    enemy: EnemyRef,
    { result = 'pass' }: TestOptions = {},
  ): void {
    const seat = this.seat(investigator);
    const id = this.board.enemyId(enemy);
    this.atomically(() => {
      this.play({ type: 'Evade', investigatorId: seat, enemyId: id });
      this.finishTest(`evade:${seat}:${id}`, result);
    });
  }

  /**
   * The engage action: the `enemy` engages the investigator (or switches to
   * them). Entering a location with a ready enemy needs none, `moveTo` engages it.
   */
  engage(investigator: InvestigatorRef, enemy: EnemyRef): void {
    this.play({
      type: 'EngageEnemy',
      enemyId: this.board.enemyId(enemy),
      investigatorId: this.seat(investigator),
      asAction: true,
    });
  }

  /**
   * The players resolve the attack of opportunity `enemy` makes: at its
   * printed damage and horror, or at the `damage` and `horror` they lower it
   * to (an asset soaking part of it).
   */
  takeAttackOfOpportunity(
    enemy: EnemyRef,
    amounts: { damage?: number; horror?: number } = {},
  ): void {
    this.play({
      type: 'ResolveDecision',
      decisionId: decisionId(`attackOfOpportunity:${this.board.enemyId(enemy)}`),
      optionId: 'attack',
      amounts,
    });
  }

  /**
   * Enemy step 3.3: the players resolve each attack the step lists, in its
   * order, with the printed damage and horror; each enemy exhausts after its attack.
   */
  resolveEnemyAttacks(): void {
    const [step] = this.current.meta.steps;
    if (step?.id !== 'enemiesAttack' || step.attacks === undefined)
      throw this.error('no enemy attacks to resolve');
    const { attacks } = step;
    this.atomically(() => {
      for (const attack of attacks) this.play({ type: 'ResolveEnemyAttack', ...attack });
    });
  }

  /** The investigators pay the act's clue requirement, each the clues listed with them, and advance it. */
  spendCluesToAdvanceAct(spend: ReadonlyArray<readonly [InvestigatorRef, number]>): void {
    this.play({
      type: 'AdvanceAct',
      spend: spend.map(([investigator, amount]) => ({
        investigatorId: this.seat(investigator),
        amount,
      })),
    });
  }

  /**
   * Answers the open decision about the card `subject` names by picking the
   * option shown as `option` (`answer(byName('Swarm of Rats'), 'Roland Banks')`,
   * `answer(byName('Crypt Chill'), 'fail')`), confirming `amount` where the option
   * takes one. Fails when no decision, or several, are about that card or the
   * option is not offered, so a script that answers the wrong question breaks
   * where it happens.
   */
  answer(subject: CardRef, option: string, { amount }: { amount?: number } = {}): void {
    const { pending, cards } = this.current;
    const matcher = cardMatcher(subject);
    const subjects = matchingCards(
      this.ctx,
      pending.flatMap((decision) =>
        decision.subject === undefined ? [] : [requireCard(cards, decision.subject)],
      ),
      matcher,
    ).map((card) => card.id);
    const about = pending.filter(
      (decision) => decision.subject !== undefined && subjects.includes(decision.subject),
    );
    const decision = this.onlyOne(about, `open decision about a card ${describeMatcher(matcher)}`);
    this.answerWith(decision, option, amount);
  }

  /** Answers the only open decision, whatever it is about, by picking the option shown as `option`. */
  answerOnly(option: string): void {
    const decision = this.onlyOne(this.current.pending, 'open decision');
    this.answerWith(decision, option);
  }

  /**
   * The players report the skill test left open by an action (`result: 'open'`)
   * or raised by a card. `for` picks the tested investigator when several
   * tests are open; `amount` is the count a pass confirms.
   */
  resolveTest(
    result: SkillTestResult,
    { for: investigator, amount }: { for?: InvestigatorRef; amount?: number } = {},
  ): void {
    const seat = investigator === undefined ? undefined : this.seat(investigator);
    const decision = this.onlyOne(
      this.current.pending.filter(
        (pending) =>
          pending.kind === 'skillTestResult' &&
          (seat === undefined ||
            (pending.decider.kind === 'investigator' && pending.decider.investigatorId === seat)),
      ),
      `open skill test${seat === undefined ? '' : ` for ${seat}`}`,
    );
    this.resolve(decision, testOptionId(result), amount);
  }

  /** Resources from the resource action or a card. */
  gainResources(investigator: InvestigatorRef, amount: number): void {
    this.adjust(investigator, 'resources', amount);
  }

  /** Resources paid for a card the players play (the app does not track player cards). */
  spendResources(investigator: InvestigatorRef, amount: number): void {
    this.adjust(investigator, 'resources', -amount);
  }

  /** Damage from a failed treachery test or an attack. */
  takeDamage(investigator: InvestigatorRef, amount: number): void {
    this.adjust(investigator, 'damage', amount);
  }

  /** Horror from a failed treachery test, an attack or an agenda's reverse side. */
  takeHorror(investigator: InvestigatorRef, amount: number): void {
    this.adjust(investigator, 'horror', amount);
  }

  /** Doom from a card effect (e.g. Ancient Evils) on the current agenda. */
  placeDoom(amount: number): void {
    this.play({ type: 'PlaceDoom', amount });
  }

  /**
   * Runs a step made of several commands as one: they share one undo group,
   * and if any throws, the table goes back to how it was before the step, so a
   * failed step never leaves half of itself behind. A nested step joins the
   * outer one's group, and restoring is idempotent, so nesting is safe.
   */
  private atomically(step: () => void): void {
    const { current, commandCount, stepId } = this;
    const log = [...this.log];
    this.stepId = stepId ?? this.nextGroupId();
    try {
      step();
    } catch (error) {
      this.current = current;
      this.log = log;
      this.commandCount = commandCount;
      throw error;
    } finally {
      this.stepId = stepId;
    }
  }

  /** A fresh undo group id; ids only need to differ within one table's log. */
  private nextGroupId(): string {
    return `command-${this.commandCount++}`;
  }

  /** The seat `investigator` picks; fails with the board attached if none or several match. */
  private seat(investigator: InvestigatorRef): InvestigatorId {
    return this.board.investigator(investigator).id;
  }

  private adjust(investigator: InvestigatorRef, stat: InvestigatorStat, delta: number): void {
    this.play({ type: 'AdjustInvestigator', investigatorId: this.seat(investigator), stat, delta });
  }

  /**
   * Resolves the skill test `id` an action raised, unless the test is to stay
   * `open`. The test is missing when attacks of opportunity come first, which
   * only the players' own `takeAttackOfOpportunity` can settle.
   */
  private finishTest(id: string, result: SkillTestResult | 'open', amount?: number): void {
    if (result === 'open') {
      if (amount !== undefined) throw this.error('an open test has no count to confirm yet');
      return;
    }
    const decision = this.current.pending.find((pending) => pending.id === id);
    if (!decision)
      throw this.error(
        `no skill test ${id} is open; attacks of opportunity come first: take them with takeAttackOfOpportunity, then resolveTest`,
      );
    this.resolve(decision, testOptionId(result), amount);
  }

  private answerWith(decision: Decision, option: string, amount?: number): void {
    const chosen = optionNamed(decision, option);
    if (!chosen)
      throw this.error(
        `no option ${option} in: ${describeDecision(this.ctx, this.current, decision)}`,
      );
    this.resolve(decision, chosen.id, amount);
  }

  private resolve(decision: Decision, optionId: string, amount?: number): void {
    this.play({
      type: 'ResolveDecision',
      decisionId: decision.id,
      optionId,
      ...(amount === undefined ? {} : { amount }),
    });
  }

  private assertConsistent(what: string, state: GameState): void {
    const violations = checkInvariants(state);
    if (violations.length > 0)
      throw new TableError(
        `${what} broke invariants: ${violations.join('; ')}`,
        formatBoard(this.ctx, state),
      );
  }

  private onlyOne<T>(found: readonly T[], what: string): T {
    const [only, ...others] = found;
    if (only === undefined || others.length > 0)
      throw this.error(`expected exactly one ${what}, found ${found.length}`);
    return only;
  }

  private error(message: string): TableError {
    return new TableError(message, this.formatted());
  }
}

/** The id of the option of a `skillTestResult` decision that reports `result` (see `skillTestDecision`). */
function testOptionId(result: SkillTestResult): string {
  return typeof result === 'string' ? result : `failedBy:${result.failedBy}`;
}

/**
 * The step whose decision stopped a `NextPhase`: each step removes itself
 * from `GameMeta.steps` before it runs (`PhaseStepsChanged`), so the cursor
 * already points past it, and the step is the last one the events removed.
 * `stepsBefore` is the cursor before the command; a `PhaseChanged` lists the
 * steps of the phase it enters.
 */
function lastStepStarted(
  stepsBefore: readonly PhaseStep[],
  events: readonly Event[],
): PhaseStepId | undefined {
  let steps = stepsBefore;
  let started: PhaseStepId | undefined;
  for (const event of events) {
    if (event.type === 'PhaseChanged') steps = event.steps;
    if (event.type !== 'PhaseStepsChanged') continue;
    if (event.steps.length < steps.length) started = steps[0]?.id;
    steps = event.steps;
  }
  return started;
}

/**
 * The first `command-<n>` number above every one in `log`, so a resumed table's next step never
 * joins a stored group. Undo leaves gaps, so the log's length is not enough; ids of another form
 * (the store's UUIDs) cannot collide.
 */
function nextGroupNumber(log: readonly LoggedEvent[]): number {
  const numbers = log.map((entry) => /^command-(\d+)$/.exec(entry.commandId)?.[1]);
  return Math.max(-1, ...numbers.map(Number).filter(Number.isInteger)) + 1;
}
