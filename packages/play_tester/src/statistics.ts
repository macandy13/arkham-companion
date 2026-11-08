import type { CardDb, CardInstance, Difficulty, InstanceId, ScenarioId } from '@arkham/engine';
import { addCount, groupBy, sum, unique } from '@arkham/util';
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
}

/** The statistics of `result`, read from its event log: the setup's cards, draws and causes. */
export function gameStatistics(result: RunResult): GameStatistics {
  const { run, log } = result;
  const { cards } = scenarioContext(run);
  const setUp = log.flatMap(({ event }) => (event.type === 'ScenarioStarted' ? event.cards : []));
  const byId = new Map(setUp.map((card) => [card.id, card]));
  const nameOf = (id: InstanceId) => {
    const card = byId.get(id);
    return card ? (cards.get(card.code)?.name ?? card.code) : id;
  };
  const fired = new Set<string>();
  const drawn: string[] = [];
  for (const { event, cause } of log) {
    if (cause?.kind === 'card') fired.add(`${nameOf(cause.cardId)}: ${cause.window.kind}`);
    if (event.type === 'CardActionUsed')
      fired.add(`${nameOf(event.cardId)}: action ${event.action + 1}`);
    if (event.type === 'EncounterCardDrawn') drawn.push(nameOf(event.cardId));
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
  };
}

/** The resolution `result` reached, or how it ended without one. */
function outcome({ end, log }: RunResult): string {
  if (end === 'eliminated') return 'no resolution';
  if (end === 'stepCap') return 'step cap';
  if (end === 'finding') return 'finding';
  const resolutions = log.flatMap(({ event }) =>
    event.type === 'ScenarioEnded' && event.resolution ? [event.resolution] : [],
  );
  return resolutions.at(-1) ?? 'no resolution';
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
 * shuffle bias shows as a gap) and the abilities that never fired (paths no game tested).
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
      ];
    }),
  ].join('\n');
}

/** A table row per encounter card of `games`, most copies in the deck first. */
function drawShares(games: readonly GameStatistics[]): string[] {
  const inDeck: Record<string, number> = {};
  const drawn: Record<string, number> = {};
  for (const game of games) {
    for (const name of game.deck) addCount(inDeck, name);
    for (const name of game.drawn) addCount(drawn, name);
  }
  const deckTotal = sum(games.map(({ deck }) => deck.length));
  const drawTotal = sum(games.map(({ drawn }) => drawn.length));
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

/** `part` of `whole` as a percentage with one decimal; `-` of nothing. */
function percent(part: number, whole: number): string {
  return whole === 0 ? '-' : `${((100 * part) / whole).toFixed(1)} %`;
}
