import { cardDbFrom, resolveValue, type CardStats, type EngineContext } from './cards';
import type { StartScenario, StartingCard, StartingInvestigator } from './commands';
import { execute } from './execute';
import { mapId, scenarioId, type InstanceId, type InvestigatorId, type MapId } from './ids';
import type { Edge, MapSpec } from './map';
import { blankInvestigator } from './blank_cards';
import { emptyState, type GameState, type TokenKind } from './state';
import type { Zone } from './zone';

/** How `GameBuilder.withLocation` places a location. */
export interface LocationOptions {
  /** Face up, with its printed clues for the player count unless `clues` says otherwise. */
  revealed?: boolean;
  /** Clues on the location instead of the printed ones. */
  clues?: number;
  /** The map it is on; default `main`. */
  map?: MapId;
}

/** How `GameBuilder.withCard` places a card besides its zone. */
export interface CardOptions {
  faceUp?: boolean;
  tokens?: Partial<Record<TokenKind, number>>;
}

/**
 * What `GameBuilder.withInvestigator` sets on top of `blankInvestigator`
 * stats; the seat defaults to the order the investigators were added in.
 */
export type InvestigatorOptions = Partial<Omit<StartingInvestigator, 'id'>>;

/** The started game a `GameBuilder` describes: the context that knows its cards, and the state. */
export interface BuiltGame {
  context: EngineContext;
  state: GameState;
}

/** The map every location is on unless `LocationOptions.map` names another. */
const MAIN_MAP = mapId('main');

interface LocationEntry {
  id: InstanceId;
  card: CardStats;
  options: LocationOptions;
}

interface CardEntry {
  id: InstanceId;
  card: CardStats;
  zone: Zone;
  options: CardOptions;
}

interface GameSpec {
  readonly locations: readonly LocationEntry[];
  readonly connections: readonly Edge[];
  readonly investigators: readonly StartingInvestigator[];
  readonly cards: readonly CardEntry[];
}

const EMPTY_SPEC: GameSpec = { locations: [], connections: [], investigators: [], cards: [] };

/**
 * Describes a game table piece by piece (locations, connections,
 * investigators, cards in their zones) and starts it as a scenario, so a
 * test, a sandbox board or a scenario under construction spells out only
 * what it is about. Each card is passed with its definition, typically a
 * `blank*` card with the stats that matter, and the builder collects the
 * definitions into the context, so the stats stay next to where the card is
 * placed.
 *
 * Immutable: every `with*` returns a new builder, so one builder can be the
 * common table of several tests that each add their own cards.
 *
 * The table starts through `StartScenario`, so it is validated like any
 * setup and every state change still goes through the reducer. Only the
 * pieces given are there: no agenda, act or chaos tokens unless added, and
 * none of setup's rules beyond placing a revealed location's clues (an
 * investigator does not reveal the location they start at, and the
 * encounter deck keeps the order its cards were added in, top first).
 */
export class GameBuilder {
  private constructor(private readonly spec: GameSpec) {}

  /** A builder for an empty table. */
  static empty(): GameBuilder {
    return new GameBuilder(EMPTY_SPEC);
  }

  /** The table with a location, unrevealed unless `options.revealed`. */
  withLocation(id: InstanceId, card: CardStats, options: LocationOptions = {}): GameBuilder {
    return this.with({ locations: [...this.spec.locations, { id, card, options }] });
  }

  /** The table with a connection between two of its locations, on the map of `from`. */
  withConnection(
    from: InstanceId,
    to: InstanceId,
    { oneWay = false }: { oneWay?: boolean } = {},
  ): GameBuilder {
    return this.with({ connections: [...this.spec.connections, { from, to, oneWay }] });
  }

  /** The table with an investigator (`blankInvestigator` stats unless `options` sets them). */
  withInvestigator(id: InvestigatorId, options: InvestigatorOptions = {}): GameBuilder {
    const seat = this.spec.investigators.length;
    return this.with({
      investigators: [...this.spec.investigators, startingInvestigator(id, seat, options)],
    });
  }

  /** The table with a card in `zone`; cards in one zone keep the order they were added in, top first. */
  withCard(id: InstanceId, card: CardStats, zone: Zone, options: CardOptions = {}): GameBuilder {
    return this.with({ cards: [...this.spec.cards, { id, card, zone, options }] });
  }

  /** The table with an agenda, face up, below the agendas added before it. */
  withAgenda(id: InstanceId, card: CardStats): GameBuilder {
    return this.withCard(id, card, { kind: 'agendaDeck' }, { faceUp: true });
  }

  /** The table with an act, face up, below the acts added before it. */
  withAct(id: InstanceId, card: CardStats): GameBuilder {
    return this.withCard(id, card, { kind: 'actDeck' }, { faceUp: true });
  }

  /** A context whose card db holds the definition of every card on the table. */
  context(): EngineContext {
    return { cards: cardDbFrom(this.definitions()) };
  }

  /** The `StartScenario` that sets up this table (standard difficulty, seed 1). */
  startCommand(): StartScenario {
    const playerCount = this.spec.investigators.length;
    return {
      type: 'StartScenario',
      scenarioId: scenarioId('custom'),
      difficulty: 'standard',
      seed: 1,
      shuffleEncounterDeck: false,
      investigators: [...this.spec.investigators],
      maps: this.maps(),
      cards: [
        ...this.spec.locations.map((location) => startingLocation(location, playerCount)),
        ...this.spec.cards.map(startingCard),
      ],
    };
  }

  /** The context and the state after `startCommand`. */
  start(): BuiltGame {
    const context = this.context();
    return { context, state: execute(context, emptyState(), this.startCommand()).state };
  }

  private with(changes: Partial<GameSpec>): GameBuilder {
    return new GameBuilder({ ...this.spec, ...changes });
  }

  /** Each card definition once; two different definitions for one code are a mistake in the table. */
  private definitions(): CardStats[] {
    const byCode = new Map<string, CardStats>();
    for (const { card } of [...this.spec.locations, ...this.spec.cards]) {
      const known = byCode.get(card.code);
      if (known && known !== card)
        throw new RangeError(`two different definitions for card code ${card.code}`);
      byCode.set(card.code, card);
    }
    return [...byCode.values()];
  }

  /** The maps of the locations, each with the connections that start at one of its locations. */
  private maps(): Record<MapId, MapSpec> {
    const mapOf = new Map(
      this.spec.locations.map(({ id, options }) => [id, options.map ?? MAIN_MAP]),
    );
    const maps: Record<MapId, MapSpec> = {};
    for (const map of new Set(mapOf.values())) {
      const connections = this.spec.connections.filter((edge) => mapOf.get(edge.from) === map);
      maps[map] = { name: map, connections };
    }
    return maps;
  }
}

/** A `GameBuilder` for an empty table; start here and add the pieces with `with*`. */
export function newGame(): GameBuilder {
  return GameBuilder.empty();
}

/**
 * `blankInvestigator` stats for `id` in `seat`, with `options` on top. Its
 * actions stay in the object but don't count: the start sets them.
 */
function startingInvestigator(
  id: InvestigatorId,
  seat: number,
  options: InvestigatorOptions,
): StartingInvestigator {
  return blankInvestigator({ id, seat, ...options });
}

function startingLocation({ id, card, options }: LocationEntry, playerCount: number): StartingCard {
  const revealed = options.revealed ?? false;
  const printedClues = revealed && card.clues ? resolveValue(card.clues, playerCount) : 0;
  const clues = options.clues ?? printedClues;
  return {
    id,
    code: card.code,
    zone: { kind: 'location', mapId: options.map ?? MAIN_MAP },
    faceUp: revealed,
    ...(clues > 0 ? { tokens: { clue: clues } } : {}),
  };
}

function startingCard({ id, card, zone, options }: CardEntry): StartingCard {
  return { id, code: card.code, zone, ...options };
}
