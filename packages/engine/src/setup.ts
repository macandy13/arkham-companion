import {
  findCurrentScenarioId,
  findInvestigator,
  storyHolds,
  type CampaignLog,
  type StoryCondition,
} from './campaign/campaign_log';
import {
  cardStats,
  resolveValue,
  type CardStats,
  type CardType,
  type EngineContext,
  type ScenarioContext,
  type ScaledValue,
} from './cards';
import type { StartScenario, StartingCard, StartingInvestigator } from './commands';
import {
  instanceId,
  type CardCode,
  type EncounterSetCode,
  type InstanceId,
  type InvestigatorCode,
  type InvestigatorId,
  type MapId,
  type ScenarioId,
} from './ids';
import { investigatorCard } from './investigator_cards';
import { layoutOf, type Edge, type GridCell, type MapSpec } from './map';
import { CommandRejected } from './rejection';
import { nextInt, seedRng } from './rng';
import type { ScenarioDefinition } from './scenario';
import { spawnZone } from './spawn';
import type { ChaosToken, Difficulty, TokenKind } from './state';
import type { Zone } from './zone';

/**
 * A number of tokens as printed in setup instructions: a plain amount or a
 * `ScaledValue` (e.g. "n per investigator"), resolved against the player count
 * by `compileSetup`.
 */
export type TokenAmount = number | ScaledValue;

/**
 * A location an `AddMapStep` puts into play, unrevealed unless `faceUp`, drawn in its `at` cell
 * of the book layout when the scenario guide gives one.
 */
export interface MapLocation {
  code: CardCode;
  /**
   * Other versions of the location ("choose one of the two Downtown locations at random"): setup
   * puts one of `code` and `versions` into play, picked with the setup's seed, and leaves the
   * rest out of the game. Connections and later steps still name the location by `code`.
   */
  versions?: readonly CardCode[];
  faceUp?: boolean;
  at?: GridCell;
}

/**
 * A connection an `AddMapStep` declares between two of its own locations, by
 * card code. One-way connections only allow movement from `from` to `to`.
 */
export interface MapConnection {
  from: CardCode;
  to: CardCode;
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
  /** Locations picked at random from a larger group, put into play beside `locations`. */
  atRandom?: RandomMapLocations;
  connections?: readonly MapConnection[];
}

/**
 * Locations an `AddMapStep` puts into play at random ("shuffle the 6 copies of Arkham Woods,
 * choose 4 of them at random and put them into play"): one of `codes` in each of `cells`,
 * picked with the setup's seed and unrevealed; the others leave the game. The step's
 * connections may name every one of `codes`; those to a location left out are dropped, so a
 * scenario declares the printed connections once for whichever locations come up.
 */
export interface RandomMapLocations {
  codes: readonly CardCode[];
  cells: readonly GridCell[];
}

/** Puts one copy of each code into the set-aside zone. */
export interface SetAsideStep {
  kind: 'setAside';
  codes: readonly CardCode[];
}

/**
 * Shuffles the remainder of the given encounter sets into the encounter deck:
 * every enemy and treachery copy that no other step uses, minus all copies of
 * the `exclude` codes.
 */
export interface BuildEncounterDeckStep {
  kind: 'buildEncounterDeck';
  sets: readonly EncounterSetCode[];
  exclude?: readonly CardCode[];
}

/** Shuffles one copy of each code into the encounter deck, whatever its encounter set. */
export interface ShuffleIntoEncounterDeckStep {
  kind: 'shuffleIntoEncounterDeck';
  codes: readonly CardCode[];
}

/** Places tokens on the one instance of the card with code `target`. */
export interface PlaceTokensStep {
  kind: 'placeTokens';
  target: CardCode;
  token: TokenKind;
  amount: TokenAmount;
}

/**
 * Spawns an enemy at the location with code `at` (see `spawnZone`), with `tokens` on it: a
 * forced "after it enters play" ability still triggers during setup (Acolyte's doom, FAQ), and
 * setup places what it would.
 */
export interface SpawnStep {
  kind: 'spawn';
  code: CardCode;
  at: CardCode;
  tokens?: Partial<Record<TokenKind, number>>;
}

/** Places every investigator at the location with code `to`, revealing it. */
export interface MoveInvestigatorsStep {
  kind: 'moveInvestigators';
  to: CardCode;
}

/**
 * Steps that apply only when the campaign log's story answers `condition`
 * with yes, `otherwise` steps when it answers no ("If the Ghoul Priest is
 * still alive, shuffle him into the encounter deck"). A standalone game has
 * no log and answers as an empty one (`storyHolds`).
 */
export interface WhenStoryStep {
  kind: 'whenStory';
  condition: StoryCondition;
  then: readonly SetupStep[];
  otherwise?: readonly SetupStep[];
}

/**
 * The steps of one of `options`, picked with the setup's seed ("randomly choose one of the
 * 4 Agents encounter sets"); the cards of the others stay out of the game.
 */
export interface OneAtRandomStep {
  kind: 'oneAtRandom';
  options: readonly (readonly SetupStep[])[];
}

/** Adds chaos tokens to the scenario's chaos bag ("add 1 elder thing token to the chaos bag"). */
export interface AddChaosTokensStep {
  kind: 'addChaosTokens';
  tokens: readonly ChaosToken[];
}

/** Steps that apply only with at least `atLeast` investigators ("if there are 3 or more"). */
export interface WhenPlayersStep {
  kind: 'whenPlayers';
  atLeast: number;
  then: readonly SetupStep[];
}

/**
 * One declarative setup instruction (architecture "Scenarios"). Cards are
 * referred to by card code; a step that targets an existing card
 * (`placeTokens`, `spawn.at`, `moveInvestigators`) needs exactly one instance
 * of that code created by an earlier step.
 */
export type SetupStep = PlacingStep | WhenStoryStep | WhenPlayersStep | OneAtRandomStep;

/**
 * A setup step that changes the table; `WhenStoryStep`s, `WhenPlayersStep`s and
 * `OneAtRandomStep`s resolve to these, and locations to one of their versions, before any is
 * applied.
 */
type PlacingStep =
  | AddMapStep
  | SetAsideStep
  | BuildEncounterDeckStep
  | ShuffleIntoEncounterDeckStep
  | PlaceTokensStep
  | SpawnStep
  | MoveInvestigatorsStep
  | AddChaosTokensStep;

/** Mixed into the setup seed for the location picks (`withPickedLocations`). */
const VERSION_PICK_STREAM = 0x5e7c9;

/** Mixed into the setup seed for the `OneAtRandomStep` picks. */
const STEP_PICK_STREAM = 0x0a7e5;

/** Resources every investigator starts a scenario with (rules reference, "Setup"). */
const STARTING_RESOURCES = 5;

/**
 * One seat at the table: which investigator card plays and the ID it has in
 * this game. The caller picks the ID because the engine generates none.
 */
export interface InvestigatorSeat {
  readonly id: InvestigatorId;
  readonly code: InvestigatorCode;
}

/** The choices every setup takes, standalone or in a campaign. */
interface SeatedSetupOptions {
  seed: number;
  /**
   * In seat order; the first one is the lead investigator. `compileSetup`
   * takes their printed stats from the `EngineContext`'s `CardDb`.
   */
  investigators: readonly InvestigatorSeat[];
}

/** A standalone scenario: the players pick the difficulty, and the bag is the scenario's for it. */
export interface StandaloneSetupOptions extends SeatedSetupOptions {
  difficulty: Difficulty;
  campaign?: undefined;
}

/**
 * A scenario of a campaign: the difficulty, the chaos bag and each
 * investigator's trauma come from the log, and the seats must be its team.
 */
export interface CampaignSetupOptions extends SeatedSetupOptions {
  campaign: CampaignLog;
  // Absent so a caller cannot pick a difficulty the log disagrees with.
  difficulty?: undefined;
}

/** What the players choose when starting a scenario; input to `compileSetup`. */
export type SetupOptions = StandaloneSetupOptions | CampaignSetupOptions;

/** A starting card with the ID setup gave it, so later steps can refer to it. */
type DraftCard = StartingCard & { id: InstanceId };

/** Cards and maps built so far while compiling the setup steps in order. */
interface SetupDraft {
  readonly maps: Readonly<Record<MapId, MapSpec>>;
  readonly cards: readonly DraftCard[];
  readonly investigatorLocation?: InstanceId;
  /** Tokens `addChaosTokens` steps add to the bag. */
  readonly chaosTokens: readonly ChaosToken[];
}

/** Read-only inputs every step needs. */
interface SetupEnv {
  readonly ctx: EngineContext;
  readonly playerCount: number;
  /** Copies of each code that steps other than `buildEncounterDeck` put on the table. */
  readonly usedCopies: ReadonlyMap<CardCode, number>;
}

/**
 * Card types that go into the encounter deck. Agendas, acts, locations and
 * story cards of an encounter set are placed by their own steps or stay out of
 * the game, so the "remainder" the rules shuffle is only enemies and treacheries.
 */
const ENCOUNTER_DECK_TYPES: ReadonlySet<CardType> = new Set<CardType>(['enemy', 'treachery']);

/**
 * Compiles the scenario definition in `ctx.scenario` into the `StartScenario`
 * command that sets it up. Pure: card data comes from `ctx`, and shuffling the encounter deck is
 * left to `handle` (seeded by `options.seed`), so the same inputs always
 * produce the same command. Throws `CommandRejected` for scenario data errors.
 * Locations that start revealed get their clues, as revealing would place them.
 */
export function compileSetup(ctx: ScenarioContext, options: SetupOptions): StartScenario {
  const def = ctx.scenario;
  const log = options.campaign;
  if (log) checkCampaignSeats(log, def.id, options.investigators);
  const playerCount = options.investigators.length;
  const steps = withPickedLocations(
    placingSteps(def.setup, {
      story: log?.story ?? {},
      playerCount,
      pick: seededPicker(options.seed ^ STEP_PICK_STREAM),
    }),
    options.seed,
  );
  const env: SetupEnv = {
    ctx,
    playerCount,
    usedCopies: usedCopies(def, steps),
  };
  const initial: SetupDraft = {
    maps: {},
    cards: [
      ...deckCards(def.agendaDeck, { kind: 'agendaDeck' }),
      ...deckCards(def.actDeck, { kind: 'actDeck' }),
    ],
    chaosTokens: [],
  };
  const difficulty = log ? log.difficulty : options.difficulty;
  const draft = steps.reduce((state, step) => applyStep(state, step, env), initial);
  const location = draft.investigatorLocation;
  return {
    type: 'StartScenario',
    scenarioId: def.id,
    difficulty,
    seed: options.seed,
    investigators: options.investigators.map((seat, index) => ({
      ...withTrauma(startingInvestigator(ctx, seat, index), log),
      ...(location === undefined ? {} : { locationId: location }),
    })),
    maps: draft.maps,
    cards: draft.cards.map((card) => withRevealClues(card, env)),
    chaosBag: [...(log ? log.chaosBag : def.chaosBag[difficulty]), ...draft.chaosTokens],
    ...(log ? { campaign: log } : {}),
  };
}

/**
 * Rejects a campaign setup for another scenario than the log's next one, or
 * whose seats are not exactly the log's team, or that seats a killed or
 * insane investigator, who must be replaced first (`ReplaceInvestigator`).
 * Every team member plays: a player who sits out leaves the campaign
 * between scenarios (Rules Reference, "Joining or Leaving a Campaign").
 */
function checkCampaignSeats(
  log: CampaignLog,
  scenarioId: ScenarioId,
  seats: readonly InvestigatorSeat[],
): void {
  const next = findCurrentScenarioId(log);
  if (scenarioId !== next)
    throw new CommandRejected({ code: 'notNextCampaignScenario', scenarioId, next });
  for (const { code } of seats) {
    const member = findInvestigator(log, code);
    if (!member) throw new CommandRejected({ code: 'notOnCampaignTeam', investigatorCode: code });
    if (member.fate !== 'alive')
      throw new CommandRejected({
        code: 'investigatorNeedsReplacement',
        investigatorCode: code,
        fate: member.fate,
      });
  }
  const unseated = log.investigators.find(({ code }) => !seats.some((seat) => seat.code === code));
  if (unseated)
    throw new CommandRejected({ code: 'campaignMemberNotSeated', investigatorCode: unseated.code });
}

/** The investigator starting with damage for their physical trauma and horror for their mental trauma. */
function withTrauma(
  investigator: StartingInvestigator,
  log: CampaignLog | undefined,
): StartingInvestigator {
  const member = log && findInvestigator(log, investigator.code);
  if (!member) return investigator;
  return {
    ...investigator,
    health: { ...investigator.health, damage: member.physicalTrauma },
    sanity: { ...investigator.sanity, horror: member.mentalTrauma },
  };
}

/** The investigator in `seat` as printed on their card, before any damage, horror or clues. */
function startingInvestigator(
  ctx: EngineContext,
  { id, code }: InvestigatorSeat,
  seat: number,
): StartingInvestigator {
  const card = investigatorCard(ctx.cards, code);
  if (!card) throw new CommandRejected({ code: 'unknownInvestigatorCard', investigatorCode: code });
  return {
    id,
    code,
    name: card.name,
    seat,
    health: { max: card.health, damage: 0 },
    sanity: { max: card.sanity, horror: 0 },
    clues: 0,
    resources: STARTING_RESOURCES,
    doomOnPlayerCards: 0,
    skills: card.skills,
    ...(card.imageSrc === undefined ? {} : { imageSrc: card.imageSrc }),
    status: 'active',
  };
}

/** Starting cards for an agenda or act deck, in deck order. */
function deckCards(codes: readonly CardCode[], zone: Zone): DraftCard[] {
  // Agendas and acts are double-sided; face up means side "a" is showing.
  return codes.map((code, i) => ({ id: newId(code, codes.slice(0, i)), code, zone, faceUp: true }));
}

/** What decides which conditional and random steps apply. */
interface StepPicks {
  readonly story: CampaignLog['story'];
  readonly playerCount: number;
  /** A random whole number below `bound`, from the setup's seed. */
  readonly pick: (bound: number) => number;
}

/**
 * Draws whole numbers below a bound from one seeded RNG stream, one after another. Each setup
 * pick takes a stream of its own, so the picks don't repeat the first draws of the game's RNG,
 * which `StartScenario` seeds with the same seed to shuffle the encounter deck.
 */
function seededPicker(seed: number): (bound: number) => number {
  let rng = seedRng(seed);
  return (bound) => {
    const [value, next] = nextInt(rng, bound);
    rng = next;
    return value;
  };
}

/**
 * The steps that apply, in order, with each `WhenStoryStep`, `WhenPlayersStep` and
 * `OneAtRandomStep` replaced by the steps it picks.
 */
function placingSteps(steps: readonly SetupStep[], picks: StepPicks): readonly PlacingStep[] {
  const { story, playerCount } = picks;
  return steps.flatMap((step) => {
    switch (step.kind) {
      case 'whenPlayers':
        return playerCount >= step.atLeast ? placingSteps(step.then, picks) : [];
      case 'oneAtRandom':
        return placingSteps(step.options[picks.pick(step.options.length)] ?? [], picks);
      case 'whenStory': {
        const holds = storyHolds(story, step.condition);
        if (holds === undefined)
          throw new CommandRejected({
            code: 'storyConditionMismatch',
            key: step.condition.key,
            condition: step.condition.kind,
          });
        return placingSteps(holds ? step.then : (step.otherwise ?? []), picks);
      }
      default:
        return [step];
    }
  });
}

/**
 * The steps with their random locations picked with `seed`: one version of each location that
 * has `versions`, every step that names the location by its `code` naming the picked version
 * instead, and each map's `atRandom` locations put among its locations.
 */
function withPickedLocations(steps: readonly PlacingStep[], seed: number): readonly PlacingStep[] {
  const pick = seededPicker(seed ^ VERSION_PICK_STREAM);
  const picks = new Map<CardCode, CardCode>();
  for (const location of steps.flatMap((step) => (step.kind === 'addMap' ? step.locations : []))) {
    if (!location.versions) continue;
    const choices = [location.code, ...location.versions];
    picks.set(location.code, choices[pick(choices.length)] ?? location.code);
  }
  const picked = (code: CardCode) => picks.get(code) ?? code;
  return steps.map((step) =>
    renamed(step.kind === 'addMap' ? withRandomLocations(step, pick) : step, picked),
  );
}

/**
 * The map step with its `atRandom` locations picked and placed in their cells, and without the
 * connections to the ones left out.
 */
function withRandomLocations(step: AddMapStep, pick: (bound: number) => number): AddMapStep {
  const { atRandom, ...map } = step;
  if (!atRandom) return step;
  const remaining = [...atRandom.codes];
  const placed: MapLocation[] = atRandom.cells.flatMap((at) => {
    const [code] = remaining.splice(pick(remaining.length), 1);
    return code === undefined ? [] : [{ code, at }];
  });
  const leftOut = new Set(remaining);
  return {
    ...map,
    locations: [...step.locations, ...placed],
    ...(step.connections && {
      connections: step.connections.filter(
        (connection) => !leftOut.has(connection.from) && !leftOut.has(connection.to),
      ),
    }),
  };
}

/** The step with every location it names by code renamed by `picked`. */
function renamed(step: PlacingStep, picked: (code: CardCode) => CardCode): PlacingStep {
  switch (step.kind) {
    case 'addMap':
      return {
        ...step,
        locations: step.locations.map((location) => ({ ...location, code: picked(location.code) })),
        ...(step.connections && {
          connections: step.connections.map((connection) => ({
            ...connection,
            from: picked(connection.from),
            to: picked(connection.to),
          })),
        }),
      };
    case 'placeTokens':
      return { ...step, target: picked(step.target) };
    case 'spawn':
      return { ...step, at: picked(step.at) };
    case 'moveInvestigators':
      return { ...step, to: picked(step.to) };
    case 'setAside':
    case 'buildEncounterDeck':
    case 'shuffleIntoEncounterDeck':
    case 'addChaosTokens':
      return step;
  }
}

/** The draft after one setup step. */
function applyStep(draft: SetupDraft, step: PlacingStep, env: SetupEnv): SetupDraft {
  switch (step.kind) {
    case 'addMap':
      return withMap(draft, step);
    case 'setAside':
      return step.codes.reduce((state, code) => withCard(state, code, { kind: 'setAside' }), draft);
    case 'shuffleIntoEncounterDeck':
      return step.codes.reduce(
        (state, code) => withCard(state, code, { kind: 'encounterDeck' }),
        draft,
      );
    case 'buildEncounterDeck':
      return encounterDeckCards(step.sets, step.exclude ?? [], env).reduce(
        (state, code) => withCard(state, code, { kind: 'encounterDeck' }),
        draft,
      );
    case 'placeTokens':
      return withTokens(draft, step, env.playerCount);
    case 'spawn':
      return withCard(
        draft,
        step.code,
        spawnZone(targetId(draft.cards, step.at)),
        true,
        step.tokens,
      );
    case 'moveInvestigators':
      return moveInvestigators(draft, targetId(draft.cards, step.to));
    case 'addChaosTokens':
      return { ...draft, chaosTokens: [...draft.chaosTokens, ...step.tokens] };
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
    // `withCard` appended one card per step location, in step order.
    layout: layoutOf(locations.map(({ id }, i) => ({ id, at: step.locations[i]?.at }))),
  };
  return { ...withLocations, maps: { ...draft.maps, [step.mapId]: map } };
}

/** A card as far as resolving setup codes is concerned: a draft card or a card in the game. */
interface CodedCard {
  readonly id: InstanceId;
  readonly code: CardCode;
}

/** The edge for a connection, resolved among the map's own location cards. */
function edge(locations: readonly CodedCard[], connection: MapConnection): Edge {
  return {
    from: targetId(locations, connection.from),
    to: targetId(locations, connection.to),
    oneWay: connection.oneWay ?? false,
  };
}

/** The draft with one new instance of `code` appended in `zone`, carrying `tokens` if given. */
function withCard(
  draft: SetupDraft,
  code: CardCode,
  zone: Zone,
  faceUp = false,
  tokens?: StartingCard['tokens'],
): SetupDraft {
  const id = newId(
    code,
    draft.cards.map((card) => card.code),
  );
  return {
    ...draft,
    cards: [...draft.cards, { id, code, zone, faceUp, ...(tokens && { tokens }) }],
  };
}

/**
 * A readable, deterministic instance ID: the code plus a copy number
 * (`L1#1`, `L1#2`), so tests and saved games show which card is meant.
 */
function newId(code: CardCode, existingCodes: readonly CardCode[]): InstanceId {
  const copy = existingCodes.filter((other) => other === code).length + 1;
  return instanceId(`${code}#${copy}`);
}

/** The ID of the single card with `code` among `cards`. */
function targetId(cards: readonly CodedCard[], code: CardCode): InstanceId {
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
  sets: readonly EncounterSetCode[],
  exclude: readonly CardCode[],
  env: SetupEnv,
): CardCode[] {
  return sets
    .flatMap((set) => encounterSetCards(env.ctx, set))
    .filter((stats) => ENCOUNTER_DECK_TYPES.has(stats.typeCode) && !exclude.includes(stats.code))
    .flatMap((stats) => {
      const copies = Math.max(0, (stats.quantity ?? 1) - (env.usedCopies.get(stats.code) ?? 0));
      return Array.from({ length: copies }, () => stats.code);
    });
}

/** The definitions in an encounter set; rejects an empty (unknown) set. */
function encounterSetCards(ctx: EngineContext, set: EncounterSetCode): readonly CardStats[] {
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
function usedCopies(def: ScenarioDefinition, steps: readonly PlacingStep[]): Map<CardCode, number> {
  const codes = [...def.agendaDeck, ...def.actDeck, ...steps.flatMap(stepCodes)];
  const counts = new Map<CardCode, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  return counts;
}

/** Codes of the cards a step creates (other than encounter deck cards). */
function stepCodes(step: PlacingStep): readonly CardCode[] {
  switch (step.kind) {
    case 'addMap':
      return step.locations.map((location) => location.code);
    case 'spawn':
      return [step.code];
    case 'setAside':
    case 'shuffleIntoEncounterDeck':
      return step.codes;
    default:
      return [];
  }
}
