import { sum } from '@arkham/util';
import type { BoardView, RoundPhase } from '@arkham/engine';
import type { Step } from './steps';

/** The rule oracles (product.md "Continuous play tester", check 4), one per rule they check. */
export type OracleId =
  'phaseOrder' | 'upkeep' | 'mythosDoom' | 'doomThreshold' | 'agendaOnlyAtCheck' | 'actAdvance';

/** The `docs/rules/` pages the oracles are written from. */
export type RulesPage = 'round-structure.md' | 'agenda-and-doom.md' | 'act-and-clues.md';

/**
 * One rule a step must keep, judged from the board before and after it: what the step broke, or
 * `undefined`. It reads only `BoardView`, never the engine's rule helpers, so a bug in a helper
 * does not pass its own check; it is written from its `docs/rules/` page.
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

const ROUND_PHASES: readonly RoundPhase[] = ['mythos', 'investigation', 'enemy', 'upkeep'];

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
      if (after.act?.id === before.act?.id) return `${before.act?.name} did not advance`;
      const spent = cluesHeld(before) - cluesHeld(after);
      if (spent !== advance.threshold)
        return `advancing ${before.act?.name} took ${spent} clues, not ${advance.threshold}`;
      return after.act && after.act.clues > 0
        ? `${after.act.name} starts with ${after.act.clues} clues on it`
        : undefined;
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
