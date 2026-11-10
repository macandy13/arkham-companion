import { shortestPaths } from './board';
import { cardStats, comparableName, type CardStats, type EngineContext } from './cards';
import { enemiesOnTable, locationOf } from './enemies';
import { boostedSkills, remainingHealth, remainingSanity } from './investigators';
import { SKILL_NAMES, type CardInstance, type GameState, type Investigator } from './state';

/**
 * What a prey text compares for one investigator ("remaining health", "[combat]", "nearest to
 * another [[Cultist]] enemy"); `enemy` is the enemy whose prey it is.
 */
type PreyMeasure = (
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  investigator: Investigator,
) => number;

/** A prey text read: which value to compare and whether the lowest or the highest wins. */
interface PreyCriterion {
  measure: PreyMeasure;
  extreme: 'lowest' | 'highest';
}

/** The first word of a prey text: "Most clues", "Fewest …", "Least remaining sanity". */
const EXTREME_WORDS: Readonly<Record<string, PreyCriterion['extreme'] | undefined>> = {
  highest: 'highest',
  most: 'highest',
  lowest: 'lowest',
  fewest: 'lowest',
  least: 'lowest',
};

/** The counters a prey text can compare after its extreme word. */
const COUNTER_MEASURES: Readonly<Record<string, PreyMeasure | undefined>> = {
  'remaining health': (_ctx, _state, _enemy, inv) => remainingHealth(inv),
  'remaining sanity': (_ctx, _state, _enemy, inv) => remainingSanity(inv),
  clues: (_ctx, _state, _enemy, inv) => inv.clues,
  resources: (_ctx, _state, _enemy, inv) => inv.resources,
  damage: (_ctx, _state, _enemy, inv) => inv.health.damage,
  horror: (_ctx, _state, _enemy, inv) => inv.sanity.horror,
};

const NEAREST_TO_ANOTHER = /^nearest to another (\S+) enemy$/;

/**
 * The investigators among `candidates` that the prey keyword of `enemy` picks (Rules Reference,
 * "Prey"): the active ones tied for the lowest or highest value. Without a prey keyword, or with
 * a text the engine can't read from the board (Yithian Observer's "Fewest cards in hand", as the
 * engine doesn't track hands), every active candidate stays and the players decide, asked with
 * `preyPrompt`.
 */
export function preferredByPrey(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  candidates: readonly Investigator[],
): Investigator[] {
  const active = candidates.filter((inv) => inv.status === 'active');
  const criterion = preyCriterion(cardStats(ctx.cards, enemy.code));
  if (criterion === undefined || active.length === 0) return active;
  const values = active.map((inv) => criterion.measure(ctx, state, enemy, inv));
  const best = criterion.extreme === 'lowest' ? Math.min(...values) : Math.max(...values);
  return active.filter((_inv, i) => values[i] === best);
}

/**
 * The prompt for a choice between the investigators `preferredByPrey` left: `prompt` when the
 * prey was read and only a tie is left, `decision.choosePrey` when the players have to judge
 * the prey themselves.
 */
export function preyPrompt(stats: CardStats, prompt: string): string {
  return preyText(stats) !== undefined && preyCriterion(stats) === undefined
    ? 'decision.choosePrey'
    : prompt;
}

function preyText(stats: CardStats): string | undefined {
  return stats.keywords?.find((keyword) => keyword.name === 'prey')?.detail;
}

/** The criterion of a prey text, e.g. "Highest [combat]", or undefined for one the engine can't read. */
function preyCriterion(stats: CardStats): PreyCriterion | undefined {
  const text = preyText(stats);
  if (text === undefined) return undefined;
  const lower = comparableName(text);
  const nearest = NEAREST_TO_ANOTHER.exec(lower);
  if (nearest !== null)
    return { measure: distanceToEnemyWith(nearest[1] ?? ''), extreme: 'lowest' };
  const space = lower.indexOf(' ');
  const extreme = EXTREME_WORDS[lower.slice(0, space)];
  const measure = measureNamed(lower.slice(space + 1));
  return extreme === undefined || measure === undefined ? undefined : { measure, extreme };
}

function measureNamed(name: string): PreyMeasure | undefined {
  const skill = SKILL_NAMES.find((skillName) => name === `[${skillName}]`);
  if (skill !== undefined) return (_ctx, _state, _enemy, inv) => boostedSkills(inv)[skill];
  return COUNTER_MEASURES[name];
}

/**
 * "Nearest to another [[Cultist]] enemy": connections from the investigator to the nearest other
 * enemy on the table with the trait (case-insensitive, as the trait comes from rules text);
 * infinite with none or no path, so then every investigator ties.
 */
function distanceToEnemyWith(trait: string): PreyMeasure {
  return (ctx, state, enemy, investigator) => {
    const from = investigator.locationId;
    if (from === undefined) return Infinity;
    const others = enemiesOnTable(ctx, state).filter(
      (card) =>
        card.id !== enemy.id &&
        cardStats(ctx.cards, card.code).traits.some((t) => t.toLowerCase() === trait),
    );
    const distances = others.map((card) => {
      const [path] = shortestPaths(ctx, state, from, locationOf(state, card));
      return path === undefined ? Infinity : path.length - 1;
    });
    return Math.min(...distances);
  };
}
