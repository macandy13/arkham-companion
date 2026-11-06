import {
  cardDbWith,
  cardName,
  investigatorId,
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
 * One game the tester plays: the scenario, its difficulty, the investigators by printed name in
 * seat order (the first is the lead), the game seed (the engine's shuffles) and the bot seed (the
 * bot's choices). The same run always plays the same game, so a passing game needs no record.
 */
export interface Run {
  readonly scenario: ScenarioId;
  readonly difficulty: Difficulty;
  readonly seats: readonly CardName[];
  readonly gameSeed: number;
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

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'standard', 'hard', 'expert'];

/** The context `run`'s scenario is played in; fails for a scenario the tester does not know. */
export function scenarioContext(run: Run): ScenarioContext {
  const ctx = SCENARIOS.find(({ scenario }) => scenario.id === run.scenario);
  if (!ctx) throw new Error(`the play tester knows no scenario ${run.scenario}`);
  return ctx;
}

/** A table with `run`'s scenario set up for its seats, difficulty and game seed. */
export function setUpTable(run: Run): PlayTable {
  return PlayTable.setUp(scenarioContext(run), {
    seed: run.gameSeed,
    difficulty: run.difficulty,
    investigators: run.seats.map((name) => {
      const card = INVESTIGATORS.find((investigator) => investigator.name === name);
      if (!card) throw new Error(`the play tester knows no investigator ${name}`);
      return { id: investigatorId(card.code), code: card.code };
    }),
  });
}

/**
 * `games` runs drawn from `seed`: each picks a scenario, a difficulty, one to all of the real
 * investigators in a random seat order, and its two seeds. The same seed gives the same runs, so a
 * night's runs are named by their seed.
 */
export function runsFrom(seed: number, games: number): Run[] {
  const random = new SeededRandom(seed);
  return Array.from({ length: games }, (): Run => {
    const pool = INVESTIGATORS.map(({ name }) => cardName(name));
    return {
      scenario: random.pick(SCENARIOS).scenario.id,
      difficulty: random.pick(DIFFICULTIES),
      seats: Array.from(
        { length: 1 + random.below(pool.length) },
        () => pool.splice(random.below(pool.length), 1)[0]!,
      ),
      gameSeed: random.u32(),
      botSeed: random.u32(),
    };
  });
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

  /** An unsigned 32-bit number, e.g. a seed. */
  u32(): number {
    const [value, next] = nextU32(this.state);
    this.state = next;
    return value;
  }

  /** One of `items`, picked uniformly; fails for an empty list. */
  pick<T>(items: readonly T[]): T {
    return items[this.below(items.length)]!;
  }
}
