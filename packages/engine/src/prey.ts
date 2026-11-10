import { stripTrailingDot } from '@arkham/util';
import { distance } from './board';
import {
  cardStats,
  comparableName,
  trait,
  type CardStats,
  type EngineContext,
  type Trait,
} from './cards';
import { enemiesOnTable } from './enemies';
import { locationOfCard, matchesCard } from './lookup';
import {
  activeInvestigators,
  boostedSkills,
  remainingHealth,
  remainingSanity,
} from './investigators';
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

/** The first word of a prey text: "Most clues", "Fewest …", "Least remaining sanity". */
const EXTREME_WORDS: Readonly<Record<string, 'lowest' | 'highest' | undefined>> = {
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

/**
 * A prey text read: which of the given investigators it picks, and whether it says "only".
 * Comparing texts pick the tied best ("Most clues"); naming texts pick those they name ("Daisy
 * Walker", "Investigator at a [[Woods]] location") and may pick nobody.
 */
interface Prey {
  pick: (
    ctx: EngineContext,
    state: GameState,
    enemy: CardInstance,
    investigators: readonly Investigator[],
  ) => Investigator[];
  only: boolean;
}

const NEAREST_TO_ANOTHER = /^nearest to another (.+) enemy$/i;
const AT_TRAIT_LOCATION = /^investigator at an? (.+) location$/i;
const ONLY = /\s+only$/i;

/**
 * The investigators among `candidates` that the prey keyword of `enemy` picks (Rules Reference,
 * "Prey"): the active ones it prefers, or all of them when it prefers none. With "only" it picks
 * among every active investigator and keeps the candidates it picked, possibly none: the enemy
 * ignores everyone else. Without a prey keyword, or with a text the engine can't read from the
 * board (Yithian Observer's "Fewest cards in hand", as the engine doesn't track hands), every
 * active candidate stays and the players decide, asked with `preyPrompt`.
 */
export function preferredByPrey(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  candidates: readonly Investigator[],
): Investigator[] {
  const active = candidates.filter((inv) => inv.status === 'active');
  const prey = readPrey(state, cardStats(ctx.cards, enemy.code));
  if (prey === undefined || active.length === 0) return active;
  if (prey.only) {
    const allowed = new Set(
      prey.pick(ctx, state, enemy, activeInvestigators(state)).map((inv) => inv.id),
    );
    return active.filter((inv) => allowed.has(inv.id));
  }
  const picked = prey.pick(ctx, state, enemy, active);
  return picked.length > 0 ? picked : active;
}

/**
 * The investigators among `investigators` that `enemy` may move towards or engage on its own:
 * with "Prey – … only" those its prey picks, otherwise all of them (Rules Reference, "Prey").
 */
export function preyAllows(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  investigators: readonly Investigator[],
): Investigator[] {
  const prey = readPrey(state, cardStats(ctx.cards, enemy.code));
  return prey?.only === true
    ? preferredByPrey(ctx, state, enemy, investigators)
    : [...investigators];
}

/**
 * The prompt for a choice between the investigators `preferredByPrey` left: `prompt` when the
 * prey was read and only a tie is left, `decision.choosePrey` when the players have to judge
 * the prey themselves.
 */
export function preyPrompt(state: GameState, stats: CardStats, prompt: string): string {
  return preyText(stats) !== undefined && readPrey(state, stats) === undefined
    ? 'decision.choosePrey'
    : prompt;
}

function preyText(stats: CardStats): string | undefined {
  return stats.keywords?.find((keyword) => keyword.name === 'prey')?.detail;
}

/** The prey of a card, e.g. "Highest [combat]" or "Daisy Walker only", or undefined for one the engine can't read. */
function readPrey(state: GameState, stats: CardStats): Prey | undefined {
  const text = preyText(stats);
  if (text === undefined) return undefined;
  const plain = stripTrailingDot(text.trim());
  const only = ONLY.test(plain);
  const pick = preyPick(state, plain.replace(ONLY, ''));
  return pick === undefined ? undefined : { pick, only };
}

/**
 * How a prey text without its "only" picks: by a measure, by the trait of their location, or
 * by an investigator's name in this game ("Daisy Walker"); undefined for any other text.
 */
function preyPick(state: GameState, text: string): Prey['pick'] | undefined {
  const nearest = NEAREST_TO_ANOTHER.exec(text);
  if (nearest !== null) return tiedBest(distanceToEnemyWith(trait(nearest[1] ?? '')), 'lowest');
  const atTrait = AT_TRAIT_LOCATION.exec(text);
  if (atTrait !== null) return atLocationWith(trait(atTrait[1] ?? ''));
  const lower = text.toLowerCase();
  const space = lower.indexOf(' ');
  const extreme = EXTREME_WORDS[lower.slice(0, space)];
  const measure = measureNamed(lower.slice(space + 1));
  if (extreme !== undefined && measure !== undefined) return tiedBest(measure, extreme);
  if (!state.investigators.some((inv) => comparableName(inv.name) === lower)) return undefined;
  return (_ctx, _state, _enemy, investigators) =>
    investigators.filter((inv) => comparableName(inv.name) === lower);
}
/** Picks the investigators tied for the `extreme` of `measure`. */
function tiedBest(measure: PreyMeasure, extreme: 'lowest' | 'highest'): Prey['pick'] {
  return (ctx, state, enemy, investigators) => {
    const values = investigators.map((inv) => measure(ctx, state, enemy, inv));
    const best = extreme === 'lowest' ? Math.min(...values) : Math.max(...values);
    return investigators.filter((_inv, i) => values[i] === best);
  };
}

/** "Investigator at a [[Woods]] location": those whose location has the trait. */
function atLocationWith(wanted: Trait): Prey['pick'] {
  return (ctx, state, _enemy, investigators) =>
    investigators.filter((inv) => {
      const location = inv.locationId === undefined ? undefined : state.cards[inv.locationId];
      return location !== undefined && matchesCard(ctx, location, { trait: wanted });
    });
}

function measureNamed(name: string): PreyMeasure | undefined {
  const skill = SKILL_NAMES.find((skillName) => name === `[${skillName}]`);
  if (skill !== undefined) return (_ctx, _state, _enemy, inv) => boostedSkills(inv)[skill];
  return COUNTER_MEASURES[name];
}

/**
 * "Nearest to another [[Cultist]] enemy": connections from the investigator to the nearest other
 * enemy on the table with the trait (an engaged one is where its investigator is); infinite with
 * none or no path, so then every investigator ties.
 */
function distanceToEnemyWith(wanted: Trait): PreyMeasure {
  return (ctx, state, enemy, investigator) => {
    const from = investigator.locationId;
    if (from === undefined) return Infinity;
    const distances = enemiesOnTable(ctx, state, wanted)
      .filter((card) => card.id !== enemy.id)
      .map((card) => {
        const at = locationOfCard(state, card);
        return at === undefined ? Infinity : distance(ctx, state, from, at);
      });
    return Math.min(...distances);
  };
}
