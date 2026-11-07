import { unique } from '@arkham/util';
import { byId, type InvestigatorView, type PlayTable } from '@arkham/engine';
import { answersByDraw } from './test_answers';
import { actionCostOf, INVESTIGATOR_VERBS, type InvestigatorVerb, type Step } from './steps';

/** The verbs any active investigator may use outside their turn, as a card lets them. */
const ANYTIME_VERBS: readonly InvestigatorVerb[] = ['drawEncounterCard'];

/** The players' corrections by hand, which stand in for card effects the engine leaves to them. */
const CORRECTION_VERBS: readonly InvestigatorVerb[] = [
  'spendAction',
  'takeDamage',
  'takeHorror',
  'gainResources',
];

/** The verbs of the turn's investigator, besides moves, enemy and card actions. */
const TURN_VERBS: readonly InvestigatorVerb[] = INVESTIGATOR_VERBS.filter(
  (verb) =>
    verb !== 'startTurn' && !ANYTIME_VERBS.includes(verb) && !CORRECTION_VERBS.includes(verb),
);

/**
 * One step in this many is a rare one, when the board offers one: a correction, an encounter card
 * a card effect draws, or undo. Players do these seldom; at the odds of the actions, extra encounter
 * draws and damage defeated the group within a few rounds, and undo took back half the game.
 */
const RARE_ODDS = 100;

/**
 * The _random_ bot's weights (product.md "Continuous play tester") for the `offered` steps: any
 * verb the board offers, picked uniformly, then any of that verb's steps, with the rare steps
 * (`isRare`) only one in `RARE_ODDS`.
 */
export function randomWeights(offered: readonly Step[]): number[] {
  return rareShareWeights(offered, isRare, 1 / RARE_ODDS);
}

/**
 * Weights for the `offered` steps that give the `rare` ones `rareShare` of the picks (all of them
 * when the board offers nothing else), and the rest the remainder. Within each share every verb
 * weighs the same and splits its weight over its steps, so one verb with many targets (moves)
 * does not crowd out the rest.
 */
export function rareShareWeights(
  offered: readonly Step[],
  rare: (step: Step) => boolean,
  rareShare: number,
): number[] {
  const isRareStep = offered.map(rare);
  const rareCount = isRareStep.filter(Boolean).length;
  const share = (stepIsRare: boolean) => {
    if (rareCount === 0 || rareCount === offered.length) return 1;
    return stepIsRare ? rareShare : 1 - rareShare;
  };
  return offered.map((step, i) => {
    const pool = offered.filter((_, j) => isRareStep[j] === isRareStep[i]);
    const verbs = unique(pool.map(({ verb }) => verb)).length;
    const sameVerb = pool.filter(({ verb }) => verb === step.verb).length;
    return share(isRareStep[i]!) / verbs / sameVerb;
  });
}

/**
 * Every step the board offers now, as players at the table would see them. While a decision is
 * open, only the options (but for a test the bot answers by a draw, `answersByDraw`) and undo,
 * since the engine waits for the answer. Otherwise "Next", undo, the attacks due, the
 * investigation turns to start, the turn's actions, the draws a card may ask of anyone, and the
 * corrections. Never empty: a decision has options, and "Next" is always there.
 */
export function offeredSteps(table: PlayTable): Step[] {
  const { board } = table;
  const undo: Step[] = table.canUndo ? [{ verb: 'undo' }] : [];
  if (board.decisions.length > 0) return [...decisionAnswers(table), ...undo];
  const active = board.investigators.filter(({ status }) => status === 'active');
  const turn = active.find(({ id }) => id === board.turn);
  return [
    { verb: 'nextPhase' },
    ...undo,
    ...(board.attacksDue.length > 0 ? [{ verb: 'resolveEnemyAttacks' } as const] : []),
    ...(board.phase === 'investigation' && turn === undefined
      ? active
          .filter(({ turnTaken }) => !turnTaken)
          .map(({ name }): Step => ({ verb: 'startTurn', investigator: name }))
      : []),
    ...(turn === undefined ? [] : turnSteps(table, turn)),
    ...active.flatMap(({ name }) =>
      [...ANYTIME_VERBS, ...CORRECTION_VERBS].map((verb): Step => ({ verb, investigator: name })),
    ),
    { verb: 'placeDoom' },
  ];
}

/** Corrections by hand, encounter cards a card effect draws, and undo: what players do seldom. */
export function isRare(step: Step): boolean {
  return (
    step.verb === 'placeDoom' ||
    step.verb === 'undo' ||
    (ANYTIME_VERBS as readonly string[]).includes(step.verb) ||
    (CORRECTION_VERBS as readonly string[]).includes(step.verb)
  );
}

/** Each option of each open decision, the decision named by the card it is about. */
function decisionAnswers(table: PlayTable): Step[] {
  const { pending } = table.state;
  return table.board.decisions.flatMap((view, i) => {
    const decision = pending[i];
    if (decision && answersByDraw(table, decision)) return [];
    const about = decision?.subject;
    return view.options.map((option): Step =>
      about === undefined ? { verb: 'answer', option } : { verb: 'answer', about, option },
    );
  });
}

/**
 * The steps of `investigator`'s turn: the basic actions, moves, enemy and card actions, those
 * that cost actions only while they have enough left (`actionCostOf`), as players count them.
 */
function turnSteps(table: PlayTable, investigator: InvestigatorView): Step[] {
  const { board } = table;
  const { id, name } = investigator;
  const at = board.locationOf(id);
  const advance = board.act?.advance;
  return [
    ...TURN_VERBS.map((verb): Step => ({ verb, investigator: name })),
    ...(advance?.kind === 'spendClues' && advance.held >= advance.threshold
      ? [{ verb: 'spendCluesToAdvanceAct' } as const]
      : []),
    ...(at === undefined
      ? []
      : board.connectedTo(at).map((location): Step => ({
          verb: 'moveTo',
          investigator: name,
          location: board.location(byId(location)).name,
        }))),
    ...(at === undefined ? [] : board.enemiesAt(at)).flatMap((enemy) =>
      board
        .enemyActions(id, enemy.id)
        .map((verb): Step => ({ verb, investigator: name, enemy: enemy.id })),
    ),
    ...board.cardActions(id).map(({ cardId, action }): Step => ({
      verb: 'useCardAction',
      investigator: name,
      card: cardId,
      action,
    })),
  ].filter((step) => actionCostOf(table, step) <= investigator.actions);
}
