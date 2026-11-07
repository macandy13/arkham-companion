import { sum } from '@arkham/util';
import {
  cardDbWith,
  cardName,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  SKILL_NAMES,
  nextInt,
  nextU32,
  PlayTable,
  seedRng,
  type CardName,
  type Difficulty,
  type InvestigatorCard,
  type RngState,
  type ScenarioContext,
  type ScenarioId,
  type SkillName,
  type SkillValues,
  type StandaloneSetupOptions,
} from '@arkham/engine';
import {
  daisyWalker,
  rolandBanks,
  theGathering,
  theGatheringCards,
  wendyAdams,
  zealotInvestigatorCards,
} from '@arkham/scenarios';

/**
 * The bots (product.md "Continuous play tester"), each a weighting of the steps the board offers
 * (`botStep`): `random` any step, `goal` the steps that move the game on (clues, the act, the
 * enemies engaged), `chaos` undo, corrections and resigning far more often than players do.
 */
export const BOT_KINDS = ['random', 'goal', 'chaos'] as const;

/** One of `BOT_KINDS`. */
export type BotKind = (typeof BOT_KINDS)[number];

/**
 * One game the tester plays: the scenario, its difficulty, the investigators by printed name in
 * seat order (the first is the lead), the blank investigators among them with their stats, the
 * game seed (the engine's shuffles), the bot and its seed (the bot's choices). The same run always
 * plays the same game, so a passing game needs no record.
 */
export interface Run {
  readonly scenario: ScenarioId;
  readonly difficulty: Difficulty;
  readonly seats: readonly CardName[];
  readonly blanks: readonly InvestigatorCard[];
  readonly gameSeed: number;
  readonly bot: BotKind;
  readonly botSeed: number;
}

/**
 * The scenarios the tester plays, each with the context its table runs in. Only the real ones
 * (product.md "Continuous play tester"): a finding then always happens in a game someone could
 * play.
 */
const SCENARIOS: readonly ScenarioContext[] = [
  { cards: cardDbWith(theGatheringCards, zealotInvestigatorCards), scenario: theGathering },
];

/** The real investigators a run seats, all of them in every scenario's card data. */
const INVESTIGATORS: readonly InvestigatorCard[] = [rolandBanks, daisyWalker, wendyAdams];

/** The most investigators a scenario seats (product.md "What it plays": 1–4). */
const MAX_SEATS = 4;

/**
 * What a blank investigator's stats add up to, as a real investigator card's do: health and
 * sanity 14 or 15 together, the four skills 12 (Roland Banks: 9 + 5 and 3 + 3 + 4 + 2). How they
 * split is random, down to sanity 1 or a skill of 0, so defeat and elimination happen often; a
 * skill stays at most `maxSkill`.
 */
const BLANK_STATS = { healthAndSanity: [14, 15], skills: 12, maxSkill: 6 } as const;

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'standard', 'hard', 'expert'];

/**
 * The context `run`'s scenario is played in, its blank investigators added to the card data;
 * fails for a scenario the tester does not know.
 */
export function scenarioContext(run: Run): ScenarioContext {
  const ctx = SCENARIOS.find(({ scenario }) => scenario.id === run.scenario);
  if (!ctx) throw new Error(`the play tester knows no scenario ${run.scenario}`);
  return { ...ctx, cards: cardDbWith(ctx.cards, run.blanks.map(investigatorCardStats)) };
}

/** A table with `run`'s scenario set up for its seats, difficulty and game seed. */
export function setUpTable(run: Run): PlayTable {
  return PlayTable.setUp(scenarioContext(run), setupOptions(run));
}

/**
 * How `run`'s scenario is set up: its seats, difficulty and game seed. The web replay starts a
 * saved game with them (`startGame`), so it plays the same game as `setUpTable`.
 */
export function setupOptions(run: Run): StandaloneSetupOptions {
  return {
    seed: run.gameSeed,
    difficulty: run.difficulty,
    investigators: run.seats.map((name) => {
      const card = [...INVESTIGATORS, ...run.blanks].find(
        (investigator) => investigator.name === name,
      );
      if (!card) throw new Error(`the play tester knows no investigator ${name}`);
      return { id: investigatorId(card.code), code: card.code };
    }),
  };
}

/**
 * `games` runs drawn from `seed`: each picks a scenario, a difficulty, one to `MAX_SEATS` seats,
 * each a real investigator not yet seated or, as often, a blank one with random stats
 * (`blankInvestigator`), one of `bots` and its two seeds. The same seed gives the same runs, so a
 * night's runs are named by their seed.
 */
export function runsFrom(seed: number, games: number, bots: readonly BotKind[] = BOT_KINDS): Run[] {
  const random = new SeededRandom(seed);
  return Array.from({ length: games }, (): Run => {
    const pool = INVESTIGATORS.map(({ name }) => cardName(name));
    const blanks: InvestigatorCard[] = [];
    const seat = (): CardName => {
      if (pool.length > 0 && random.below(2) === 0)
        return pool.splice(random.below(pool.length), 1)[0]!;
      const blank = blankInvestigator(blanks.length + 1, random);
      blanks.push(blank);
      return cardName(blank.name);
    };
    return {
      scenario: random.pick(SCENARIOS).scenario.id,
      difficulty: random.pick(DIFFICULTIES),
      seats: Array.from({ length: 1 + random.below(MAX_SEATS) }, seat),
      blanks,
      gameSeed: random.u32(),
      bot: random.pick(bots),
      botSeed: random.u32(),
    };
  });
}

/**
 * Blank investigator number `number` of a run (`Blank 1`), with stats that add up as
 * `BLANK_STATS` says, split at random.
 */
export function blankInvestigator(number: number, random: SeededRandom): InvestigatorCard {
  const [fewest, most] = BLANK_STATS.healthAndSanity;
  const healthAndSanity = random.between(fewest, most);
  const health = random.between(1, healthAndSanity - 1);
  return {
    code: investigatorCode(`blank_${number}`),
    name: `Blank ${number}`,
    health,
    sanity: healthAndSanity - health,
    skills: randomSkills(random),
  };
}

/**
 * Skills that add up to `BLANK_STATS.skills`, each from 0 to `maxSkill`. They are drawn in a
 * random order, each from what the ones still to draw leave possible, so no skill is always the
 * leftover.
 */
function randomSkills(random: SeededRandom): SkillValues {
  const { maxSkill } = BLANK_STATS;
  const order = [...SKILL_NAMES];
  const skills: Partial<Record<SkillName, number>> = {};
  let left: number = BLANK_STATS.skills;
  while (order.length > 0) {
    const skill = order.splice(random.below(order.length), 1)[0]!;
    const after = order.length * maxSkill;
    const value =
      order.length === 0
        ? left
        : random.between(Math.max(0, left - after), Math.min(maxSkill, left));
    skills[skill] = value;
    left -= value;
  }
  return Object.fromEntries(SKILL_NAMES.map((skill) => [skill, skills[skill]])) as SkillValues;
}

/**
 * Random numbers from a seed, on the engine's seeded generator, so the tester's own choices (the
 * runs of a night, a bot's steps) repeat exactly like the engine's shuffles.
 */
export class SeededRandom {
  private state: RngState;

  constructor(seed: number) {
    this.state = seedRng(seed);
  }

  /** A whole number from 0 to below `bound`. */
  below(bound: number): number {
    const [value, next] = nextInt(this.state, bound);
    this.state = next;
    return value;
  }

  /** A whole number from `low` to `high`, both included. */
  between(low: number, high: number): number {
    return low + this.below(high - low + 1);
  }

  /** An unsigned 32-bit number, e.g. a seed. */
  u32(): number {
    const [value, next] = nextU32(this.state);
    this.state = next;
    return value;
  }

  /** A number from 0 to below 1, like `Math.random`, for engine helpers that take one (`drawTokens`). */
  fraction(): number {
    return this.u32() / 2 ** 32;
  }

  /** One of `items`, picked uniformly; fails for an empty list. */
  pick<T>(items: readonly T[]): T {
    return items[this.below(items.length)]!;
  }

  /**
   * The index of one of `weights`, each picked by its share of their sum; fails when they add up
   * to nothing.
   */
  pickWeighted(weights: readonly number[]): number {
    const total = sum(weights);
    if (!(total > 0)) throw new Error('nothing to pick: every weight is 0');
    let left = this.fraction() * total;
    let picked = 0;
    // Rounding can leave a sliver past the last weight; the last one that counts takes it.
    weights.forEach((weight, index) => {
      if (weight > 0 && left >= 0) picked = index;
      left -= weight;
    });
    return picked;
  }
}
