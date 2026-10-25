import { cardDbFrom, resolveValue, type CardStats, type EngineContext } from './cards';
import type { Command, StartScenario, StartingCard, StartingInvestigator } from './commands';
import { execute } from './execute';
import {
  mapId,
  scenarioId,
  type CardCode,
  type InstanceId,
  type InvestigatorId,
  type MapId,
} from './ids';
import type { Edge, GridCell, MapSpec } from './map';
import { blankInvestigator } from './blank_cards';
import type { ScenarioDefinition, ScenarioReference } from './scenario';
import type { SkillModifierRegistry } from './skill_modifiers';
import {
  emptyState,
  type ChaosToken,
  type Difficulty,
  type GameState,
  type TokenKind,
} from './state';
import type { Zone } from './zone';

/** How `GameBuilder.withLocation` places a location. */
export interface LocationOptions {
  /** Face up, with its printed clues for the player count unless `clues` says otherwise. */
  revealed?: boolean;
  /** Clues on the location instead of the printed ones. */
  clues?: number;
  /** Doom on the location; default none. */
  doom?: number;
  /** The map it is on; default `main`. */
  map?: MapId;
  /** Its cell in the map's book layout; default none. */
  at?: GridCell;
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

/**
 * The scenario ID of every built table, stored as `GameMeta.scenarioId`; a
 * test campaign plays it to link a built game to its log.
 */
export const CUSTOM_SCENARIO = scenarioId('custom');

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

interface ConnectionEntry {
  edge: Edge;
  /** The map that owns the edge; the map of `edge.from` when absent. */
  map?: MapId;
}

/** How `GameBuilder.withMap` sets up a map. */
export interface MapOptions {
  /** Default the map's ID. */
  name?: string;
  /** Default true; a hidden map is an area the players cannot see yet. */
  visible?: boolean;
}

interface GameSpec {
  readonly locations: readonly LocationEntry[];
  readonly connections: readonly ConnectionEntry[];
  readonly maps: Readonly<Record<MapId, MapOptions>>;
  readonly investigators: readonly StartingInvestigator[];
  readonly cards: readonly CardEntry[];
  readonly difficulty: Difficulty;
  readonly seed: number;
  readonly shuffleEncounterDeck: boolean;
  readonly chaosBag: readonly ChaosToken[];
  /** The investigator whose turn `start` begins; none means the table stays at the start of the scenario. */
  readonly turnOf?: InvestigatorId;
  /** The parts of a scenario the engine reads while it plays; set means the context has a scenario. */
  readonly rules?: ScenarioRules;
}

/**
 * What `withReferenceCard` and `withSkillModifiers` set: the
 * parts of a `ScenarioDefinition` the engine reads while it plays. The setup
 * parts don't apply, since the builder places the table itself.
 */
type ScenarioRules = Partial<Pick<ScenarioDefinition, 'reference' | 'modifiers'>>;

const EMPTY_SPEC: GameSpec = {
  locations: [],
  connections: [],
  maps: {},
  investigators: [],
  cards: [],
  difficulty: 'standard',
  seed: 1,
  shuffleEncounterDeck: false,
  chaosBag: [],
};

/**
 * Describes a game table piece by piece (locations, maps and connections,
 * investigators, cards in their zones, and difficulty, seed and shuffle) and
 * starts it as a scenario, so a test, a sandbox board or a scenario under
 * construction spells out only what it is about. Each card is passed with
 * its definition, typically a `blank*` card with the stats that matter, and
 * the builder collects the definitions into the context, so the stats stay
 * next to where the card is placed.
 *
 * Immutable: every `with*` returns a new builder, so one builder can be the
 * common table of several tests that each add their own cards.
 *
 * The table starts through `StartScenario`, so it is validated like any
 * setup and every state change still goes through the reducer. Only the
 * pieces given are there: no agenda, act or chaos tokens unless added, and
 * none of setup's rules beyond placing a revealed location's clues (an
 * investigator does not reveal the location they start at, and the
 * encounter deck keeps the order its cards were added in, top first, unless
 * `withShuffledEncounterDeck`).
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

  /**
   * The table with a connection between two of its locations, owned by the
   * map of `from` unless `map` names another one.
   */
  withConnection(
    from: InstanceId,
    to: InstanceId,
    {
      oneWay = false,
      revealedOnly = false,
      map,
    }: { oneWay?: boolean; revealedOnly?: boolean; map?: MapId } = {},
  ): GameBuilder {
    const edge: Edge = { from, to, oneWay, ...(revealedOnly && { revealedOnly }) };
    const entry: ConnectionEntry = { edge, ...(map ? { map } : {}) };
    return this.with({ connections: [...this.spec.connections, entry] });
  }

  /** The table with a map set up as `options` says; a map with locations needs this only to change its name or visibility. */
  withMap(id: MapId, options: MapOptions): GameBuilder {
    return this.with({ maps: { ...this.spec.maps, [id]: options } });
  }

  /** The table played on `difficulty` instead of standard. */
  withDifficulty(difficulty: Difficulty): GameBuilder {
    return this.with({ difficulty });
  }

  /** The table started with `seed` instead of 1, for tests about what the RNG decides. */
  withSeed(seed: number): GameBuilder {
    return this.with({ seed });
  }

  /** The table with `tokens` in its chaos bag, which is empty unless set. */
  withChaosBag(tokens: readonly ChaosToken[]): GameBuilder {
    return this.with({ chaosBag: tokens });
  }

  /** The table with its encounter deck shuffled at the start instead of kept in the order added. */
  withShuffledEncounterDeck(): GameBuilder {
    return this.with({ shuffleEncounterDeck: true });
  }

  /** The table with an investigator (`blankInvestigator` stats unless `options` sets them). */
  withInvestigator(id: InvestigatorId, options: InvestigatorOptions = {}): GameBuilder {
    const seat = this.spec.investigators.length;
    return this.with({
      investigators: [...this.spec.investigators, startingInvestigator(id, seat, options)],
    });
  }

  /**
   * The table with a card in `zone`; cards in one zone keep the order they were added in, top first.
   * The instance id and the card's stats stay two arguments: no engine type pairs them (an
   * instance holds only its card code), and most tests name the instance after its card.
   */
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

  /**
   * The table started into round 1's investigation phase with `investigator`'s
   * turn begun, for tests of what happens during a turn (actions, attacks of
   * opportunity, turn end). `start` gets there through `NextPhase` and
   * `StartTurn` after `startCommand`, so the phase and turn are set up like
   * at the table.
   */
  withTurnOf(investigator: InvestigatorId): GameBuilder {
    return this.with({ turnOf: investigator });
  }

  /**
   * The table playing a scenario with this reference card in place of any
   * given before; without one, no symbol token has a printed modifier.
   */
  withReferenceCard(reference: ScenarioReference): GameBuilder {
    return this.withRules({ reference });
  }

  /** The table playing a scenario with these skill test modifiers in place of any given before. */
  withSkillModifiers(modifiers: SkillModifierRegistry): GameBuilder {
    return this.withRules({ modifiers });
  }

  /**
   * A context whose card db holds the definition of every card on the table,
   * and a scenario when `withReferenceCard` or `withSkillModifiers`
   * gave one.
   */
  context(): EngineContext {
    const { rules } = this.spec;
    return {
      cards: cardDbFrom(this.definitions()),
      ...(rules ? { scenario: scenarioOf(rules) } : {}),
    };
  }

  /** The `StartScenario` that sets up this table (standard difficulty and seed 1 unless set). */
  startCommand(): StartScenario {
    const playerCount = this.spec.investigators.length;
    return {
      type: 'StartScenario',
      scenarioId: CUSTOM_SCENARIO,
      difficulty: this.spec.difficulty,
      seed: this.spec.seed,
      shuffleEncounterDeck: this.spec.shuffleEncounterDeck,
      chaosBag: [...this.spec.chaosBag],
      investigators: [...this.spec.investigators],
      maps: this.maps(),
      cards: [
        ...this.spec.locations.map((location) => startingLocation(location, playerCount)),
        ...this.spec.cards.map(startingCard),
      ],
    };
  }

  /** The commands after `startCommand` that begin the turn of `withTurnOf`; none without it. */
  turnCommands(): Command[] {
    const { turnOf } = this.spec;
    return turnOf ? beginTurn(turnOf) : [];
  }

  /** The context and the state after `startCommand` and `turnCommands`. */
  start(): BuiltGame {
    const context = this.context();
    const state = [this.startCommand(), ...this.turnCommands()].reduce(
      (current, command) => execute(context, current, command).state,
      emptyState(),
    );
    return { context, state };
  }

  private with(changes: Partial<GameSpec>): GameBuilder {
    return new GameBuilder({ ...this.spec, ...changes });
  }

  private withRules(changes: ScenarioRules): GameBuilder {
    return this.with({ rules: { ...this.spec.rules, ...changes } });
  }

  /** Each card definition once; two different definitions for one code are a mistake in the table. */
  private definitions(): CardStats[] {
    const byCode = new Map<CardCode, CardStats>();
    for (const { card } of [...this.spec.locations, ...this.spec.cards]) {
      const known = byCode.get(card.code);
      if (known && known !== card)
        throw new RangeError(`two different definitions for card code ${card.code}`);
      byCode.set(card.code, card);
    }
    return [...byCode.values()];
  }

  /**
   * The maps of the locations and of `withMap`, each with the connections it
   * owns: those `withConnection` gave it, else those starting at one of its
   * locations.
   */
  private maps(): Record<MapId, MapSpec> {
    const mapOf = new Map(
      this.spec.locations.map(({ id, options }) => [id, options.map ?? MAIN_MAP]),
    );
    // An edge from an ID that is no location goes to the main map, so `StartScenario` rejects it.
    const ownerOf = ({ edge, map }: ConnectionEntry) => map ?? mapOf.get(edge.from) ?? MAIN_MAP;
    const ids = new Set([
      ...mapOf.values(),
      ...this.spec.connections.map(ownerOf),
      ...(Object.keys(this.spec.maps) as MapId[]),
    ]);
    const maps: Record<MapId, MapSpec> = {};
    for (const map of ids) {
      const { name = map, visible } = this.spec.maps[map] ?? {};
      const connections = this.spec.connections
        .filter((entry) => ownerOf(entry) === map)
        .map(({ edge }) => edge);
      const layout = Object.fromEntries(
        this.spec.locations.flatMap(({ id, options }) =>
          options.at && mapOf.get(id) === map ? [[id, options.at]] : [],
        ),
      );
      maps[map] = { name, connections, layout, ...(visible === undefined ? {} : { visible }) };
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
  return blankInvestigator(id, { seat, ...options });
}

/** From setup into round 1's investigation phase, then `investigator` starts their turn. */
function beginTurn(investigator: InvestigatorId): Command[] {
  return [{ type: 'NextPhase' }, { type: 'StartTurn', investigatorId: investigator }];
}

/** A scenario with `rules` and nothing to set up: the builder places the table itself. */
function scenarioOf({ reference, modifiers }: ScenarioRules): ScenarioDefinition {
  return {
    id: CUSTOM_SCENARIO,
    chaosBag: { easy: [], standard: [], hard: [], expert: [] },
    reference: reference ?? { easyStandard: {}, hardExpert: {} },
    agendaDeck: [],
    actDeck: [],
    setup: [],
    ...(modifiers ? { modifiers } : {}),
  };
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
    ...(clues > 0 || options.doom
      ? {
          tokens: {
            ...(clues > 0 ? { clue: clues } : {}),
            ...(options.doom ? { doom: options.doom } : {}),
          },
        }
      : {}),
  };
}

function startingCard({ id, card, zone, options }: CardEntry): StartingCard {
  return { id, code: card.code, zone, ...options };
}
