import { camelCaseToWords } from '@arkham/util';
import type { EngineContext } from './cards';
import type { AmountRange, Decision, DecisionOption, GameState } from './state';

const PROMPT_PREFIX = 'decision.';

/**
 * The question behind each engine-raised prompt key, given the name of the
 * decision's subject card (empty if it has none). English and debug-only: the
 * UI formats decisions from the i18n keys themselves (M3), so these sentences
 * never reach players and need no translation.
 */
const QUESTIONS: Readonly<Record<string, (subject: string) => string>> = {
  'decision.advanceAgenda': (subject) => `Advance agenda ${subject}`,
  'decision.chooseEngagement': (subject) => `Whom does ${subject} engage?`,
  'decision.chooseHunterOrder': () => 'Which hunter moves first?',
  'decision.chooseHunterTarget': (subject) => `Whom does ${subject} hunt?`,
  'decision.chooseHunterDestination': (subject) => `Where does ${subject} move?`,
  'decision.chooseSpawnLocation': (subject) => `Where does ${subject} spawn?`,
  'decision.investigate': (subject) => `Investigate ${subject}:`,
  'decision.fight': (subject) => `Fight ${subject}:`,
  'decision.evade': (subject) => `Evade ${subject}:`,
  'decision.revelationTest': (subject) => `Revelation of ${subject}:`,
  'decision.attackOfOpportunity': (subject) => `Attack of opportunity by ${subject}:`,
};

/**
 * `decision` in plain words for `formatBoard` and test read-backs, e.g.
 * `Whom does Swarm of Rats engage? Roland Banks / Daisy Walker / Wendy Adams [chooseInvestigator]`:
 * the question, the test of a skill test (`intellect (4)`), the options by
 * readable name with their adjustable counts (`pass ×1 (1–3)`,
 * `attack damage ×1 (0+) horror ×2 (0+)`) and the widget
 * kind for debugging. A prompt without a sentence here (scenario- or
 * card-defined) shows its key.
 */
export function describeDecision(ctx: EngineContext, state: GameState, decision: Decision): string {
  const subject = subjectName(ctx, state, decision);
  const question = QUESTIONS[decision.prompt]?.(subject) ?? decision.prompt;
  const test = decision.skillTest
    ? ` ${decision.skillTest.skill} (${decision.skillTest.difficulty})`
    : '';
  const options = decision.options.map(optionWithAmount).join(' / ');
  return `${question}${test} ${options} [${decision.kind}]`;
}

function optionWithAmount(option: DecisionOption): string {
  const named = Object.entries(option.amounts ?? {}).map(
    ([name, range]) => `${name} ${amountText(range)}`,
  );
  const counts = [...(option.amount ? [amountText(option.amount)] : []), ...named];
  return [optionName(option), ...counts].join(' ');
}

/** An adjustable count as `×default (range)`, e.g. `×1 (1–3)` or `×2 (0+)`. */
function amountText(amount: AmountRange): string {
  const range = amount.max === undefined ? `${amount.min}+` : `${amount.min}–${amount.max}`;
  return `×${amount.default} (${range})`;
}

/**
 * The readable name of `option`: its label when that is already a name
 * (investigator, card, location), otherwise the words of its i18n key
 * (`decision.yes` is `yes`, `failedBy:2` is `failed by 2`). Never the id
 * itself; `optionNamed` maps a name back to the option.
 */
export function optionName(option: DecisionOption): string {
  if (!option.label.startsWith(PROMPT_PREFIX)) return option.label;
  const words = camelCaseToWords(option.label.slice(PROMPT_PREFIX.length));
  const [, margin] = option.id.split(':');
  return margin === undefined ? words : `${words} ${margin}`;
}

/** The option of `decision` whose readable name is `name`, if exactly one has it. */
export function optionNamed(decision: Decision, name: string): DecisionOption | undefined {
  const matches = decision.options.filter((option) => optionName(option) === name);
  return matches.length === 1 ? matches[0] : undefined;
}

function subjectName(ctx: EngineContext, state: GameState, decision: Decision): string {
  const card = decision.subject === undefined ? undefined : state.cards[decision.subject];
  return card ? (ctx.cards.get(card.code)?.name ?? card.code) : '';
}
