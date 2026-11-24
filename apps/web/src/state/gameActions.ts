import {
  CommandRejected,
  optionNamed,
  placeDoomOn,
  type Adjustment,
  type Command,
  type Decision,
  type GameState,
  type InstanceId,
  type InvestigatorId,
  type InvestigatorStat,
  type PlayTable,
  type ChaosToken,
  type ResolveDecision,
  type TokenKind,
} from '@arkham/engine';

/**
 * The tokens the players place, move and take back by hand (`adjustTokens`): the clues and doom a
 * location's − / + bubble changes, and those dragged to and from the token pool.
 */
type LooseToken = Extract<TokenKind, 'clue' | 'doom'>;

/** The investigator counters the screen's − / + bubbles change. */
export type SteppedStat = Extract<InvestigatorStat, 'resources' | 'damage' | 'horror'>;

/**
 * How an investigator moves, investigates, fights, evades or engages: as one of the turn
 * investigator's actions (`action`, counted off by the engine, provoking attacks of opportunity),
 * as a free one a card lets them take (`free`: it costs only what a card adds (Frozen in Fear)
 * and provokes nothing), or as a card effect has `byCard` investigator do it, whoever's turn it
 * is: no action, no attacks of opportunity, and away from their location (Shortcut, In the Know,
 * Marksmanship, Heroic Rescue).
 */
export type How = 'action' | 'free' | { byCard: InvestigatorId };

/** The commands a `How` takes as an action or by card. */
type TurnActionCommand = Extract<
  Command,
  { type: 'MoveInvestigator' | 'Investigate' | 'Fight' | 'Evade' | 'EngageEnemy' }
>;

/**
 * An effect the players carry out by hand from card text, as the engine command that does it
 * (damage, defeat or move an enemy, place doom, draw an encounter card: `encounterDraw`): the engine resolves it
 * by the rules, so forced effects fire. A mistake is undone with `correct` instead.
 */
export type PlayerEffect = Extract<
  Command,
  {
    type:
      | 'AdjustInvestigator'
      | 'Advance'
      | 'AttachPlayerCard'
      | 'ChangeChaosBag'
      | 'DamageEnemy'
      | 'DefeatEnemy'
      | 'DiscoverClues'
      | 'DisengageEnemy'
      | 'DrawCard'
      | 'DrawWeakness'
      | 'EndScenario'
      | 'EvadeEnemy'
      | 'ExhaustEnemy'
      | 'HealEnemy'
      | 'MoveCard'
      | 'MoveEnemy'
      | 'MoveTokens'
      | 'ReadyEnemy'
      | 'ReleaseChaosToken'
      | 'RevealLocation'
      | 'SealChaosToken'
      | 'SpawnEnemy';
  }
>;

/**
 * `investigator` takes one clue from `location`, their own, without a test, as a card grants it
 * (`DiscoverClues`), or as a clue dragged onto their pawn says.
 */
export function takeOneClue(location: InstanceId, investigator: InvestigatorId): PlayerEffect {
  return { type: 'DiscoverClues', investigatorId: investigator, locationId: location, amount: 1 };
}

/** Counts the players confirm when they answer a decision (clues found, damage soaked). */
export interface DecisionAmounts {
  /** For an option with one `amount` range. */
  amount?: number;
  /** For an option with named ranges, such as an attack's `damage` and `horror`. */
  amounts?: ResolveDecision['amounts'];
  /** For a skill test: how much it passed or failed by, as the chaos draw worked it out. */
  margin?: number;
  /** For a skill test: the tokens the app drew, so the bless and curse among them go back to their pool. */
  revealed?: readonly ChaosToken[];
}

/** The answer to the choice an option asks next (`DecisionView.followUps`): its option and counts. */
interface FollowUpAnswer {
  option: string;
  counts?: DecisionAmounts;
}

/**
 * What the play screen can do to the open game, in the players' words: a few turn verbs over
 * `PlayTable`, and the commands the players `perform` or `correct`, with the screen's defaults:
 * - An action (`How`) is taken by the investigator whose turn it is, since the rules allow actions
 *   only during one's own turn; without a turn it is refused with `noTurnInProgress`. The engine
 *   counts off what it costs and refuses it when too few actions are left.
 * - The decision dialog shows the first open decision, so an answer picks an option of that one;
 *   without one it is refused with `noPendingDecision`.
 * - A skill test is never assumed passed (the chaos bag is on the table): an action leaves it
 *   open, and the players report it like any decision, by answering `pass` or `fail`.
 * - Anything else the players change is one of two kinds. An effect they carry out from card text
 *   is `perform`ed: a real command, so forced effects fire as the rules say. A mistake they fix is
 *   `correct`ed: a `ManualAdjust`, which fires nothing. The one mix is `adjustTokens`, a token
 *   stepper, which places doom added by rule.
 *
 * Each call is one step: stored before it shows, one undo group, and a refusal ends up in
 * `OpenGame.rejection`.
 */
export interface GameActions {
  /** The phase assistant's "Next". */
  nextPhase(): Promise<void>;
  /** Begins the turn of `investigator`, whom the players picked. */
  startTurn(investigator: InvestigatorId): Promise<void>;
  endTurn(): Promise<void>;
  /**
   * The turn investigator takes action number `action` of the card `card` offers them
   * (`BoardView.cardActions`), such as the Parlor's Resign; the engine counts off the action it
   * costs unless it is free. For a group clue cost (`CardActionView.groupClues`), `spend` lists who
   * pays how many (omitted, the taker pays what they can and the others the rest).
   */
  useCardAction(card: InstanceId, action: number, spend?: readonly ClueSpend[]): Promise<void>;
  /**
   * A move to `location`. As an action or a free one, along a connection; by a card, connected or
   * not (Astral Travel, Shortcut): as on any move, enemies engaged with them come along and ready
   * enemies there engage. The pawn's drag moves its investigator by card, since it catches the
   * screen up with a move made at the table.
   */
  move(location: InstanceId, how?: How): Promise<void>;
  /**
   * An investigation of the investigator's own location, or of `location` when a card names
   * another (In the Know). Its test stays open as a decision.
   */
  investigate(location?: InstanceId, how?: How): Promise<void>;
  /** The resource action: one action for one resource. */
  takeResource(): Promise<void>;
  /** The draw action; the card is drawn at the table. */
  drawCard(): Promise<void>;
  /**
   * The play action; the card is played at the table, its `cost` spent from the turn
   * investigator's resources in the same step (`PlayCard.cost`), else paid by hand.
   */
  playCard(cost?: number): Promise<void>;
  /**
   * A fight against `enemy`, at the fighter's location, or anywhere by a card (Marksmanship); its
   * test stays open as a decision.
   */
  fight(enemy: InstanceId, how?: How): Promise<void>;
  /** An evasion of `enemy`, like `fight`; its test stays open as a decision. */
  evade(enemy: InstanceId, how?: How): Promise<void>;
  /** An engagement of `enemy` at the investigator's location; by a card it takes no action (Heroic Rescue). */
  engage(enemy: InstanceId, how?: How): Promise<void>;
  /**
   * Picks `option` of the first open decision by its readable name (`DecisionView.options`), as the
   * decision dialog lists them, and with `then` the choice that option asks next
   * (`DecisionView.followUps`), in the same step, so one undo takes both back.
   */
  answer(option: string, counts?: DecisionAmounts, then?: FollowUpAnswer): Promise<void>;
  /**
   * The investigator whose turn it is takes the act's spend-clues action: the investigators spend
   * the clues listed with them (omitted, that investigator pays what they can and the others the
   * rest) and the act advances.
   */
  advanceAct(spend?: readonly ClueSpend[]): Promise<void>;
  /**
   * `delta` more (or, negative, fewer) of `token` on `card` in play (a location, an enemy, the agenda): one tap
   * on a location's stepper, or a token dragged from or to the token pool. Doom added is placed by
   * rule (`MoveTokens` from the pool), so effects that count placed doom see it; the rest are
   * corrections.
   */
  adjustTokens(card: InstanceId, token: LooseToken, delta: number): Promise<void>;
  /** The players carry out `effects` from card text, in order, as one step. */
  perform(...effects: readonly PlayerEffect[]): Promise<void>;
  /** The players fix a mistake with `adjustments`, in order, as one step (`ManualAdjust`). */
  correct(...adjustments: readonly Adjustment[]): Promise<void>;
  /** Takes back the last step; never the scenario start. */
  undo(): Promise<void>;
  /**
   * Goes back to right after the step `stepId` of the game log (`LogStep.id`): every later step is
   * taken back.
   */
  undoTo(stepId: string): Promise<void>;
}

/**
 * The play screen's actions over a `PlayTable` that `play` runs one step at a time and stores, and
 * the `undo` that takes a step back, or every step after the step it names. The table stays behind
 * this facade, so its test defaults and its matchers never reach a component.
 */
export function gameActions(
  play: (step: (table: PlayTable) => void) => Promise<void>,
  undo: (toStep?: string) => Promise<void>,
): GameActions {
  const onTurn = (action: (table: PlayTable, investigator: InvestigatorId) => void) =>
    play((table) => action(table, turnInvestigator(table.state)));
  /** Plays `command` for the investigator `how` names, as an action of theirs unless by card. */
  const taking = (how: How, command: (investigator: InvestigatorId) => TurnActionCommand) =>
    typeof how === 'object'
      ? play((table) => table.play(command(how.byCard)))
      : onTurn((table, investigator) =>
          table.play({ ...command(investigator), asAction: how === 'free' ? 'free' : true }),
        );
  return {
    nextPhase: () => play((table) => void table.nextPhase()),
    startTurn: (investigator) => play((table) => table.startTurn(investigator)),
    endTurn: () => onTurn((table, investigator) => table.endTurn(investigator)),
    useCardAction: (card, action, spend) =>
      onTurn((table, investigator) => {
        table.useCardAction(
          investigator,
          card,
          action,
          spend?.map(({ investigator: payer, clues }) => [payer, clues]),
        );
      }),
    move: (location, how = 'action') =>
      taking(how, (investigator) => ({
        type: 'MoveInvestigator',
        investigatorId: investigator,
        to: location,
        ...(typeof how === 'object' && { ignoreConnections: true }),
      })),
    investigate: (location, how = 'action') =>
      taking(how, (investigator) => ({
        type: 'Investigate',
        investigatorId: investigator,
        ...(location !== undefined && { locationId: location }),
      })),
    takeResource: () => onTurn((table, investigator) => table.takeResource(investigator)),
    drawCard: () => onTurn((table, investigator) => table.drawCard(investigator)),
    playCard: (cost) => onTurn((table, investigator) => table.playCard(investigator, cost)),
    fight: (enemy, how = 'action') =>
      taking(how, (investigator) => ({
        type: 'Fight',
        investigatorId: investigator,
        enemyId: enemy,
        ...(typeof how === 'object' && { atAnyLocation: true }),
      })),
    evade: (enemy, how = 'action') =>
      taking(how, (investigator) => ({
        type: 'Evade',
        investigatorId: investigator,
        enemyId: enemy,
        ...(typeof how === 'object' && { atAnyLocation: true }),
      })),
    engage: (enemy, how = 'action') =>
      taking(how, (investigator) => ({
        type: 'EngageEnemy',
        investigatorId: investigator,
        enemyId: enemy,
      })),
    answer: (option, counts = {}, then) =>
      play((table) => {
        const decision = firstDecision(table.state);
        const before = table.state.pending;
        resolve(table, decision, option, counts);
        if (!then) return;
        // The choice the option asks is the one decision its answer opened.
        const asked = table.state.pending.find((each) => !before.some((old) => old.id === each.id));
        if (!asked) throw new CommandRejected({ code: 'noPendingDecision' });
        resolve(table, asked, then.option, then.counts);
      }),
    advanceAct: (spend) =>
      play((table) =>
        table.spendCluesToAdvanceAct(
          spend?.map(({ investigator, clues }) => [investigator, clues]),
        ),
      ),
    adjustTokens: (card, token, delta) =>
      play((table) =>
        table.play(
          token === 'doom' && delta > 0
            ? placeDoomOn(card, delta)
            : {
                type: 'ManualAdjust',
                adjustment: { kind: 'tokens', cardId: card, token, delta },
              },
        ),
      ),
    perform: (...effects) =>
      play((table) => {
        for (const effect of effects) table.play(effect);
      }),
    correct: (...adjustments) =>
      play((table) => {
        for (const adjustment of adjustments) table.play({ type: 'ManualAdjust', adjustment });
      }),
    undo: () => undo(),
    undoTo: (stepId) => undo(stepId),
  };
}

/** Whose turn it is; refused like an engine command when no one's is. */
function turnInvestigator(state: GameState): InvestigatorId {
  const investigator = state.meta.turn?.investigatorId;
  if (investigator === undefined) throw new CommandRejected({ code: 'noTurnInProgress' });
  return investigator;
}

/** Answers `decision` with the option named `option` and its counts. */
function resolve(
  table: PlayTable,
  decision: Decision,
  option: string,
  counts: DecisionAmounts = {},
): void {
  table.play({
    type: 'ResolveDecision',
    decisionId: decision.id,
    // A name no option has goes on as an id, so the engine refuses it as `unknownOption`.
    optionId: optionNamed(decision, option)?.id ?? option,
    ...counts,
  });
}

/** The decision the dialog shows; refused like an engine command when none is open. */
function firstDecision(state: GameState): Decision {
  const [decision] = state.pending;
  if (decision === undefined) throw new CommandRejected({ code: 'noPendingDecision' });
  return decision;
}

/** Clues one investigator pays towards a group clue cost (`GameActions.advanceAct`, `useCardAction`). */
export interface ClueSpend {
  investigator: InvestigatorId;
  clues: number;
}
