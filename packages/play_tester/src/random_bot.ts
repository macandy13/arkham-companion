import { unique } from '@arkham/util';
import { byId, type InvestigatorView, type PlayTable } from '@arkham/engine';
import type { SeededRandom } from './run';
import { INVESTIGATOR_VERBS, type InvestigatorVerb, type Step } from './steps';

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

/** One step in this many is a correction, when the board offers one. */
const CORRECTION_ODDS = 10;

/**
 * The _random_ bot (product.md "Continuous play tester"): any verb the board offers, picked
 * uniformly, then any of that verb's steps. Picking the verb first keeps one verb with many
 * targets (moves) from crowding out the rest. Corrections (doom, damage, horror, resources,
 * actions) are only one step in `CORRECTION_ODDS`: at the same odds as the actions they would end
 * most games in the first rounds, before the rules the tester is after come up.
 */
export function randomStep(table: PlayTable, random: SeededRandom): Step {
  const offered = offeredSteps(table);
  const corrections = offered.filter(isCorrection);
  const pool =
    corrections.length > 0 && random.below(CORRECTION_ODDS) === 0
      ? corrections
      : offered.filter((step) => !isCorrection(step));
  const verb = random.pick(unique(pool.map((step) => step.verb)));
  return random.pick(pool.filter((step) => step.verb === verb));
}

/**
 * Every step the board offers now, as players at the table would see them. While a decision is
 * open, only its options and undo, since the engine waits for the answer. Otherwise "Next", undo,
 * the attacks due, the investigation turns to start, the turn's actions, the draws a card may ask
 * of anyone, and the corrections. Never empty: a decision has options, and "Next" is always there.
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

function isCorrection(step: Step): boolean {
  return step.verb === 'placeDoom' || (CORRECTION_VERBS as readonly string[]).includes(step.verb);
}

/** Each option of each open decision, the decision named by the card it is about. */
function decisionAnswers(table: PlayTable): Step[] {
  const { pending } = table.state;
  return table.board.decisions.flatMap((view, i) => {
    const about = pending[i]?.subject;
    return view.options.map((option): Step =>
      about === undefined ? { verb: 'answer', option } : { verb: 'answer', about, option },
    );
  });
}

/** The steps of `investigator`'s turn: the basic actions, moves, enemy and card actions. */
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
  ];
}
