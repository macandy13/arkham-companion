import {
  actionAllowance,
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
  optionNamed,
  replay,
  mapId,
  undoLastGroup,
  zoneKey,
  type CardInstance,
  type Command,
  type EngineContext,
  type Event,
  type GameState,
  type Investigator,
  type InvestigatorId,
  type InvestigatorStat,
  type Phase,
  type ScenarioDefinition,
  type TableAction,
  type Zone,
} from '@arkham/engine';

/** An event with the id of the command that produced it, as the store's undo groups them. */
interface LoggedEvent {
  commandId: string;
  event: Event;
}

/** What `TestTable.setUp` needs to start a scenario. */
export interface TableOptions {
  scenario: ScenarioDefinition;
  ctx: EngineContext;
  /** In seat order; the first one is the lead investigator. */
  investigators: readonly Investigator[];
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
   * on to the next phase.
   */
  nextPhase(): void {
    this.play({ type: 'NextPhase' });
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

  /** The turn in progress as `formatBoard` shows it, e.g. "Daisy Walker, actions 1/3". */
  turn(): string {
    const { turn } = this.current.meta;
    if (!turn) return 'none';
    const name = this.investigator(turn.investigatorId).name;
    return `${name}, actions ${turn.actionsTaken}/${actionAllowance(this.current, turn)}`;
  }

  /** A card effect changes the action allowance of the investigator's turn by `delta`. */
  adjustActions(investigator: InvestigatorId, delta: number): void {
    this.play({ type: 'AdjustActions', investigatorId: investigator, delta });
  }

  /** An action resolved at the table (draw, resource, play, activate), counted against the turn. */
  takeAction(investigator: InvestigatorId, action: TableAction): void {
    this.play({ type: 'TakeAction', investigatorId: investigator, action });
  }

  /** Doom from a card effect (e.g. Ancient Evils) on the current agenda. */
  placeDoom(amount: number): void {
    this.play({ type: 'PlaceDoom', amount });
  }

  /**
   * Answers the open decision about the card named `subjectName` by picking
   * the option shown as `optionName` (e.g. `answer('Swarm of Rats', 'Roland
   * Banks')`, `answer("What's Going On?!", 'yes')`). Fails with the board
   * attached if no such decision or option exists, so a script that answers
   * the wrong question breaks where it happens.
   */
  answer(subjectName: string, optionName: string): void {
    const decision = this.current.pending.find(
      (pending) =>
        pending.subject !== undefined &&
        this.nameOf(this.cardWithId(pending.subject)) === subjectName,
    );
    if (!decision) throw new Error(`no open decision about ${subjectName}\n${this.board()}`);
    const option = optionNamed(decision, optionName);
    if (!option)
      throw new Error(
        `no option ${optionName} in: ${describeDecision(this.ctx, this.current, decision)}\n${this.board()}`,
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
   */
  investigate(investigator: InvestigatorId, { clues }: { clues?: number } = {}): void {
    this.play({ type: 'Investigate', investigatorId: investigator });
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
   * The enemy named `enemyName` engages the investigator (or switches to
   * them): an engage action, or with `free` a rule that engages without one
   * (an enemy at the location the investigator enters).
   */
  engage(investigator: InvestigatorId, enemyName: string, { free }: { free?: boolean } = {}): void {
    this.play({
      type: 'EngageEnemy',
      enemyId: this.enemyNamed(enemyName).id,
      investigatorId: investigator,
      ...(free ? { free } : {}),
    });
  }

  /**
   * An evade action against the enemy engaged with the investigator, whose
   * agility test the players pass: it is disengaged and exhausted, and stays where it is.
   */
  evade(investigator: InvestigatorId, enemyName: string): void {
    const enemy = this.enemyEngagedWith(investigator, enemyName);
    this.play({ type: 'Evade', investigatorId: investigator, enemyId: enemy.id });
    this.passTest(`evade:${investigator}:${enemy.id}`);
  }

  /**
   * A fight action against the enemy engaged with the investigator, whose
   * combat test the players pass. It deals the basic attack's 1 damage, or
   * the `damage` the players confirm (a weapon, a skill card adding damage).
   */
  fight(
    investigator: InvestigatorId,
    enemyName: string,
    { damage }: { damage?: number } = {},
  ): void {
    const enemy = this.enemyEngagedWith(investigator, enemyName);
    this.play({ type: 'Fight', investigatorId: investigator, enemyId: enemy.id });
    this.passTest(`fight:${investigator}:${enemy.id}`, damage);
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
    if (step?.id !== '3.3' || step.attacks === undefined)
      throw new Error(`no enemy attacks to resolve\n${this.board()}`);
    for (const attack of step.attacks) this.play({ type: 'ResolveEnemyAttack', ...attack });
  }

  /** One line per enemy attack step 3.3 lists, e.g. "Swarm of Rats attacks roland". */
  attacksDue(): string[] {
    const [step] = this.current.meta.steps;
    if (step?.id !== '3.3') return [];
    return (step.attacks ?? []).map(
      (attack) =>
        `${this.nameOf(this.cardWithId(attack.enemyId))} attacks ${attack.investigatorId}`,
    );
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

  /** Resources of each investigator, by investigator id. */
  investigatorResources(): Record<string, number> {
    return Object.fromEntries(this.current.investigators.map((inv) => [inv.id, inv.resources]));
  }

  /**
   * One line per enemy in play, in card order: name, location, engagement,
   * then damage and exhaustion if any, e.g. "Icy Ghoul: Cellar, engaged with wendy, 2 damage".
   */
  enemyLines(): string[] {
    return this.enemiesInPlay().map((enemy) => {
      const engagedWith = enemy.zone.kind === 'engaged' ? enemy.zone.investigatorId : undefined;
      const location =
        enemy.zone.kind === 'atLocation'
          ? enemy.zone.locationId
          : this.investigator(engagedWith ?? '').locationId;
      return [
        `${this.nameOf(enemy)}: ${this.locationName(location)}`,
        engagedWith === undefined ? 'unengaged' : `engaged with ${engagedWith}`,
        ...(enemy.tokens.damage ? [`${enemy.tokens.damage} damage`] : []),
        ...(enemy.exhausted ? ['exhausted'] : []),
      ].join(', ');
    });
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

  /**
   * One line per open decision (`describeDecision`): the question, the options
   * by name and the kind, e.g. "Whom does Swarm of Rats engage? Roland Banks /
   * Daisy Walker / Wendy Adams [chooseInvestigator]".
   */
  pendingDecisions(): string[] {
    return this.current.pending.map((decision) =>
      describeDecision(this.ctx, this.current, decision),
    );
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

  /** The one copy of `name` in play; several copies of a name (rats, minions) are never in play together here. */
  private enemyNamed(name: string): CardInstance {
    const inPlay = cardsNamed(this.ctx, this.current, name, { typeCode: 'enemy' }).filter((card) =>
      isInPlay(this.current, card),
    );
    return this.onlyOne(inPlay, `enemy ${name} in play`);
  }

  /** The enemy named `name`, which must be engaged with `investigator` for their action to target it. */
  private enemyEngagedWith(investigator: InvestigatorId, name: string): CardInstance {
    const enemy = this.enemyNamed(name);
    if (enemy.zone.kind !== 'engaged' || enemy.zone.investigatorId !== investigator)
      throw new Error(`${name} is not engaged with ${investigator}\n${this.board()}`);
    return enemy;
  }

  private locationNamed(name: string): CardInstance {
    return this.onlyOne(
      locationsNamed(this.ctx, this.current, name, { inPlay: true }),
      `location ${name} in play`,
    );
  }

  private onlyOne(cards: readonly CardInstance[], what: string): CardInstance {
    const [only, ...others] = cards;
    if (only === undefined || others.length > 0)
      throw new Error(`expected exactly one ${what}, found ${cards.length}\n${this.board()}`);
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
