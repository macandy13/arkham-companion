import {
  cardStats,
  resolveValue,
  type CardStats,
  type CardType,
  type EngineContext,
  type ScaledValue,
} from './cards';
import type { Command, StartScenario, StartingCard } from './commands';
import { isInPlay } from './doom';
import { instanceId, type InstanceId, type MapId } from './ids';
import type { Edge, MapSpec } from './map';
import { CommandRejected } from './rejection';
import type { ScenarioDefinition } from './scenario';
import { spawnZone } from './spawn';
import type { CampaignLog, Difficulty, GameState, Investigator, TokenKind } from './state';
import type { Zone } from './zone';

/**
 * A number of tokens as printed in setup instructions: a plain amount or a
 * `ScaledValue` (e.g. "n per investigator"), resolved against the player count
 * by `compileSetup`.
 */
export type TokenAmount = number | ScaledValue;

/** A location an `AddMapStep` puts into play, unrevealed unless `faceUp`. */
export interface MapLocation {
  code: string;
  faceUp?: boolean;
}

/**
 * A connection an `AddMapStep` declares between two of its own locations, by
 * card code. One-way connections only allow movement from `from` to `to`.
 */
export interface MapConnection {
  from: string;
  to: string;
  oneWay?: boolean;
}

/**
 * Adds a map to the board with its locations and their connections, so a map
 * is always declared as one unit (it becomes one `GameMap`).
 */
export interface AddMapStep {
  kind: 'addMap';
  mapId: MapId;
  name: string;
  /** Default true. */
  visible?: boolean;
  locations: readonly MapLocation[];
  connections?: readonly MapConnection[];
}

/** Puts one copy of each code into the set-aside zone. */
export interface SetAsideStep {
  kind: 'setAside';
  codes: readonly string[];
}

/**
 * Shuffles the remainder of the given encounter sets into the encounter deck:
 * every enemy and treachery copy that no other step uses, minus all copies of
 * the `exclude` codes.
 */
export interface BuildEncounterDeckStep {
  kind: 'buildEncounterDeck';
  sets: readonly string[];
  exclude?: readonly string[];
}

/** Places tokens on the one instance of the card with code `target`. */
export interface PlaceTokensStep {
  kind: 'placeTokens';
  target: string;
  token: TokenKind;
  amount: TokenAmount;
}

/** Spawns an enemy at the location with code `at` (see `spawnZone`). */
export interface SpawnStep {
  kind: 'spawn';
  code: string;
  at: string;
}

/** Places every investigator at the location with code `to`, revealing it. */
export interface MoveInvestigatorsStep {
  kind: 'moveInvestigators';
  to: string;
}

/**
 * One declarative setup instruction (architecture §7 "Setup DSL"). Cards are
 * referred to by card code; a step that targets an existing card
 * (`placeTokens`, `spawn.at`, `moveInvestigators`) needs exactly one instance
 * of that code created by an earlier step.
 */
export type SetupStep =
  | AddMapStep
  | SetAsideStep
  | BuildEncounterDeckStep
  | PlaceTokensStep
  | SpawnStep
  | MoveInvestigatorsStep;

/** What the players choose when starting a scenario; input to `compileSetup`. */
export interface SetupOptions {
  difficulty: Difficulty;
  seed: number;
  /** In seat order; the first one is the lead investigator. */
  investigators: readonly Investigator[];
  campaign?: CampaignLog;
}

/** A starting card with the ID setup gave it, so later steps can refer to it. */
type DraftCard = StartingCard & { id: InstanceId };

/** Cards and maps built so far while compiling the setup steps in order. */
interface SetupDraft {
  readonly maps: Readonly<Record<MapId, MapSpec>>;
  readonly cards: readonly DraftCard[];
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
  };
  const draft = def.setup.reduce((state, step) => applyStep(state, step, env), initial);
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
    chaosBag: [...def.chaosBag[options.difficulty]],
    ...(options.campaign ? { campaign: options.campaign } : {}),
  };
}

/**
 * The commands that apply an `addMap` step to a running scenario (a reverse
 * side or card effect that puts a new area into play): one `AddMap` whose
 * locations are the cards of the step's codes that are outside play (each
 * code must match exactly one, typically set aside), then a `RevealLocation`
 * for each `faceUp` location, since mid-scenario revealing places clues the
 * normal way. Throws `CommandRejected` when a code matches no card or several.
 */
export function compileMapStep(state: GameState, step: AddMapStep): Command[] {
  const available = Object.values(state.cards).filter((card) => !isInPlay(state, card));
  const locations = step.locations.map((location) => ({
    ...location,
    id: targetId(available, location.code),
  }));
  const addMap: Command = {
    type: 'AddMap',
    mapId: step.mapId,
    map: {
      name: step.name,
      visible: step.visible ?? true,
      connections: (step.connections ?? []).map((connection) => edge(locations, connection)),
    },
    locations: locations.map((location) => location.id),
  };
  const reveals = locations
    .filter((location) => location.faceUp)
    .map((location): Command => ({ type: 'RevealLocation', locationId: location.id }));
  return [addMap, ...reveals];
}

/** Starting cards for an agenda or act deck, in deck order. */
function deckCards(codes: readonly string[], zone: Zone): DraftCard[] {
  // Agendas and acts are double-sided; face up means side "a" is showing.
  return codes.map((code, i) => ({ id: newId(code, codes.slice(0, i)), code, zone, faceUp: true }));
}

/** The draft after one setup step. */
function applyStep(draft: SetupDraft, step: SetupStep, env: SetupEnv): SetupDraft {
  switch (step.kind) {
    case 'addMap':
      return withMap(draft, step);
    case 'setAside':
      return step.codes.reduce((state, code) => withCard(state, code, { kind: 'setAside' }), draft);
    case 'buildEncounterDeck':
      return encounterDeckCards(step.sets, step.exclude ?? [], env).reduce(
        (state, code) => withCard(state, code, { kind: 'encounterDeck' }),
        draft,
      );
    case 'placeTokens':
      return withTokens(draft, step, env.playerCount);
    case 'spawn':
      return withCard(draft, step.code, spawnZone(targetId(draft.cards, step.at)), true);
    case 'moveInvestigators':
      return moveInvestigators(draft, targetId(draft.cards, step.to));
  }
}

/** The draft with the step's map, its locations and its connections. */
function withMap(draft: SetupDraft, step: AddMapStep): SetupDraft {
  const zone: Zone = { kind: 'location', mapId: step.mapId };
  const withLocations = step.locations.reduce(
    (state, location) => withCard(state, location.code, zone, location.faceUp),
    draft,
  );
  const locations = withLocations.cards.slice(draft.cards.length);
  const map: MapSpec = {
    name: step.name,
    visible: step.visible ?? true,
    connections: (step.connections ?? []).map((connection) => edge(locations, connection)),
  };
  return { ...withLocations, maps: { ...draft.maps, [step.mapId]: map } };
}

/** A card as far as resolving setup codes is concerned: a draft card or a card in the game. */
interface CodedCard {
  readonly id: InstanceId;
  readonly code: string;
}

/** The edge for a connection, resolved among the map's own location cards. */
function edge(locations: readonly CodedCard[], connection: MapConnection): Edge {
  return {
    from: targetId(locations, connection.from),
    to: targetId(locations, connection.to),
    oneWay: connection.oneWay ?? false,
  };
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

/** The ID of the single card with `code` among `cards`. */
function targetId(cards: readonly CodedCard[], code: string): InstanceId {
  const matches = cards.filter((card) => card.code === code);
  const [match] = matches;
  if (!match) throw new CommandRejected({ code: 'setupTargetNotFound', cardCode: code });
  if (matches.length > 1)
    throw new CommandRejected({ code: 'setupTargetAmbiguous', cardCode: code });
  return match.id;
}

/** The draft with the step's tokens added to its target card. */
function withTokens(draft: SetupDraft, step: PlaceTokensStep, playerCount: number): SetupDraft {
  const id = targetId(draft.cards, step.target);
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
function withRevealClues(card: DraftCard, env: SetupEnv): DraftCard {
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
    case 'addMap':
      return step.locations.map((location) => location.code);
    case 'spawn':
      return [step.code];
    case 'setAside':
      return step.codes;
    default:
      return [];
  }
}
