import { sum } from '@arkham/util';
import { ROUND_PHASES, type BoardView, type InstanceId } from '@arkham/engine';
import type { Step } from './steps';

/** The rule oracles (product.md "Continuous play tester", check 4), one per rule they check. */
export type OracleId =
  | 'phaseOrder'
  | 'upkeep'
  | 'mythosDoom'
  | 'doomThreshold'
  | 'agendaOnlyAtCheck'
  | 'actAdvance'
  | 'hunterMove';

/** The `docs/rules/` pages the oracles are written from. */
export type RulesPage =
  'round-structure.md' | 'agenda-and-doom.md' | 'act-and-clues.md' | 'hunter.md';

/**
 * One rule a step must keep, judged from the board before and after it: what the step broke, or
 * `undefined`. It reads only `BoardView` and never runs the engine's phase or advance logic, so a
 * bug there does not pass its own check; it trusts the values the board shows (a threshold, doom in
 * play, an act's clue requirement). It is written from its `docs/rules/` page.
 */
export interface Oracle {
  readonly id: OracleId;
  readonly rules: RulesPage;
  readonly judge: (before: BoardView, after: BoardView, step: Step) => string | undefined;
}

/** A broken rule: the oracle that caught it and what it saw. */
export interface BrokenRule {
  readonly oracle: Oracle;
  readonly message: string;
}

/** The actions every investigator has again at upkeep (round-structure.md, Upkeep 1). */
const ACTIONS_PER_ROUND = 3;

/**
 * Where `board` is in the game, counted in phases: setup counts as round 1's mythos phase, which
 * round 1 skips, so the first "Next" moves on by one.
 */
function position(board: BoardView): number {
  return board.phase === 'setup' ? 4 : 4 * board.round + ROUND_PHASES.indexOf(board.phase);
}

/** Whether the step from `before` to `after` began a new round with its mythos phase. */
function beganMythos(before: BoardView, after: BoardView): boolean {
  return before.round >= 1 && after.round === before.round + 1;
}

/**
 * Every rule oracle, in the order `brokenRule` asks them: the first one a step breaks is its
 * finding, so the round structure comes before the rules that rely on it.
 */
export const ORACLES: readonly Oracle[] = [
  {
    id: 'phaseOrder',
    rules: 'round-structure.md',
    judge: (before, after) => {
      if (position(after) < position(before))
        return `the game went back from round ${before.round} ${before.phase} to round ${after.round} ${after.phase}`;
      if (after.round > before.round + 1)
        return `the round went from ${before.round} to ${after.round}`;
      if (after.round === 1 && after.phase === 'mythos') return 'round 1 has a mythos phase';
      return undefined;
    },
  },
  {
    id: 'upkeep',
    rules: 'round-structure.md',
    judge: (before, after) => {
      const finished =
        after.phase === 'upkeep' &&
        after.step === undefined &&
        !(before.phase === 'upkeep' && before.step === undefined);
      if (!finished) return undefined;
      const wholeUpkeep = before.phase !== 'upkeep';
      for (const investigator of after.investigators) {
        const was = before.investigators.find(({ id }) => id === investigator.id);
        if (investigator.status !== 'active' || was?.status !== 'active') continue;
        if (investigator.actions !== ACTIONS_PER_ROUND)
          return `${investigator.name} has ${investigator.actions} actions after the upkeep`;
        if (wholeUpkeep && investigator.resources !== was.resources + 1)
          return `${investigator.name} went from ${was.resources} to ${investigator.resources} resources in the upkeep`;
      }
      const exhausted = after.enemies.find(({ exhausted }) => exhausted);
      if (exhausted) return `${exhausted.name} is still exhausted after the upkeep`;
      return undefined;
    },
  },
  {
    id: 'mythosDoom',
    rules: 'round-structure.md',
    judge: (before, after) => {
      if (!beganMythos(before, after) || !before.agenda || after.agenda?.id !== before.agenda.id)
        return undefined;
      return after.agenda.doom < before.agenda.doom + 1
        ? `the mythos phase left ${after.agenda.doom} doom on ${after.agenda.name}, which had ${before.agenda.doom}`
        : undefined;
    },
  },
  {
    id: 'doomThreshold',
    rules: 'agenda-and-doom.md',
    judge: (before, after) => {
      const threshold = before.agenda?.threshold;
      if (!beganMythos(before, after) || threshold === undefined) return undefined;
      const atCheck = before.doomInPlay + 1;
      // The app asks the players to confirm the advance, since it only tracks doom for them; the
      // agenda stays current while that question is open.
      const asked = after.decisions.some(
        ({ prompt, about }) => prompt === 'decision.advanceAgenda' && about === before.agenda?.name,
      );
      return atCheck >= threshold &&
        after.agenda?.id === before.agenda?.id &&
        !asked &&
        !after.ended
        ? `${before.agenda?.name} did not advance with ${atCheck} doom in play against its threshold ${threshold}`
        : undefined;
    },
  },
  {
    id: 'agendaOnlyAtCheck',
    rules: 'agenda-and-doom.md',
    judge: (before, after, step) =>
      step.verb === 'placeDoom' && after.agenda?.id !== before.agenda?.id
        ? `placing doom by hand advanced ${before.agenda?.name}`
        : undefined,
  },
  {
    id: 'actAdvance',
    rules: 'act-and-clues.md',
    judge: (before, after, step) => {
      const advance = before.act?.advance;
      if (step.verb !== 'spendCluesToAdvanceAct' || advance?.kind !== 'spendClues' || after.ended)
        return undefined;
      // The act's back side resolves completely, any choice it asks included, before the next
      // act becomes current (act-and-clues.md), so an open question keeps the act in place; the
      // clues are spent all the same.
      if (after.act?.id === before.act?.id && after.decisions.length === 0)
        return `${before.act?.name} did not advance`;
      const spent = cluesHeld(before) - cluesHeld(after);
      return spent !== advance.threshold
        ? `advancing ${before.act?.name} took ${spent} clues, not ${advance.threshold}`
        : undefined;
    },
  },
  {
    id: 'hunterMove',
    rules: 'hunter.md',
    judge: (before, after) => {
      // A tie (which hunter first, which investigator, which way) waits for the players and moves
      // nothing yet; the answer moves the hunter in a later step, which this oracle leaves alone.
      if (!huntersMoved(before, after) || after.decisions.some(asksAboutHunters)) return undefined;
      for (const hunter of movingHunters(before)) {
        const to = locationOfEnemy(after, hunter.id);
        if (to === undefined) continue;
        const expected = hunterSteps(before, hunter.at);
        if (expected.length === 0 && to !== hunter.at)
          return `${hunter.name} moved from ${nameOf(before, hunter.at)} to ${nameOf(before, to)}, though it had to stay`;
        if (expected.length > 0 && to === hunter.at)
          return `${hunter.name} stayed at ${nameOf(before, hunter.at)} instead of moving towards the nearest investigator`;
        if (expected.length > 0 && !expected.includes(to))
          return `${hunter.name} went from ${nameOf(before, hunter.at)} to ${nameOf(before, to)}, not one step towards the nearest investigator`;
      }
      return undefined;
    },
  },
];

/**
 * The first rule the step from `before` to `after` broke, if any. Undo takes a step back, so it
 * keeps no rule of play; a game that has ended is not judged further.
 */
export function brokenRule(
  before: BoardView,
  after: BoardView,
  step: Step,
): BrokenRule | undefined {
  if (step.verb === 'undo' || before.ended) return undefined;
  for (const oracle of ORACLES) {
    const message = oracle.judge(before, after, step);
    if (message !== undefined) return { oracle, message };
  }
  return undefined;
}

/** The clues the investigators hold between them. */
function cluesHeld(board: BoardView): number {
  return sum(board.investigators.map(({ clues }) => clues));
}

/** The prompts of the questions a hunter's move waits for (`MoveHunters` in the engine). */
const HUNTER_PROMPTS: ReadonlySet<string> = new Set([
  'decision.chooseHunterOrder',
  'decision.chooseHunterTarget',
  'decision.chooseEnemyDestination',
]);

function asksAboutHunters({ prompt }: BoardView['decisions'][number]): boolean {
  return HUNTER_PROMPTS.has(prompt);
}

/** Whether the step from `before` to `after` ran enemy step 1, in which the hunters move. */
function huntersMoved(before: BoardView, after: BoardView): boolean {
  const beforeHunters =
    before.phase === 'investigation' || (before.phase === 'enemy' && before.step === 'huntersMove');
  const enemyPhase = 4 * before.round + ROUND_PHASES.indexOf('enemy');
  const pastHunters =
    position(after) > enemyPhase ||
    (position(after) === enemyPhase && after.step !== 'huntersMove');
  return beforeHunters && pastHunters;
}

/** A hunter that enemy step 1 moves, as `before` shows it: ready, unengaged, at a location. */
interface Hunter {
  readonly id: InstanceId;
  readonly name: string;
  readonly at: InstanceId;
}

/**
 * The ready, unengaged hunters on the maps of `board` (hunter.md). One with an open question
 * about it stays until that is answered.
 */
function movingHunters(board: BoardView): Hunter[] {
  const asked = new Set(board.decisions.map(({ about }) => about));
  return board.maps.flatMap((map) =>
    Object.entries(map.enemies).flatMap(([at, enemies]) =>
      enemies
        .filter(
          (enemy) =>
            enemy.engagedWith === undefined &&
            enemy.exhausted === undefined &&
            !asked.has(enemy.name) &&
            board.enemyStats(enemy.id).keywords.some(({ name }) => name === 'hunter'),
        )
        .map((enemy) => ({ id: enemy.id, name: enemy.name, at: at as InstanceId })),
    ),
  );
}

/**
 * Where a hunter at `from` may go in enemy step 1: each connected location one step closer to an
 * investigator nearest to it (hunter.md). Empty when it stays: an investigator is at `from`, or
 * none can be reached. Prey and the lead investigator choose among these, which the board does not
 * show, so any of them is accepted.
 */
function hunterSteps(board: BoardView, from: InstanceId): InstanceId[] {
  const targets = board.investigators
    .filter(({ status }) => status === 'active')
    .flatMap(({ id }) => board.locationOf(id) ?? []);
  if (targets.includes(from)) return [];
  const nearest = Math.min(...targets.map((target) => distance(board, from, target)));
  if (!Number.isFinite(nearest)) return [];
  return board
    .connectedTo(from)
    .filter((step) => targets.some((target) => distance(board, step, target) === nearest - 1));
}

/** The connections a move from `from` to `to` takes at least, `Infinity` when none leads there. */
function distance(board: BoardView, from: InstanceId, to: InstanceId): number {
  const seen = new Set([from]);
  let frontier = [from];
  for (let steps = 0; frontier.length > 0; steps++) {
    if (frontier.includes(to)) return steps;
    const reached = frontier.flatMap((location) => board.connectedTo(location));
    frontier = [...new Set(reached)].filter((location) => !seen.has(location));
    for (const location of frontier) seen.add(location);
  }
  return Infinity;
}

/** The location the enemy `id` is at on `board`, an engaged one at its investigator's location. */
function locationOfEnemy(board: BoardView, id: InstanceId): InstanceId | undefined {
  for (const map of board.maps)
    for (const [at, enemies] of Object.entries(map.enemies))
      if (enemies.some((enemy) => enemy.id === id)) return at as InstanceId;
  return undefined;
}

/** The printed name of the location `id`, for a finding. */
function nameOf(board: BoardView, id: InstanceId): string {
  return board.locations.find((location) => location.id === id)?.name ?? id;
}
