import {
  cardStats,
  cardsNamed,
  checkInvariants,
  compileSetup,
  emptyState,
  enemyAttackList,
  execute,
  formatBoard,
  instanceId,
  isInPlay,
  locationsNamed,
  mapId,
  zoneKey,
  type CardInstance,
  type Command,
  type EngineContext,
  type Event,
  type GameState,
  type Investigator,
  type InvestigatorId,
  type InvestigatorStat,
  type ScenarioDefinition,
  type Zone,
} from '@arkham/engine';

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
 * (`moveTo(seeker, 'Attic')`, `drawEncounterCards()`) so a scripted session
 * reads like a session report. Every step is an engine command run through
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
  private readonly log: Event[] = [];

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
    return this.log;
  }

  /** The board as text (`formatBoard`), for snapshots and failure messages. */
  board(): string {
    return formatBoard(this.ctx, this.current);
  }

  /** Runs one command and fails if it leaves the state inconsistent. */
  play(command: Command): void {
    const result = execute(this.ctx, this.current, command);
    this.current = result.state;
    this.log.push(...result.events);
    const violations = checkInvariants(this.current);
    if (violations.length > 0)
      throw new Error(
        `${command.type} broke invariants: ${violations.join('; ')}\n${this.board()}`,
      );
  }

  /** Mythos step 1.2: one doom on the current agenda. */
  placeMythosDoom(): void {
    this.placeDoom(1);
  }

  /** Doom from a card effect (e.g. Ancient Evils) on the current agenda. */
  placeDoom(amount: number): void {
    this.play({ type: 'PlaceDoom', amount });
  }

  /** The players answer the agenda's doom threshold by advancing it. */
  advanceAgenda(): void {
    this.play({ type: 'AdvanceAgenda' });
  }

  /** Mythos step 1.4: each active investigator draws an encounter card, in player order. */
  drawEncounterCards(): void {
    for (const investigator of this.activeInvestigators())
      this.play({ type: 'DrawEncounter', investigatorId: investigator.id });
  }

  /** Moves an investigator along a connection to the location named `locationName`. */
  moveTo(investigator: InvestigatorId, locationName: string): void {
    this.play({
      type: 'MoveInvestigator',
      investigatorId: investigator,
      to: this.locationNamed(locationName).id,
    });
  }

  /** A successful investigation: `amount` clues from the investigator's location. */
  discoverClues(investigator: InvestigatorId, amount: number): void {
    const locationId = this.investigator(investigator).locationId;
    if (locationId === undefined) throw new Error(`${investigator} is at no location`);
    this.play({ type: 'DiscoverClues', investigatorId: investigator, locationId, amount });
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

  /** The enemy named `enemyName` engages the investigator (or switches to them). */
  engage(investigator: InvestigatorId, enemyName: string): void {
    this.play({
      type: 'EngageEnemy',
      enemyId: this.enemyNamed(enemyName).id,
      investigatorId: investigator,
    });
  }

  /** A successful evade: the enemy is disengaged and exhausted, and stays where it is. */
  evade(enemyName: string): void {
    const enemyId = this.enemyNamed(enemyName).id;
    this.play({ type: 'DisengageEnemy', enemyId });
    this.play({ type: 'ExhaustEnemy', enemyId });
  }

  /** A successful attack for `damage` on the enemy named `enemyName`. */
  fight(enemyName: string, damage: number): void {
    this.play({ type: 'DamageEnemy', enemyId: this.enemyNamed(enemyName).id, amount: damage });
  }

  /** Damage from a failed treachery test or an attack. */
  takeDamage(investigator: InvestigatorId, amount: number): void {
    this.adjust(investigator, 'damage', amount);
  }

  /** Horror from a failed treachery test, an attack or an agenda's reverse side. */
  takeHorror(investigator: InvestigatorId, amount: number): void {
    this.adjust(investigator, 'horror', amount);
  }

  /** Enemy step 3.2: hunters move. */
  moveHunters(): void {
    this.play({ type: 'MoveHunters' });
  }

  /** Enemy step 3.3: each ready engaged enemy attacks (`enemyAttackList`) and exhausts. */
  resolveEnemyAttacks(): void {
    for (const attack of enemyAttackList(this.ctx, this.current)) {
      if (attack.damage > 0) this.takeDamage(attack.investigatorId, attack.damage);
      if (attack.horror > 0) this.takeHorror(attack.investigatorId, attack.horror);
      this.play({ type: 'ExhaustEnemy', enemyId: attack.enemyId });
    }
  }

  /** Upkeep: every exhausted enemy in play readies, each investigator gains 1 resource. */
  upkeep(): void {
    for (const enemy of this.enemiesInPlay().filter((card) => card.exhausted))
      this.play({ type: 'ReadyEnemy', enemyId: enemy.id });
    for (const investigator of this.activeInvestigators())
      this.adjust(investigator.id, 'resources', 1);
  }

  /** Where each investigator is, by location name. */
  investigatorLocations(): Record<string, string> {
    return Object.fromEntries(
      this.current.investigators.map((inv) => [inv.name, this.locationName(inv.locationId)]),
    );
  }

  /** Clues held by each investigator. */
  investigatorClues(): Record<string, number> {
    return Object.fromEntries(this.current.investigators.map((inv) => [inv.name, inv.clues]));
  }

  /** Damage and horror on one investigator. */
  wounds(investigator: InvestigatorId): { damage: number; horror: number } {
    const { health, sanity } = this.investigator(investigator);
    return { damage: health.damage, horror: sanity.horror };
  }

  /** Resources of each investigator. */
  investigatorResources(): Record<string, number> {
    return Object.fromEntries(this.current.investigators.map((inv) => [inv.name, inv.resources]));
  }

  /**
   * One line per enemy in play, in card order: name, location, engagement,
   * then damage and exhaustion if any, e.g. "Icy Ghoul: Cellar, engaged with rogue, 2 damage".
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
   * One line per open decision: its kind, the card it is about and the option
   * labels, e.g. "chooseInvestigator about Swarm of Rats: tank, seeker, rogue".
   */
  pendingDecisions(): string[] {
    return this.current.pending.map((decision) => {
      const about =
        decision.subject === undefined
          ? ''
          : ` about ${this.nameOf(this.cardWithId(decision.subject))}`;
      return `${decision.kind}${about}: ${decision.options.map((option) => option.label).join(', ')}`;
    });
  }

  private adjust(investigator: InvestigatorId, stat: InvestigatorStat, delta: number): void {
    this.play({ type: 'AdjustInvestigator', investigatorId: investigator, stat, delta });
  }

  private activeInvestigators(): Investigator[] {
    return this.current.investigators.filter((inv) => inv.status === 'active');
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
