import type {
  CardDb,
  CardInstance,
  CardStats,
  Difficulty,
  InstanceId,
  ScenarioId,
} from '@arkham/engine';
import { addCount, assertNever, groupBy, sum, unique } from '@arkham/util';
import type { RunResult } from './play_run';
import { scenarioContext } from './run';
import { byCountDescending } from './summary';

/**
 * What one game adds to the night's statistics (product.md "Continuous play tester", check 7):
 * reported, never a failure. Cards and abilities go by printed name, as a reader looks for them.
 */
export interface GameStatistics {
  readonly scenario: ScenarioId;
  readonly difficulty: Difficulty;
  /** The resolution reached (`R1`), or how the game ended without one. */
  readonly outcome: string;
  readonly rounds: number;
  /** The encounter deck as the scenario set it up, one name per copy. */
  readonly deck: readonly string[];
  /** The encounter cards drawn, in order. */
  readonly drawn: readonly string[];
  /** Every ability of the game's cards: `Name: revealed` for a forced one, `Name: action 1`. */
  readonly abilities: readonly string[];
  /** The abilities that fired: a forced one caused an event, an action was taken. */
  readonly fired: readonly string[];
  /**
   * What the players resolved by hand, once per time (M1V.5 picks what to automate from these):
   * `Name: not scripted` for a drawn encounter card the engine holds no effect of (`isUnscripted`),
   * `Name: DrawCards` for an effect of a card's ability the engine left to the players
   * (`CommandDeferred`, `AbilityEffectSkipped`).
   */
  readonly byHand: readonly string[];
}

/**
 * The statistics of `result`, read from its event log: the setup's cards, draws and causes.
 * `cards` names them, the run's scenario card data unless a test plays other cards.
 */
export function gameStatistics(
  result: RunResult,
  cards: CardDb = scenarioContext(result.run).cards,
): GameStatistics {
  const { run, log } = result;
  const setUp = log.flatMap(({ event }) => (event.type === 'ScenarioStarted' ? event.cards : []));
  const byId = new Map(setUp.map((card) => [card.id, card]));
  const nameOf = (id: InstanceId) => {
    const card = byId.get(id);
    return card ? (cards.get(card.code)?.name ?? card.code) : id;
  };
  const fired = new Set<string>();
  const drawn: string[] = [];
  const byHand: string[] = [];
  for (const { event, cause } of log) {
    if (cause?.kind === 'card') fired.add(`${nameOf(cause.cardId)}: ${cause.window.kind}`);
    if (event.type === 'CardActionUsed')
      fired.add(`${nameOf(event.cardId)}: action ${event.action + 1}`);
    if (event.type === 'EncounterCardDrawn') {
      drawn.push(nameOf(event.cardId));
      const code = byId.get(event.cardId)?.code;
      const card = code && cards.get(code);
      if (card && isUnscripted(card)) byHand.push(`${card.name}: not scripted`);
    }
    if (cause?.kind === 'card' && event.type === 'CommandDeferred')
      byHand.push(`${nameOf(cause.cardId)}: ${event.command.type}`);
    if (cause?.kind === 'card' && event.type === 'AbilityEffectSkipped')
      byHand.push(`${nameOf(cause.cardId)}: ${event.effect}`);
  }
  return {
    scenario: run.scenario,
    difficulty: run.difficulty,
    outcome: outcome(result),
    rounds: result.rounds,
    deck: setUp.filter(({ zone }) => zone.kind === 'encounterDeck').map(({ id }) => nameOf(id)),
    drawn,
    abilities: abilitiesOf(setUp, cards),
    fired: [...fired],
    byHand,
  };
}

/**
 * Whether the engine holds none of `card`'s text as data, so the players read and resolve all of
 * it: no forced or action ability, no modifier or restriction. Not an enemy, whose stats and
 * keywords the engine plays even without an ability.
 */
function isUnscripted(card: CardStats): boolean {
  return (
    card.typeCode !== 'enemy' &&
    !card.abilities?.length &&
    !card.actions?.length &&
    !card.modifiers?.length &&
    !card.restrictions?.length
  );
}

/** The resolution `result` reached, or how it ended without one. */
function outcome({ end, log }: RunResult): string {
  switch (end) {
    case 'eliminated':
      return 'no resolution';
    case 'stepCap':
      return 'step cap';
    case 'finding':
      return 'finding';
    case 'resolution': {
      const resolutions = log.flatMap(({ event }) =>
        event.type === 'ScenarioEnded' && event.resolution ? [event.resolution] : [],
      );
      return resolutions.at(-1) ?? 'no resolution';
    }
    default:
      return assertNever(end);
  }
}

/** Every forced and action ability of the cards in `setUp`, once per card name. */
function abilitiesOf(setUp: readonly CardInstance[], cards: CardDb): string[] {
  const abilities = new Set<string>();
  for (const { code } of setUp) {
    const card = cards.get(code);
    if (!card) continue;
    for (const { window } of card.abilities ?? []) abilities.add(`${card.name}: ${window.kind}`);
    card.actions?.forEach((_, index) => abilities.add(`${card.name}: action ${index + 1}`));
  }
  return [...abilities];
}

/**
 * The statistics of `games` for the job summary: per scenario and difficulty the outcomes and
 * rounds; per scenario each encounter card's share of the draws next to its share of the deck (a
 * shuffle bias shows as a gap), the abilities that never fired (paths no game tested) and what
 * the players resolved by hand, most often first.
 */
export function statisticsReport(games: readonly GameStatistics[]): string {
  const scenarios = unique(games.map(({ scenario }) => scenario));
  return [
    '### Statistics',
    '',
    '| Scenario | Difficulty | Games | Outcomes | Rounds (fewest, average, most) |',
    '| --- | --- | --- | --- | --- |',
    ...groupBy(games, ({ scenario, difficulty }) => `${scenario} | ${difficulty}`).map(
      ({ key, items: group }) => {
        const outcomes: Record<string, number> = {};
        for (const { outcome } of group) addCount(outcomes, outcome);
        const rounds = group.map((game) => game.rounds);
        const average = (sum(rounds) / rounds.length).toFixed(1);
        return `| ${key} | ${group.length} | ${byCountDescending(outcomes)} | ${Math.min(...rounds)}, ${average}, ${Math.max(...rounds)} |`;
      },
    ),
    ...scenarios.flatMap((scenario) => {
      const played = games.filter((game) => game.scenario === scenario);
      return [
        '',
        `#### Encounter draws, ${scenario}`,
        '',
        '| Card | Drawn | Share of draws | Share of deck |',
        '| --- | --- | --- | --- |',
        ...drawShares(played),
        '',
        `Abilities that never fired: ${neverFired(played).join(', ') || 'none'}`,
        '',
        `#### Resolved by hand, ${scenario}`,
        '',
        ...byHandRows(played),
      ];
    }),
  ].join('\n');
}

/**
 * A table row per encounter card of `games`, most copies in the deck first; a card drawn without
 * being in the set-up deck (one shuffled in later) comes last, with no share of the deck.
 */
function drawShares(games: readonly GameStatistics[]): string[] {
  const inDeck: Record<string, number> = {};
  const drawn: Record<string, number> = {};
  for (const game of games) {
    for (const name of game.deck) addCount(inDeck, name);
    for (const name of game.drawn) addCount(drawn, name);
  }
  const deckTotal = sum(games.map(({ deck }) => deck.length));
  const drawTotal = sum(games.map(({ drawn }) => drawn.length));
  for (const name of Object.keys(drawn)) inDeck[name] ??= 0;
  return Object.entries(inDeck)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([name, copies]) => {
      const times = drawn[name] ?? 0;
      return `| ${name} | ${times} | ${percent(times, drawTotal)} | ${percent(copies, deckTotal)} |`;
    });
}

/** The abilities of `games`' cards that fired in none of them, sorted. */
function neverFired(games: readonly GameStatistics[]): string[] {
  const fired = new Set(games.flatMap((game) => game.fired));
  const abilities = new Set(games.flatMap((game) => game.abilities));
  return [...abilities].filter((ability) => !fired.has(ability)).sort();
}

/**
 * A table row per thing the players resolved by hand in `games`, most often first, with the share
 * of games it happened in; `Nothing` when the engine did it all.
 */
function byHandRows(games: readonly GameStatistics[]): string[] {
  const times: Record<string, number> = {};
  const inGames: Record<string, number> = {};
  for (const game of games) {
    for (const effect of game.byHand) addCount(times, effect);
    for (const effect of unique(game.byHand)) addCount(inGames, effect);
  }
  const rows = Object.entries(times)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(
      ([effect, count]) =>
        `| ${effect} | ${count} | ${percent(inGames[effect] ?? 0, games.length)} |`,
    );
  if (rows.length === 0) return ['Nothing'];
  return ['| Effect | Times | Share of games |', '| --- | --- | --- |', ...rows];
}

/** `part` of `whole` as a percentage with one decimal; `-` of nothing. */
function percent(part: number, whole: number): string {
  return whole === 0 ? '-' : `${((100 * part) / whole).toFixed(1)} %`;
}
