import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, DecisionCounts, DecisionView } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import { ResolvingCard } from '../encounter/ResolvingCard';
import { SkillTestBlock, Stepper, useSkillTest } from '../investigators/TestCalculation';
import type { DecisionAmounts, GameActions } from '../state/gameActions';
import { CardDialog } from './CardDialog';

/**
 * The first open decision (`BoardView.decisions[0]`) as a card dialog over the board
 * (`CardDialog`): the card it is about beside the page (`DecisionView.card`), the investigator who
 * answers it in the kicker over the question in the players' words, whom the encounter card being
 * resolved was drawn for and its keywords, if its revelation asked (`ResolvingCard`), for an
 * attack of opportunity the action that provoked it (`DecisionView.provokedBy`), the test of a skill test, and
 * one button per option, answered through `GameActions.answer` with the default
 * counts. A skill test one investigator takes also brings the test block of the skill test
 * dialog (`SkillTestBlock`): the players keep the test's skill, switch to another or add one (a
 * card can test a different one), set their modifier and let the app draw, and the calculation
 * (`BoardView.skillTest`) marks the option it suggests, which then answers with its margin; the
 * other option overrides it without one. The screen mounts one dialog per decision, so a draw
 * never carries over to the next; adjusting the board, which unmounts it, starts the draw over.
 * The game cannot go on before it is answered, so Escape does not close it; Undo takes back
 * the step that raised it instead, and its grab handle lowers it out of the way, so the players
 * can adjust the board on the game screen first (the screen hides it while they adjust). The engine's labels are i18n keys or names already readable
 * (investigators, locations); a key the strings lack shows as the option's readable name.
 */
export function DecisionDialog({
  board,
  decision,
  actions,
  busy,
}: {
  board: BoardView;
  decision: DecisionView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { test } = decision;
  const tested = decision.kind === 'skillTestResult' ? decision.for : undefined;
  const run = useSkillTest(board, tested, test);
  const suggested = run?.finished ? run.result : undefined;
  const [counts, setCounts] = useState(() => defaultCounts(decision.counts));
  const [chosen, setPicked] = useState<string>();
  const picked = chosen ?? pickedFirst(decision, suggested?.outcome);
  const answer = (option: string) =>
    void actions.answer(option, {
      ...countsOf(counts[option]),
      ...(option === suggested?.outcome ? { margin: suggested.margin } : {}),
    });

  const actor = decision.for === undefined ? undefined : board.investigator(decision.for);
  return (
    <CardDialog
      name="decision"
      {...(decision.card ? { card: decision.card } : {})}
      {...(actor ? { actor, kicker: t('decision.decides', { name: actor.name }) } : {})}
      title={t(decision.prompt, { card: decision.about, defaultValue: decision.prompt })}
      onCancel={(event) => event.preventDefault()}
      lowerable
    >
      {board.resolving && <ResolvingCard board={board} card={board.resolving} />}
      {decision.provokedBy && actor && (
        <p>
          {t(`decision.provokedBy.${decision.provokedBy.action}`, {
            name: actor.name,
            card: decision.provokedBy.card,
            enemy: decision.about,
          })}
        </p>
      )}
      {test && (
        <p>
          {t('decision.test', { skill: t(`skill.${test.skill}`), difficulty: test.difficulty })}
        </p>
      )}
      {run && tested !== undefined && (
        <SkillTestBlock board={board} investigator={board.investigator(tested)} run={run} />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (picked !== undefined) answer(picked);
        }}
      >
        <ul aria-label={t('decision.options')}>
          {/* Two options can share a name (two enemies of one card), so the position is the key. */}
          {decision.options.map((option, index) => {
            const withCounts = decision.counts?.[option] !== undefined;
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={busy}
                  data-suggested={option === suggested?.outcome || undefined}
                  aria-pressed={withCounts ? option === picked : undefined}
                  onClick={() => (withCounts ? setPicked(option) : answer(option))}
                >
                  <span aria-hidden="true">{optionKey(option, index)}</span>
                  <span>{t(decision.labels?.[option] ?? option, { defaultValue: option })}</span>
                </button>
                {withCounts && <p>{t('decision.fromTheGame')}</p>}
                <CountSteppers
                  decision={decision}
                  option={option}
                  counts={counts}
                  onChange={(changed) => {
                    setCounts(changed);
                    setPicked(option);
                  }}
                />
              </li>
            );
          })}
        </ul>
        <footer>
          <button type="button" disabled={busy} onClick={() => void actions.undo()}>
            {t('header.undo')}
          </button>
          <button type="submit" disabled={busy || picked === undefined}>
            {t('decision.done')}
          </button>
        </footer>
      </form>
    </CardDialog>
  );
}

/**
 * The option Done answers before the players pick one: the outcome the draw works out when it
 * has counts to confirm (the clues a passed investigation discovers), else the first option with
 * counts when no test decides between them (an attack of opportunity: take the attack). An
 * option without counts is never picked for them, since a tap on it answers at once.
 */
function pickedFirst(decision: DecisionView, suggested: string | undefined): string | undefined {
  const withCounts = (option: string) => decision.counts?.[option] !== undefined;
  if (decision.test)
    return suggested !== undefined && withCounts(suggested) ? suggested : undefined;
  return decision.options.find(withCounts);
}

/** The key of an option's row, like the guide's: ✓ for a pass, ✗ for a fail, else its number. */
function optionKey(option: string, index: number): string {
  if (option === 'pass') return '✓';
  if (option === 'fail') return '✗';
  return String(index + 1);
}

/** The counts an option can carry, in the order the dialog shows their steppers. */
const COUNT_NAMES = ['amount', 'damage', 'horror'] as const;

/** One of `COUNT_NAMES`. */
type CountName = (typeof COUNT_NAMES)[number];

/** The counts the players set, by option name, each starting at the engine's default. */
type Counts = Record<string, Partial<Record<CountName, number>>>;

function defaultCounts(ranges: Record<string, DecisionCounts> = {}): Counts {
  return Object.fromEntries(
    Object.entries(ranges).map(([option, counts]) => [
      option,
      Object.fromEntries(
        COUNT_NAMES.flatMap((name) => {
          const range = counts[name];
          return range ? [[name, range.default]] : [];
        }),
      ),
    ]),
  );
}

/** An option's counts as the answer carries them: `amount`, and damage and horror as `amounts`. */
function countsOf(counts: Counts[string] = {}): DecisionAmounts {
  const { amount, damage, horror } = counts;
  const named = {
    ...(damage === undefined ? {} : { damage }),
    ...(horror === undefined ? {} : { horror }),
  };
  return {
    ...(amount === undefined ? {} : { amount }),
    ...(Object.keys(named).length > 0 ? { amounts: named } : {}),
  };
}

/** A stepper per count of `option`, within the count's limits, next to the option's button. */
function CountSteppers({
  decision,
  option,
  counts,
  onChange,
}: {
  decision: DecisionView;
  option: string;
  counts: Counts;
  onChange: (counts: Counts) => void;
}) {
  const { t } = useTranslation();
  const ranges = decision.counts?.[option] ?? {};
  return COUNT_NAMES.flatMap((name) => {
    const range = ranges[name];
    const value = counts[option]?.[name];
    if (!range || value === undefined) return [];
    return [
      <Stepper
        key={name}
        label={t(countLabel(name, decision.action))}
        value={value}
        shown={String(value)}
        min={range.min}
        {...(range.max === undefined ? {} : { max: range.max })}
        onChange={(changed) =>
          onChange({ ...counts, [option]: { ...counts[option], [name]: changed } })
        }
      />,
    ];
  });
}

/**
 * The i18n key naming a count: a skill test's `amount` by the action it belongs to (clues an
 * investigation discovers, damage a fight deals), a plain count otherwise.
 */
function countLabel(name: CountName, action: DecisionView['action']): string {
  if (name !== 'amount') return `decision.count.${name}`;
  switch (action) {
    case 'investigate':
      return 'decision.count.clues';
    case 'fight':
      return 'decision.count.dealt';
    case 'evade':
    case undefined:
      return 'decision.count.amount';
    default:
      return assertNever(action);
  }
}
