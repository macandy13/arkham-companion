import {
  cardStats,
  resolveValue,
  type CardStats,
  type CardType,
  type EngineContext,
  type ScaledValue,
} from './cards';
import type { StartScenario, StartingCard } from './commands';
import { instanceId, type InstanceId, type MapId } from './ids';
import { CommandRejected } from './rejection';
import type { CampaignLog, ChaosToken, Difficulty, Edge, Investigator, TokenKind } from './state';
import type { Zone } from './zone';

/**
 * A number of tokens as printed in setup instructions: a plain amount or a
 * `ScaledValue` (e.g. "n per investigator"), resolved against the player count
 * by `compileSetup`.
 */
export type TokenAmount = number | ScaledValue;

/**
 * One declarative setup instruction (architecture §7 "Setup DSL"). Cards are
 * referred to by card code; a step that targets an existing card (`placeTokens`,
 * `spawn.at`, `moveInvestigators`, `addConnection`) needs exactly one instance
 * of that code created by an earlier step.
 */
export type SetupStep =
  /** Adds a map to the board; locations are put onto it by `putIntoPlay`. */
  | { kind: 'addMap'; mapId: MapId; name: string; visible?: boolean }
  /** Puts a location onto a map, unrevealed unless `faceUp`. */
  | { kind: 'putIntoPlay'; code: string; mapId: MapId; faceUp?: boolean }
  /** Puts one copy of each code into the set-aside zone. */
  | { kind: 'setAside'; codes: readonly string[] }
  /**
   * Shuffles the remainder of the given encounter sets into the encounter deck:
   * every enemy and treachery copy that no other step uses, minus all copies
   * of the `exclude` codes.
   */
  | { kind: 'buildEncounterDeck'; sets: readonly string[]; exclude?: readonly string[] }
  /** Places tokens on the one instance of `target`. */
  | { kind: 'placeTokens'; target: string; token: TokenKind; amount: TokenAmount }
  /**
   * Puts an enemy into play, unengaged, at the location with code `at`. It does
   * not engage investigators there yet (that needs the spawn rules, M1.8), so
   * setups spawn enemies away from the starting location for now.
   */
  | { kind: 'spawn'; code: string; at: string }
  /** Places every investigator at the location with code `to`, revealing it. */
  | { kind: 'moveInvestigators'; to: string }
  /** Connects two locations by code; one-way edges only allow `from` → `to`. */
  | { kind: 'addConnection'; from: string; to: string; oneWay?: boolean };

/**
 * A scenario as data (architecture §7): which agendas and acts it uses, its
 * chaos bag and the setup steps. `compileSetup` turns it into a `StartScenario`.
 * Hooks, resolutions and campaign variants join this type with the tasks that
 * need them.
 */
export interface ScenarioDefinition {
  /** Stored as `GameMeta.scenarioId`. */
  id: string;
  /** Standalone chaos bag per difficulty. */
  chaosBag: Record<Difficulty, readonly ChaosToken[]>;
  /** Agenda codes, first agenda first. */
  agendaDeck: readonly string[];
  /** Act codes, first act first. */
  actDeck: readonly string[];
  setup: readonly SetupStep[];
}

/** What the players choose when starting a scenario; input to `compileSetup`. */
export interface SetupOptions {
  difficulty: Difficulty;
  seed: number;
  /** In seat order; the first one is the lead investigator. */
  investigators: readonly Investigator[];
  campaign?: CampaignLog;
}

/** Cards and board built so far while compiling the setup steps in order. */
interface SetupDraft {
  readonly maps: Readonly<Record<MapId, { name: string; visible?: boolean }>>;
  readonly cards: readonly (StartingCard & { id: InstanceId })[];
  readonly connections: readonly Edge[];
  readonly investigatorLocation?: InstanceId;
}

/** Read-only inputs every step needs. */
interface SetupEnv {
  readonly ctx: EngineContext;
  readonly playerCount: number;
  /** Copies of each code that steps other than `buildEncounterDeck` put on the table. */
  readonly usedCopies: ReadonlyMap<string, number>;
}

/**
 * Card types that go into the encounter deck. Agendas, acts, locations and
 * story cards of an encounter set are placed by their own steps or stay out of
 * the game, so the "remainder" the rules shuffle is only enemies and treacheries.
 */
const ENCOUNTER_DECK_TYPES: ReadonlySet<CardType> = new Set<CardType>(['enemy', 'treachery']);

/**
 * Compiles a scenario definition into the `StartScenario` command that sets it
 * up. Pure: card data comes from `ctx`, and shuffling the encounter deck is
 * left to `handle` (seeded by `options.seed`), so the same inputs always
 * produce the same command. Throws `CommandRejected` for scenario data errors.
 * Locations that start revealed get their clues, as revealing would place them.
 */
export function compileSetup(
  ctx: EngineContext,
  def: ScenarioDefinition,
  options: SetupOptions,
): StartScenario {
  const env: SetupEnv = {
    ctx,
    playerCount: options.investigators.length,
    usedCopies: usedCopies(def),
  };
  const initial: SetupDraft = {
    maps: {},
    cards: [
      ...deckCards(def.agendaDeck, { kind: 'agendaDeck' }),
      ...deckCards(def.actDeck, { kind: 'actDeck' }),
    ],
    connections: [],
  };
  const draft = def.setup.reduce((acc, step) => applyStep(acc, step, env), initial);
  const location = draft.investigatorLocation;
  return {
    type: 'StartScenario',
    scenarioId: def.id,
    difficulty: options.difficulty,
    seed: options.seed,
    investigators: options.investigators.map((inv) =>
      location === undefined ? inv : { ...inv, locationId: location },
    ),
    maps: draft.maps,
    cards: draft.cards.map((card) => withRevealClues(card, env)),
    connections: [...draft.connections],
    chaosBag: [...def.chaosBag[options.difficulty]],
    ...(options.campaign ? { campaign: options.campaign } : {}),
  };
}

/** Starting cards for an agenda or act deck, in deck order. */
function deckCards(codes: readonly string[], zone: Zone): SetupDraft['cards'] {
  // Agendas and acts are double-sided; face up means side "a" is showing.
  return codes.map((code, i) => ({ id: newId(code, codes.slice(0, i)), code, zone, faceUp: true }));
}

/** The draft after one setup step. */
function applyStep(draft: SetupDraft, step: SetupStep, env: SetupEnv): SetupDraft {
  switch (step.kind) {
    case 'addMap':
      return {
        ...draft,
        maps: { ...draft.maps, [step.mapId]: { name: step.name, visible: step.visible ?? true } },
      };
    case 'putIntoPlay':
      return withCard(draft, step.code, { kind: 'location', mapId: step.mapId }, step.faceUp);
    case 'setAside':
      return step.codes.reduce((acc, code) => withCard(acc, code, { kind: 'setAside' }), draft);
    case 'buildEncounterDeck':
      return encounterDeckCards(step.sets, step.exclude ?? [], env).reduce(
        (acc, code) => withCard(acc, code, { kind: 'encounterDeck' }),
        draft,
      );
    case 'placeTokens':
      return withTokens(draft, step, env.playerCount);
    case 'spawn': {
      const locationId = targetId(draft, step.at);
      return withCard(draft, step.code, { kind: 'atLocation', locationId }, true);
    }
    case 'moveInvestigators':
      return moveInvestigators(draft, targetId(draft, step.to));
    case 'addConnection': {
      const edge: Edge = {
        from: targetId(draft, step.from),
        to: targetId(draft, step.to),
        oneWay: step.oneWay ?? false,
      };
      return { ...draft, connections: [...draft.connections, edge] };
    }
  }
}

/** The draft with one new instance of `code` appended in `zone`. */
function withCard(draft: SetupDraft, code: string, zone: Zone, faceUp = false): SetupDraft {
  const id = newId(
    code,
    draft.cards.map((card) => card.code),
  );
  return { ...draft, cards: [...draft.cards, { id, code, zone, faceUp }] };
}

/**
 * A readable, deterministic instance ID: the code plus a copy number
 * (`L1#1`, `L1#2`), so tests and saved games show which card is meant.
 */
function newId(code: string, existingCodes: readonly string[]): InstanceId {
  const copy = existingCodes.filter((other) => other === code).length + 1;
  return instanceId(`${code}#${copy}`);
}

/** The ID of the single instance of `code` in the draft. */
function targetId(draft: SetupDraft, code: string): InstanceId {
  const matches = draft.cards.filter((card) => card.code === code);
  const [match] = matches;
  if (!match) throw new CommandRejected({ code: 'setupTargetNotFound', cardCode: code });
  if (matches.length > 1)
    throw new CommandRejected({ code: 'setupTargetAmbiguous', cardCode: code });
  return match.id;
}

/** The draft with the step's tokens added to its target card. */
function withTokens(
  draft: SetupDraft,
  step: Extract<SetupStep, { kind: 'placeTokens' }>,
  playerCount: number,
): SetupDraft {
  const id = targetId(draft, step.target);
  const amount =
    typeof step.amount === 'number' ? step.amount : resolveValue(step.amount, playerCount);
  return {
    ...draft,
    cards: draft.cards.map((card) =>
      card.id === id ? { ...card, tokens: addTokens(card.tokens, step.token, amount) } : card,
    ),
  };
}

/** Copy of `tokens` with `amount` more of `token`. */
function addTokens(
  tokens: StartingCard['tokens'],
  token: TokenKind,
  amount: number,
): StartingCard['tokens'] {
  return { ...tokens, [token]: (tokens?.[token] ?? 0) + amount };
}

/** The draft with every investigator at `locationId`. */
function moveInvestigators(draft: SetupDraft, locationId: InstanceId): SetupDraft {
  // An investigator entering an unrevealed location reveals it.
  return {
    ...draft,
    investigatorLocation: locationId,
    cards: draft.cards.map((card) => (card.id === locationId ? { ...card, faceUp: true } : card)),
  };
}

/** The card with the clues a revealed location gets added to its tokens. */
function withRevealClues(card: StartingCard, env: SetupEnv): StartingCard {
  if (card.zone.kind !== 'location' || !card.faceUp) return card;
  const printed = cardStats(env.ctx.cards, card.code).clues;
  const clues = printed ? resolveValue(printed, env.playerCount) : 0;
  if (clues === 0) return card;
  return { ...card, tokens: addTokens(card.tokens, 'clue', clues) };
}

/** Codes of the encounter deck cards, one entry per copy, in set and db order. */
function encounterDeckCards(
  sets: readonly string[],
  exclude: readonly string[],
  env: SetupEnv,
): string[] {
  return sets
    .flatMap((set) => encounterSetCards(env.ctx, set))
    .filter((stats) => ENCOUNTER_DECK_TYPES.has(stats.typeCode) && !exclude.includes(stats.code))
    .flatMap((stats) => {
      const copies = Math.max(0, (stats.quantity ?? 1) - (env.usedCopies.get(stats.code) ?? 0));
      return Array.from({ length: copies }, () => stats.code);
    });
}

/** The definitions in an encounter set; rejects an empty (unknown) set. */
function encounterSetCards(ctx: EngineContext, set: string): readonly CardStats[] {
  const cards = ctx.cards.encounterSet(set);
  if (cards.length === 0)
    throw new CommandRejected({ code: 'unknownEncounterSet', encounterCode: set });
  return cards;
}

/**
 * How many copies of each code the scenario puts on the table outside the
 * encounter deck. Counted over all steps, so the deck excludes a set-aside
 * enemy whether it is set aside before or after the deck is built.
 */
function usedCopies(def: ScenarioDefinition): Map<string, number> {
  const codes = [...def.agendaDeck, ...def.actDeck, ...def.setup.flatMap(stepCodes)];
  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  return counts;
}

/** Codes of the cards a step creates (other than encounter deck cards). */
function stepCodes(step: SetupStep): readonly string[] {
  switch (step.kind) {
    case 'putIntoPlay':
    case 'spawn':
      return [step.code];
    case 'setAside':
      return step.codes;
    default:
      return [];
  }
}
