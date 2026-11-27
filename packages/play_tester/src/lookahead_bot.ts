import { sum } from '@arkham/util';
import {
  CommandRejected,
  InvariantBroken,
  TableError,
  type BoardView,
  type Event,
  type InvestigatorId,
  type PlayTable,
} from '@arkham/engine';
import { goalWeights, nearestClues } from './goal_bot';
import { offeredSteps } from './random_bot';
import { SeededRandom } from './run';
import { playStep, type Step } from './steps';
import { drawnTestAnswer } from './test_answers';

/**
 * How many steps a look ahead plays past the step it tries, at most: enough for the rest of a
 * turn of three actions, each with its test and the decisions it brings.
 */
const HORIZON = 12;

/**
 * What a look ahead scores (`outlook`), as points against the board where it started. A
 * resolution outweighs everything, an advanced act or agenda the clues, damage and enemies of a
 * turn; damage and horror weigh more as an investigator nears defeat.
 */
const POINTS = {
  resolution: 1000,
  eliminated: -1000,
  actAdvanced: 100,
  agendaAdvanced: -50,
  doom: -10,
  clue: 6,
  clueOnLocation: 1,
  moveToClues: -2,
  defeated: -150,
  resigned: -40,
  harm: -3,
  harmNearDefeat: -12,
  enemyInPlay: -8,
  enemyEngaged: -5,
  enemyDamage: 2,
  heldForAct: 4,
} as const;

/** Health or sanity left at or below which each further point of harm weighs `harmNearDefeat`. */
const NEAR_DEFEAT = 2;

/**
 * The _lookahead_ bot's next step: the goal bot (`goalWeights`) with foresight. Each step the
 * goal bot would ever take is tried on a copy of the table (`PlayTable.fork`), played on by the
 * goal bot's best picks to the end of the turn, and scored by how far it moved the game on
 * (`outlook`); the best is taken, a tie by the goal bot's weights. Tests within a look ahead draw
 * from their own seeded random, so the bot does not see the tokens its real test will draw.
 */
export function lookaheadStep(table: PlayTable, random: SeededRandom): Step {
  const drawn = drawnTestAnswer(table, random);
  if (drawn) return drawn;
  const offered = offeredSteps(table);
  const weights = goalWeights(table, offered);
  const tried = offered.flatMap((step, i) => (weights[i]! > 0 ? [i] : []));
  if (tried.length <= 1) return offered[random.pickWeighted(weights)]!;
  const seed = random.u32();
  const scores = tried.map((i) => outlook(table, offered[i]!, seed));
  const best = Math.max(...scores);
  return offered[
    random.pickWeighted(
      offered.map((_, i) => {
        const at = tried.indexOf(i);
        return at >= 0 && scores[at] === best ? weights[i]! : 0;
      }),
    )
  ]!;
}

/**
 * The score of playing `step` on `table`: on a copy, the step, then the goal bot's best picks
 * (`greedyStep`) until the turn passes from the investigator whose turn it is, the game ends,
 * or `HORIZON` steps. A refused step scores minus infinity, so it is taken only when everything
 * else is refused too; a refused pick later ends the look ahead where it got to. A look ahead
 * that crashes the engine or breaks an invariant scores plus infinity: the bot then plays
 * towards the bug for real, where `checkedStep` reports it.
 */
export function outlook(table: PlayTable, step: Step, seed: number): number {
  const copy = table.fork();
  const before = table.board;
  const logged = copy.events.length;
  if (tryStep(copy, step) === 'refused') return Number.NEGATIVE_INFINITY;
  const random = new SeededRandom(seed);
  const turn = before.turn;
  for (let played = 0; played < HORIZON && !over(copy.board); played++) {
    if (copy.board.turn !== turn) break;
    const outcome = tryStep(copy, greedyStep(copy, random));
    if (outcome === 'broken') return Number.POSITIVE_INFINITY;
    if (outcome === 'refused') break;
  }
  return progress(before, copy.board, copy.events.slice(logged));
}

/**
 * Plays `step` on a look ahead's copy: `played`, `refused` (a refusal or a step the table can't
 * name, which `checkedStep` judges when the bot plays it for real) or `broken` (a crash or a
 * broken invariant).
 */
function tryStep(table: PlayTable, step: Step): 'played' | 'refused' | 'broken' {
  try {
    playStep(table, step);
    return 'played';
  } catch (error) {
    if (error instanceof CommandRejected) return 'refused';
    if (error instanceof TableError && !(error instanceof InvariantBroken)) return 'refused';
    console.warn(`the lookahead bot steers towards a bug: ${describeError(error)}`);
    return 'broken';
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The goal bot's step with the most weight, a tie picked at random; a test is drawn first. */
function greedyStep(table: PlayTable, random: SeededRandom): Step {
  const drawn = drawnTestAnswer(table, random);
  if (drawn) return drawn;
  const offered = offeredSteps(table);
  const weights = goalWeights(table, offered);
  const most = Math.max(...weights);
  return offered[random.pickWeighted(weights.map((weight) => (weight === most ? 1 : 0)))]!;
}

/** Whether the game on `board` is over: a resolution, or no investigator left in play. */
function over(board: BoardView): boolean {
  return board.ended || board.investigators.every(({ status }) => status !== 'active');
}

/**
 * How far the game moved on from `before` to `after`, with the `events` logged in between
 * (`POINTS`): a resolution or the end without one (every investigator out), acts and agendas
 * advanced, doom, the clues the group holds or put on the act, the clues on revealed locations
 * and how far the investigators are from the nearest ones, the harm and defeat of each
 * investigator, and the enemies in play, engaged and damaged.
 */
export function progress(before: BoardView, after: BoardView, events: readonly Event[]): number {
  if (after.resolution !== undefined) return POINTS.resolution;
  if (over(after)) return POINTS.eliminated;
  const advanced = (type: Event['type']) => events.filter((event) => event.type === type).length;
  const clues = (board: BoardView) =>
    sum(board.investigators.map(({ clues }) => clues)) + (board.act?.clues ?? 0);
  const engaged = (board: BoardView) =>
    board.enemies.filter(({ engagedWith }) => engagedWith !== undefined).length;
  const enemyDamage = (board: BoardView) => sum(board.enemies.map(({ damage }) => damage ?? 0));
  const heldForAct = (board: BoardView) => {
    const advance = board.act?.advance;
    return advance && advance.kind !== 'cluesOnAct' ? Math.min(advance.held, advance.threshold) : 0;
  };
  const cluesOnLocations = (board: BoardView) =>
    sum(board.locations.map(({ revealed, clues }) => (revealed ? clues : 0)));
  return (
    POINTS.actAdvanced * advanced('ActAdvanced') +
    POINTS.agendaAdvanced * advanced('AgendaAdvanced') +
    POINTS.doom * (after.doomInPlay - before.doomInPlay) +
    POINTS.clue * (clues(after) - clues(before)) +
    POINTS.clueOnLocation * (cluesOnLocations(after) - cluesOnLocations(before)) +
    POINTS.moveToClues * (movesToClues(after) - movesToClues(before)) +
    sum(before.investigators.map(({ id }) => investigatorPoints(before, after, id))) +
    POINTS.enemyInPlay * (after.enemies.length - before.enemies.length) +
    POINTS.enemyEngaged * (engaged(after) - engaged(before)) +
    POINTS.enemyDamage * (enemyDamage(after) - enemyDamage(before)) +
    POINTS.heldForAct * (heldForAct(after) - heldForAct(before))
  );
}

/**
 * How many moves the active investigators have to make, together, to reach the nearest clues
 * each (`nearestClues`); one with no way to any counts none, as moving won't help them.
 */
function movesToClues(board: BoardView): number {
  return sum(
    board.investigatorsInPlay.map(({ id }) => {
      const at = board.locationOf(id);
      return at === undefined ? 0 : (nearestClues(board, at)?.moves ?? 0);
    }),
  );
}

/**
 * The points for what happened to `investigator` between `before` and `after`: defeat or
 * resignation, else each point of damage and horror taken (or healed), weighing more within
 * `NEAR_DEFEAT` of defeat.
 */
function investigatorPoints(
  before: BoardView,
  after: BoardView,
  investigator: InvestigatorId,
): number {
  const was = before.investigator(investigator);
  const is = after.investigator(investigator);
  if (was.status === 'active' && is.status === 'defeated') return POINTS.defeated;
  if (was.status === 'active' && is.status === 'resigned') return POINTS.resigned;
  const harm = (now: number, was: number, limit: number) => {
    const points = (taken: number) =>
      limit - taken <= NEAR_DEFEAT ? POINTS.harmNearDefeat : POINTS.harm;
    let total = 0;
    for (let taken = Math.min(now, was) + 1; taken <= Math.max(now, was); taken++)
      total += points(taken);
    return now >= was ? total : -total;
  };
  return harm(is.damage, was.damage, is.health) + harm(is.horror, was.horror, is.sanity);
}
