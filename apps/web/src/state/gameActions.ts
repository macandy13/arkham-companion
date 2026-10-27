import {
  atLocation,
  CommandRejected,
  encounterDiscard,
  engagedWith,
  setAside,
  threatAreaOf,
  optionNamed,
  type Decision,
  type GameState,
  type InstanceId,
  type InvestigatorId,
  type InvestigatorStat,
  type PlayTable,
  type ResolveDecision,
  type SkillName,
  type TokenKind,
  type Zone,
} from '@arkham/engine';
import type { CardMove } from '../encounter/cardMoves';
import { assertNever } from '@arkham/util';

/** The tokens on a location that its menu's +/− steppers change. */
export type LocationToken = Extract<TokenKind, 'clue' | 'doom'>;

/** The investigator counters the screen's +/− steppers change. */
export type SteppedStat = Extract<InvestigatorStat, 'resources' | 'damage' | 'horror'>;

/** Whether a step on the turn spends one of the investigator's actions or is free (a card allows it). */
export type ActionCost = 'action' | 'free';

/** Counts the players confirm when they answer a decision (clues found, damage soaked). */
export interface DecisionAmounts {
  /** For an option with one `amount` range. */
  amount?: number;
  /** For an option with named ranges, such as an attack's `damage` and `horror`. */
  amounts?: ResolveDecision['amounts'];
  /** For a skill test: how much it passed or failed by, as the chaos draw worked it out. */
  margin?: number;
}

/**
 * What the play screen can do to the open game, in the players' words. It mirrors `PlayTable`'s
 * verbs, but with the screen's defaults:
 * - An action is taken by the investigator whose turn it is, since the rules allow actions only
 *   during one's own turn; without a turn it is refused with `noTurnInProgress`. Investigate,
 *   engage, and fight and evade unless free, count off one of their actions, which the engine
 *   leaves to the players; with none left they are refused, and `adjustActions` grants more.
 * - The decision dialog shows the first open decision, so an answer picks an option of that one;
 *   without one it is refused with `noPendingDecision`.
 * - A skill test is never assumed passed (the chaos bag is on the table): an action leaves it
 *   open, and the players report it like any decision, by answering `pass` or `fail`.
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
   * (`BoardView.cardActions`), such as the Parlor's Resign, counting off the action it costs.
   */
  useCardAction(card: InstanceId, action: number): Promise<void>;
  /** Changes the actions left this turn. */
  adjustActions(delta: number): Promise<void>;
  /**
   * A move to a connected location. As an action it counts off one and provokes attacks of
   * opportunity; free (the default, as the pawn's drag plays it) it does neither, since a card
   * allows it or the drag catches the screen up with a move made at the table.
   */
  moveTo(location: InstanceId, cost?: ActionCost): Promise<void>;
  /** An investigate action; its test stays open as a decision. */
  investigate(): Promise<void>;
  /** One clue from `location`, the investigator's own, without a test, as a card grants it. */
  takeClue(location: InstanceId): Promise<void>;
  /**
   * A fight; its test stays open as a decision. It is an action unless `cost` says `free`, as a
   * card can let an investigator fight without spending one.
   */
  fight(enemy: InstanceId, cost?: ActionCost): Promise<void>;
  /** An evade; its test stays open as a decision. An action unless `cost` says `free`, like `fight`. */
  evade(enemy: InstanceId, cost?: ActionCost): Promise<void>;
  /** An engage action. */
  engage(enemy: InstanceId): Promise<void>;
  /**
   * Moves `enemy` to `location` as a card instruction says, connected or not. The players follow
   * the instruction whatever the engagement, so an engaged enemy disengages and moves too.
   */
  moveEnemy(enemy: InstanceId, location: InstanceId): Promise<void>;
  /** `amount` damage on `enemy`, as a card effect deals it; enough of it defeats the enemy. */
  damageEnemy(enemy: InstanceId, amount: number): Promise<void>;
  /** A card effect disengages `enemy`; it stays where it is. */
  disengageEnemy(enemy: InstanceId): Promise<void>;
  /** A card effect defeats `enemy` outright. */
  defeatEnemy(enemy: InstanceId): Promise<void>;
  /**
   * Picks `option` of the first open decision by its readable name (`DecisionView.options`), as the
   * decision dialog lists them.
   */
  answer(option: string, counts?: DecisionAmounts): Promise<void>;
  /** Enemy step 3.3: each listed enemy attack at its printed damage and horror. */
  resolveEnemyAttacks(): Promise<void>;
  /**
   * The investigators spend the clues listed with them to advance the act; the clues on the act
   * (`adjustActClues`) count towards it, so `spend` covers only the rest.
   */
  advanceAct(spend: readonly ClueSpend[]): Promise<void>;
  /**
   * The act card's +/− steppers: `delta` more (or, negative, fewer) clues on the current act, a
   * correction by hand that leaves the investigators' clues alone.
   */
  adjustActClues(delta: number): Promise<void>;
  /** One tap on an investigator's stepper: `delta` more (or, negative, fewer) of `stat`. */
  adjust(investigator: InvestigatorId, stat: SteppedStat, delta: number): Promise<void>;
  /**
   * One tap on a skill's stepper: the lasting boost of `skill` (`Investigator.skillBoosts`, what
   * player cards in play add) changed by `delta`, a correction by hand (`ManualAdjust`).
   */
  boostSkill(investigator: InvestigatorId, skill: SkillName, delta: number): Promise<void>;
  /**
   * `investigator` draws the top card of the encounter deck, at any time, as player cards and
   * effects say; it resolves like a mythos draw. Not tied to the turn, since any active
   * investigator may be told to draw.
   */
  drawEncounter(investigator: InvestigatorId): Promise<void>;
  /**
   * Puts the encounter card `card` where `move` says, a correction by hand (`ManualAdjust`) for a
   * revelation the engine left to the players: onto the discard pile, set aside, into a threat area,
   * or at a location, engaged with an investigator there when `move` names one.
   */
  moveEncounterCard(card: InstanceId, move: CardMove): Promise<void>;
  /**
   * Spawns `enemy` from a pile at `location`, which the players chose on the map: the engine
   * engages it there by the rules (prey, Aloof), as if a card effect spawned it there.
   */
  spawnEnemy(enemy: InstanceId, location: InstanceId): Promise<void>;
  /** Doom on the current agenda. */
  placeDoom(amount: number): Promise<void>;
  /** Doom taken off the current agenda by hand (a card effect, a miscount). */
  removeDoom(amount: number): Promise<void>;
  /** Turns `location` face up, as a card effect says or the players catch up with the table. */
  revealLocation(location: InstanceId): Promise<void>;
  /**
   * One tap on a location's stepper: `delta` more (or, negative, fewer) of `token` on `location`.
   * Doom added is placed by rule (`PlaceDoom`), so effects that count placed doom see it; the
   * engine has no command that places or removes clues or removes doom yet, so the rest are
   * corrections by hand (`ManualAdjust`), like the header's `removeDoom`.
   */
  adjustLocation(location: InstanceId, token: LocationToken, delta: number): Promise<void>;
  /** Takes back the last step; never the scenario start. While adjusting, the last tap. */
  undo(): Promise<void>;
  /**
   * "Adjust board": the actions after it change the screen only, until `finishAdjusting` stores
   * them all as one step, so one undo takes the whole correction back, or `cancelAdjusting` drops
   * them (`OpenGame.adjusting` meanwhile). Every action joins the adjustment, so the screen offers
   * only corrections while it lasts.
   */
  startAdjusting(): Promise<void>;
  /** "Done": stores the adjustment as one step. */
  finishAdjusting(): Promise<void>;
  /** "Cancel": drops the adjustment; the board is as it was before `startAdjusting`. */
  cancelAdjusting(): Promise<void>;
}

/** How the open game starts, stores and drops an adjustment (`GameSession`'s adjusting verbs). */
export interface Adjusting {
  start(): Promise<void>;
  finish(): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * The play screen's actions over a `PlayTable` that `play` runs one step at a time and stores, and
 * the `undo` that takes a step back. The table stays behind this facade, so its test defaults and
 * its matchers never reach a component.
 */
export function gameActions(
  play: (step: (table: PlayTable) => void) => Promise<void>,
  undo: () => Promise<void>,
  adjusting: Adjusting,
): GameActions {
  const onTurn = (action: (table: PlayTable, investigator: InvestigatorId) => void) =>
    play((table) => action(table, turnInvestigator(table.state)));
  // The engine leaves counting actions to the players, so the screen counts off the one it takes.
  const asAction = (action: (table: PlayTable, investigator: InvestigatorId) => void) =>
    onTurn((table, investigator) => {
      table.spendAction(investigator);
      action(table, investigator);
    });
  const costing = (cost: ActionCost) => (cost === 'action' ? asAction : onTurn);
  return {
    nextPhase: () => play((table) => void table.nextPhase()),
    startTurn: (investigator) => play((table) => table.startTurn(investigator)),
    endTurn: () => onTurn((table, investigator) => table.endTurn(investigator)),
    useCardAction: (card, action) =>
      asAction((table, investigator) => table.useCardAction(investigator, card, action)),
    adjustActions: (delta) =>
      onTurn((table, investigator) => table.adjustActions(investigator, delta)),
    moveTo: (location, cost = 'free') =>
      cost === 'action'
        ? asAction((table, investigator) => table.moveTo(investigator, location))
        : onTurn((table, investigator) =>
            table.play({ type: 'MoveInvestigator', investigatorId: investigator, to: location }),
          ),
    investigate: () =>
      asAction((table, investigator) => table.investigate(investigator, { result: 'open' })),
    takeClue: (location) =>
      onTurn((table, investigator) =>
        table.play({
          type: 'DiscoverClues',
          investigatorId: investigator,
          locationId: location,
          amount: 1,
        }),
      ),
    fight: (enemy, cost = 'action') =>
      costing(cost)((table, investigator) => table.fight(investigator, enemy, { result: 'open' })),
    evade: (enemy, cost = 'action') =>
      costing(cost)((table, investigator) => table.evade(investigator, enemy, { result: 'open' })),
    engage: (enemy) => asAction((table, investigator) => table.engage(investigator, enemy)),
    moveEnemy: (enemy, location) =>
      play((table) => table.moveEnemy(enemy, location, { forced: true })),
    damageEnemy: (enemy, amount) =>
      play((table) => table.play({ type: 'DamageEnemy', enemyId: enemy, amount })),
    disengageEnemy: (enemy) =>
      play((table) => table.play({ type: 'DisengageEnemy', enemyId: enemy })),
    defeatEnemy: (enemy) => play((table) => table.play({ type: 'DefeatEnemy', enemyId: enemy })),
    answer: (option, counts = {}) =>
      play((table) => {
        const decision = firstDecision(table.state);
        table.play({
          type: 'ResolveDecision',
          decisionId: decision.id,
          // A name no option has goes on as an id, so the engine refuses it as `unknownOption`.
          optionId: optionNamed(decision, option)?.id ?? option,
          ...counts,
        });
      }),
    resolveEnemyAttacks: () => play((table) => table.resolveEnemyAttacks()),
    advanceAct: (spend) =>
      play((table) =>
        table.spendCluesToAdvanceAct(spend.map(({ investigator, clues }) => [investigator, clues])),
      ),
    adjustActClues: (delta) =>
      play((table) =>
        table.play({
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: currentAct(table.state), token: 'clue', delta },
        }),
      ),
    adjust: (investigator, stat, delta) =>
      play((table) => adjustStat(table, investigator, stat, delta)),
    boostSkill: (investigator, skill, delta) =>
      play((table) =>
        table.play({
          type: 'ManualAdjust',
          adjustment: { kind: 'skillBoost', investigatorId: investigator, skill, delta },
        }),
      ),
    drawEncounter: (investigator) => play((table) => table.drawEncounterCard(investigator)),
    moveEncounterCard: (card, move) =>
      play((table) =>
        table.play({
          type: 'ManualAdjust',
          adjustment: { kind: 'moveCard', cardId: card, ...placeOf(move) },
        }),
      ),
    spawnEnemy: (enemy, location) =>
      play((table) => table.play({ type: 'SpawnEnemy', enemyId: enemy, at: location })),
    placeDoom: (amount) => play((table) => table.placeDoom(amount)),
    removeDoom: (amount) => play((table) => table.removeDoom(amount)),
    revealLocation: (location) =>
      play((table) => table.play({ type: 'RevealLocation', locationId: location })),
    adjustLocation: (location, token, delta) =>
      play((table) =>
        table.play(
          token === 'doom' && delta > 0
            ? { type: 'PlaceDoom', cardId: location, amount: delta }
            : {
                type: 'ManualAdjust',
                adjustment: { kind: 'tokens', cardId: location, token, delta },
              },
        ),
      ),
    undo,
    startAdjusting: adjusting.start,
    finishAdjusting: adjusting.finish,
    cancelAdjusting: adjusting.cancel,
  };
}

/** The `PlayTable` verb behind a stepper; a negative `delta` takes the counter down. */
function adjustStat(
  table: PlayTable,
  investigator: InvestigatorId,
  stat: SteppedStat,
  delta: number,
): void {
  switch (stat) {
    case 'resources':
      return table.gainResources(investigator, delta);
    case 'damage':
      return table.takeDamage(investigator, delta);
    case 'horror':
      return table.takeHorror(investigator, delta);
    default:
      return assertNever(stat);
  }
}

/** The zone (and, for the discard pile, the top) a `CardMove` puts a card in. */
function placeOf(move: CardMove): { to: Zone; index?: number } {
  switch (move.to) {
    case 'discard':
      return { to: encounterDiscard, index: 0 };
    case 'setAside':
      return { to: setAside };
    case 'threatArea':
      return { to: threatAreaOf(move.investigator) };
    default:
      return assertNever(move);
  }
}

/** Whose turn it is; refused like an engine command when no one's is. */
function turnInvestigator(state: GameState): InvestigatorId {
  const investigator = state.meta.turn?.investigatorId;
  if (investigator === undefined) throw new CommandRejected({ code: 'noTurnInProgress' });
  return investigator;
}

/** The act the act card shows; refused like an engine command when the act deck is done. */
function currentAct(state: GameState): InstanceId {
  const act = state.act.current;
  if (act === undefined) throw new CommandRejected({ code: 'noCurrentCard', deck: 'act' });
  return act;
}

/** The decision the dialog shows; refused like an engine command when none is open. */
function firstDecision(state: GameState): Decision {
  const [decision] = state.pending;
  if (decision === undefined) throw new CommandRejected({ code: 'noPendingDecision' });
  return decision;
}

/** Clues one investigator pays towards the act (`GameActions.advanceAct`). */
export interface ClueSpend {
  investigator: InvestigatorId;
  clues: number;
}
