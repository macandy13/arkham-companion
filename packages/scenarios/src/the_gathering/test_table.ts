import {
  cardStats,
  cardsNamed,
  checkInvariants,
  decisionId,
  describeDecision,
  compileSetup,
  emptyState,
  execute,
  formatBoard,
  instanceId,
  isInPlay,
  locationsNamed,
  optionName,
  optionNamed,
  replay,
  mapId,
  undoLastGroup,
  zoneKey,
  type CardInstance,
  type Command,
  type Decision,
  type EngineContext,
  type Event,
  type GameState,
  type Investigator,
  type InvestigatorId,
  type InvestigatorSeat,
  type InvestigatorStat,
  type Phase,
  type PhaseStep,
  type PhaseStepId,
  type ScenarioDefinition,
  type SkillTest,
  type Zone,
} from '@arkham/engine';

/** An event with the id of the command that produced it, as the store's undo groups them. */
interface LoggedEvent {
  commandId: string;
  event: Event;
}

/**
 * Where the phase assistant stopped after a `TestTable.nextPhase()`. `step`
 * is the step (`PhaseStepId`) it stopped at: the step whose decision is
 * pending, or `enemiesAttack` while its attacks wait for the players.
 * No `step` means the phase ran all its steps; it is left only by the next
 * "Next", so the players see the phase's outcome before moving on.
 */
export interface PhaseStop {
  round: number;
  phase: Phase;
  step?: PhaseStepId;
}

/**
 * One enemy in play as a player reads it off the table: its name, the
 * location it is at, the investigator it is engaged with, its damage and
 * whether it is exhausted. The last three are left out when there is none,
 * so a list of enemies reads like the table and asserts only what is there.
 */
export interface EnemyView {
  name: string;
  at: string;
  engagedWith?: InvestigatorId;
  damage?: number;
  exhausted?: true;
}

/**
 * Picks one enemy in play: by name alone, or narrowed by the investigator it
 * is engaged with or the location (by name) it is at, for when several
 * copies of a card are in play at once (three Swarms of Rats). A lookup that
 * matches more than one enemy fails instead of guessing.
 */
export type EnemySelector = string | { name: string; engagedWith?: InvestigatorId; at?: string };

/**
 * One open decision as the players see it: the question (`prompt`, the
 * engine's i18n key), the card it is `about`, the investigator it is `for`
 * (the one tested or attacked, who answers it), the dialog `kind`, the test of
 * a skill test, the options by readable name (`optionName`) and, for options
 * whose counts the players confirm or adjust, the default counts by option
 * name (e.g. `{ attack: { damage: 1, horror: 2 } }`).
 */
export interface DecisionView {
  prompt: string;
  kind: Decision['kind'];
  about?: string;
  for?: InvestigatorId;
  test?: SkillTest;
  options: string[];
  defaults?: Record<string, Record<string, number>>;
}

/** One enemy attack enemy step 3.3 lists: the enemy by name and the investigator it attacks. */
export interface DueAttackView {
  enemy: string;
  investigator: InvestigatorId;
}

/** What `TestTable.setUp` needs to start a scenario. */
export interface TableOptions {
  scenario: ScenarioDefinition;
  ctx: EngineContext;
  /** In seat order; the first one is the lead investigator. */
  investigators: readonly InvestigatorSeat[];
  seed: number;
}

/**
 * A scenario being played in a test, driven in game language
 * (`nextPhase()`, `startTurn(daisy)`, `moveTo(daisy, 'Attic')`) so a scripted
 * session reads like a session report. Shared by every flow test of the
 * scenario, so they all set up and drive the game the same way. Every step is an engine command run through
 * `execute`; the table keeps the live state and the full event log, and checks
 * `checkInvariants` after each command so a broken step fails where it
 * happens, with the board (`formatBoard`) in the message.
 *
 * Mutable on purpose: a script is a sequence of steps against one table, and
 * threading an immutable state through dozens of helper calls would bury the
 * narrative. Each test builds its own table, so nothing is shared between tests.
 */
export class TestTable {
  private current: GameState = emptyState();
  private log: LoggedEvent[] = [];
  private commandCount = 0;

  private constructor(readonly ctx: EngineContext) {}

  /** A table with `scenario` set up from scratch (its compiled setup is the first command). */
  static setUp({ scenario, ctx, investigators, seed }: TableOptions): TestTable {
    const table = new TestTable(ctx);
    table.play(compileSetup(ctx, scenario, { difficulty: 'standard', seed, investigators }));
    return table;
  }

  /** The live state after the last command. */
  get state(): GameState {
    return this.current;
  }

  /** Every event so far, setup included, in the order they were applied. */
  get events(): readonly Event[] {
    return this.log.map((entry) => entry.event);
  }

  /** The board as text (`formatBoard`), for snapshots and failure messages. */
  board(): string {
    return formatBoard(this.ctx, this.current);
  }

  /** Runs one command and fails if it leaves the state inconsistent. */
  play(command: Command): void {
    const result = execute(this.ctx, this.current, command);
    this.current = result.state;
    const commandId = `command-${this.commandCount++}`;
    this.log.push(...result.events.map((event) => ({ commandId, event })));
    const violations = checkInvariants(this.current);
    if (violations.length > 0)
      throw new Error(
        `${command.type} broke invariants: ${violations.join('; ')}\n${this.board()}`,
      );
  }

  /**
   * Takes back the last command with everything it caused (the store's
   * `undoLast`): its group leaves the log and the state is replayed from
   * what remains. Fails with the board attached if there is nothing to undo.
   */
  undo(): void {
    if (this.log.length === 0) throw new Error(`nothing to undo\n${this.board()}`);
    this.log = undoLastGroup(this.log).kept;
    this.current = replay(this.events);
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

  /** The round and phase the game is in. */
  phase(): { round: number; phase: Phase } {
    return { round: this.current.meta.round, phase: this.current.meta.phase };
  }

  /** The group picks `investigator` to take the next turn of the investigation phase. */
  startTurn(investigator: InvestigatorId): void {
    this.play({ type: 'StartTurn', investigatorId: investigator });
  }

  /** The investigator ends their turn. */
  endTurn(investigator: InvestigatorId): void {
    this.play({ type: 'EndTurn', investigatorId: investigator });
  }

  /** The investigator resigns as the action of their turn, which ends it. */
  resign(investigator: InvestigatorId): void {
    this.play({ type: 'Resign', investigatorId: investigator });
  }

  /** The name of the investigator whose turn is in progress, or "none" between turns. */
  turn(): string {
    const { turn } = this.current.meta;
    return turn ? this.investigator(turn.investigatorId).name : 'none';
  }

  /**
   * The players change the investigator's remaining actions by `delta`: -1 per
   * action they count off in the turn, or what a card grants or takes away.
   */
  adjustActions(investigator: InvestigatorId, delta: number): void {
    this.play({ type: 'AdjustActions', investigatorId: investigator, delta });
  }

  /** Doom from a card effect (e.g. Ancient Evils) on the current agenda. */
  placeDoom(amount: number): void {
    this.play({ type: 'PlaceDoom', amount });
  }

  /**
   * Answers the open decision about the card named `subjectName` by picking
   * the option shown as `optionShown` (e.g. `answer('Swarm of Rats', 'Roland
   * Banks')`, `answer("What's Going On?!", 'yes')`). Fails with the board
   * attached if no such decision or option exists, or several decisions are
   * about cards of that name, so a script that answers the wrong question
   * breaks where it happens.
   */
  answer(subjectName: string, optionShown: string): void {
    const decision = this.onlyOne(
      this.current.pending.filter(
        (pending) =>
          pending.subject !== undefined &&
          this.nameOf(this.cardWithId(pending.subject)) === subjectName,
      ),
      `open decision about ${subjectName}`,
    );
    const option = optionNamed(decision, optionShown);
    if (!option)
      throw new Error(
        `no option ${optionShown} in: ${describeDecision(this.ctx, this.current, decision)}\n${this.board()}`,
      );
    this.play({ type: 'ResolveDecision', decisionId: decision.id, optionId: option.id });
  }

  /** A move action along a connection to the location named `locationName`. */
  moveTo(investigator: InvestigatorId, locationName: string): void {
    this.play({
      type: 'MoveInvestigator',
      investigatorId: investigator,
      to: this.locationNamed(locationName).id,
    });
  }

  /**
   * An investigate action whose intellect test the players pass at the table,
   * discovering `clues` (default 1; more when a card adds to the result).
   * Fails when the action provokes attacks of opportunity: those come before
   * the test, so a script takes them (`takeAttackOfOpportunity`) and then
   * passes the test with `passInvestigateTest`.
   */
  investigate(investigator: InvestigatorId, { clues }: { clues?: number } = {}): void {
    this.startInvestigating(investigator);
    this.passInvestigateTest(investigator, { clues });
  }

  /** An investigate action, up to its intellect test (or the attacks of opportunity before it). */
  startInvestigating(investigator: InvestigatorId): void {
    this.play({ type: 'Investigate', investigatorId: investigator });
  }

  /** The players pass the intellect test of the investigator's investigate action, discovering `clues` (default 1). */
  passInvestigateTest(investigator: InvestigatorId, { clues }: { clues?: number } = {}): void {
    this.passTest(`investigate:${investigator}`, clues);
  }

  /** The investigators pay the act's clue requirement, `spend` clues each, and advance it. */
  spendCluesToAdvanceAct(spend: Readonly<Record<string, number>>): void {
    this.play({
      type: 'AdvanceAct',
      spend: Object.entries(spend).map(([id, amount]) => ({
        investigatorId: this.investigator(id).id,
        amount,
      })),
    });
  }

  /**
   * The `enemy` engages the investigator (or switches to them): an engage
   * action, or a rule that engages without one (an enemy at the location the
   * investigator enters).
   */
  engage(investigator: InvestigatorId, enemy: EnemySelector): void {
    this.play({
      type: 'EngageEnemy',
      enemyId: this.enemyInstance(enemy).id,
      investigatorId: investigator,
    });
  }

  /**
   * An evade action against the `enemy`, engaged with the investigator, whose
   * agility test the players pass: it is disengaged and exhausted, and stays where it is.
   */
  evade(investigator: InvestigatorId, enemy: EnemySelector): void {
    const { id } = this.enemyInstance(enemy);
    this.play({ type: 'Evade', investigatorId: investigator, enemyId: id });
    this.passTest(`evade:${investigator}:${id}`);
  }

  /**
   * A fight action against the `enemy`, whose combat test the players pass.
   * It deals the basic attack's 1 damage, or the `damage` the players
   * confirm (a weapon, a skill card adding damage).
   */
  fight(
    investigator: InvestigatorId,
    enemy: EnemySelector,
    { damage }: { damage?: number } = {},
  ): void {
    const { id } = this.enemyInstance(enemy);
    this.play({ type: 'Fight', investigatorId: investigator, enemyId: id });
    this.passTest(`fight:${investigator}:${id}`, damage);
  }

  /**
   * The players resolve the attack of opportunity `enemy` makes: at its
   * printed damage and horror, or at the `damage` and `horror` they lower it
   * to (an asset soaking part of it).
   */
  takeAttackOfOpportunity(
    enemy: EnemySelector,
    amounts: { damage?: number; horror?: number } = {},
  ): void {
    const { id } = this.enemyInstance(enemy);
    this.play({
      type: 'ResolveDecision',
      decisionId: decisionId(`attackOfOpportunity:${id}`),
      optionId: 'attack',
      amounts,
    });
  }

  /** A fight action against the `enemy` whose combat test the players fail: nothing happens. */
  failFight(investigator: InvestigatorId, enemy: EnemySelector): void {
    const { id } = this.enemyInstance(enemy);
    this.play({ type: 'Fight', investigatorId: investigator, enemyId: id });
    this.play({
      type: 'ResolveDecision',
      decisionId: decisionId(`fight:${investigator}:${id}`),
      optionId: 'fail',
    });
  }

  /** Resources from the resource action or a card. */
  gainResources(investigator: InvestigatorId, amount: number): void {
    this.adjust(investigator, 'resources', amount);
  }

  /** Damage from a failed treachery test or an attack. */
  takeDamage(investigator: InvestigatorId, amount: number): void {
    this.adjust(investigator, 'damage', amount);
  }

  /** Horror from a failed treachery test, an attack or an agenda's reverse side. */
  takeHorror(investigator: InvestigatorId, amount: number): void {
    this.adjust(investigator, 'horror', amount);
  }

  /**
   * Enemy step 3.3: the players resolve each attack the step lists, in its
   * order, with the printed damage and horror; each enemy exhausts after its attack.
   */
  resolveEnemyAttacks(): void {
    const [step] = this.current.meta.steps;
    if (step?.id !== 'enemiesAttack' || step.attacks === undefined)
      throw new Error(`no enemy attacks to resolve\n${this.board()}`);
    for (const attack of step.attacks) this.play({ type: 'ResolveEnemyAttack', ...attack });
  }

  /** The enemy attacks step 3.3 lists, in its order; none outside that step. */
  attacksDue(): DueAttackView[] {
    const [step] = this.current.meta.steps;
    if (step?.id !== 'enemiesAttack') return [];
    return (step.attacks ?? []).map((attack) => ({
      enemy: this.nameOf(this.cardWithId(attack.enemyId)),
      investigator: attack.investigatorId,
    }));
  }

  /** Where each investigator is, by investigator id and location name. */
  investigatorLocations(): Record<string, string> {
    return Object.fromEntries(
      this.current.investigators.map((inv) => [inv.id, this.locationName(inv.locationId)]),
    );
  }

  /** Clues held by each investigator, by investigator id. */
  investigatorClues(): Record<string, number> {
    return Object.fromEntries(this.current.investigators.map((inv) => [inv.id, inv.clues]));
  }

  /** Damage and horror on one investigator. */
  wounds(investigator: InvestigatorId): { damage: number; horror: number } {
    const { health, sanity } = this.investigator(investigator);
    return { damage: health.damage, horror: sanity.horror };
  }

  /** Remaining actions of each investigator, by investigator id. */
  actionsLeft(): Record<string, number> {
    return Object.fromEntries(
      this.current.investigators.map((inv) => [inv.id, inv.actionsRemaining]),
    );
  }

  /** Resources of each investigator, by investigator id. */
  investigatorResources(): Record<string, number> {
    return Object.fromEntries(this.current.investigators.map((inv) => [inv.id, inv.resources]));
  }

  /** Every enemy in play, in card order, as `EnemyView`s. */
  enemies(): EnemyView[] {
    return this.enemiesInPlay().map((enemy) => this.enemyView(enemy));
  }

  /** The one enemy `selector` picks (see `EnemySelector`). */
  enemy(selector: EnemySelector): EnemyView {
    return this.enemyView(this.enemyInstance(selector));
  }

  /** Clues on the location named `locationName`. */
  cluesOn(locationName: string): number {
    return this.locationNamed(locationName).tokens.clue ?? 0;
  }

  /** Names of the locations on a map, in map order. */
  locationsOn(map: string): string[] {
    return this.namesIn({ kind: 'location', mapId: mapId(map) });
  }

  /** The current agenda's name and the doom on it. */
  agenda(): { name: string; doom: number } {
    const agenda = this.currentCard(this.current.agenda.current);
    return { name: this.nameOf(agenda), doom: agenda.tokens.doom ?? 0 };
  }

  /** The current act's name. */
  act(): string {
    return this.nameOf(this.currentCard(this.current.act.current));
  }

  /** Card names in `zone`, top first. */
  namesIn(zone: Zone): string[] {
    return (this.current.order[zoneKey(zone)] ?? []).map((id) => this.nameOf(this.cardWithId(id)));
  }

  /** The open decisions, oldest first, as `DecisionView`s. */
  decisions(): DecisionView[] {
    return this.current.pending.map((decision) => this.decisionView(decision));
  }

  private adjust(investigator: InvestigatorId, stat: InvestigatorStat, delta: number): void {
    this.play({ type: 'AdjustInvestigator', investigatorId: investigator, stat, delta });
  }

  /** The players passed the skill test of decision `id`, confirming `amount` if given. */
  private passTest(id: string, amount?: number): void {
    this.play({
      type: 'ResolveDecision',
      decisionId: decisionId(id),
      optionId: 'pass',
      ...(amount === undefined ? {} : { amount }),
    });
  }

  private investigator(id: string): Investigator {
    const found = this.current.investigators.find((inv) => inv.id === id);
    if (!found) throw new Error(`no investigator ${id}\n${this.board()}`);
    return found;
  }

  private enemiesInPlay(): CardInstance[] {
    return Object.values(this.current.cards).filter(
      (card) =>
        cardStats(this.ctx.cards, card.code).typeCode === 'enemy' && isInPlay(this.current, card),
    );
  }

  /**
   * The one enemy in play `selector` picks. Fails with the board attached
   * when none or several match, naming the narrowing to use, so a script never
   * acts on the wrong copy of a card.
   */
  private enemyInstance(selector: EnemySelector): CardInstance {
    const { name, engagedWith, at } = typeof selector === 'string' ? { name: selector } : selector;
    const matches = cardsNamed(this.ctx, this.current, name, { typeCode: 'enemy' })
      .filter((card) => isInPlay(this.current, card))
      .map((card) => ({ card, view: this.enemyView(card) }))
      .filter(
        ({ view }) =>
          (engagedWith === undefined || view.engagedWith === engagedWith) &&
          (at === undefined || view.at === at),
      );
    if (matches.length > 1)
      throw new Error(
        `${matches.length} enemies match ${JSON.stringify(selector)}; narrow it with { name, engagedWith } or { name, at }\n${this.board()}`,
      );
    return this.onlyOne(
      matches.map(({ card }) => card),
      `enemy matching ${JSON.stringify(selector)}`,
    );
  }

  private enemyView(enemy: CardInstance): EnemyView {
    const engagedWith = enemy.zone.kind === 'engaged' ? enemy.zone.investigatorId : undefined;
    const location =
      enemy.zone.kind === 'atLocation'
        ? enemy.zone.locationId
        : this.investigator(engagedWith ?? '').locationId;
    return {
      name: this.nameOf(enemy),
      at: this.locationName(location),
      ...(engagedWith === undefined ? {} : { engagedWith }),
      ...(enemy.tokens.damage ? { damage: enemy.tokens.damage } : {}),
      ...(enemy.exhausted ? { exhausted: true } : {}),
    };
  }

  private decisionView(decision: Decision): DecisionView {
    const defaults = Object.fromEntries(
      decision.options.flatMap((option) => {
        const counts = {
          ...(option.amount ? { amount: option.amount.default } : {}),
          ...Object.fromEntries(
            Object.entries(option.amounts ?? {}).map(([name, range]) => [name, range.default]),
          ),
        };
        return Object.keys(counts).length > 0 ? [[optionName(option), counts]] : [];
      }),
    );
    return {
      prompt: decision.prompt,
      kind: decision.kind,
      ...(decision.subject === undefined
        ? {}
        : { about: this.nameOf(this.cardWithId(decision.subject)) }),
      ...(decision.decider.kind === 'investigator' ? { for: decision.decider.investigatorId } : {}),
      ...(decision.skillTest ? { test: decision.skillTest } : {}),
      options: decision.options.map(optionName),
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    };
  }

  private locationNamed(name: string): CardInstance {
    return this.onlyOne(
      locationsNamed(this.ctx, this.current, name, { inPlay: true }),
      `location ${name} in play`,
    );
  }

  private onlyOne<T>(found: readonly T[], what: string): T {
    const [only, ...others] = found;
    if (only === undefined || others.length > 0)
      throw new Error(`expected exactly one ${what}, found ${found.length}\n${this.board()}`);
    return only;
  }

  private currentCard(id: string | undefined): CardInstance {
    if (id === undefined) throw new Error(`no current card\n${this.board()}`);
    return this.cardWithId(id);
  }

  private cardWithId(id: string): CardInstance {
    const card = this.current.cards[instanceId(id)];
    if (!card) throw new Error(`no card ${id}\n${this.board()}`);
    return card;
  }

  private locationName(id: string | undefined): string {
    return id === undefined ? 'nowhere' : this.nameOf(this.cardWithId(id));
  }

  private nameOf(card: CardInstance): string {
    return cardStats(this.ctx.cards, card.code).name;
  }
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
