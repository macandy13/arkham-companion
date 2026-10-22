import { listIfAny } from '@arkham/util';
import { locationShroud } from './board';
import { cardStats, resolveValue, type EngineContext } from './cards';
import { optionName } from './describe_decision';
import { doomInPlay, isInPlay } from './doom';
import { formatBoard } from './format_board';
import {
  cardMatcher,
  describeMatcher,
  enemyMatcher,
  investigatorMatcher,
  matchingCards,
  matchingInvestigators,
  type CardRef,
  type EnemyRef,
  type InvestigatorRef,
} from './card_matchers';
import { cardName, type CardName, type InstanceId, type InvestigatorId, type MapId } from './ids';
import { cardsInZone, cardsOfType } from './lookup';
import { mapLocations, type Edge, type GameMap, type GridCell } from './map';
import { attacksStillDue } from './phases';
import type {
  CardInstance,
  Decision,
  GameState,
  Investigator,
  InvestigatorStatus,
  Phase,
  PhaseStepId,
  SkillTest,
} from './state';
import type { Zone } from './zone';

/**
 * A usage error of a test table: an unknown or ambiguous name, a decision or
 * option that is not there. Its message ends with the board (`formatBoard`),
 * so a script that asks the wrong question fails where it happens, with the
 * state in front of the reader. Not a `CommandRejected`: no command was refused.
 */
export class TableError extends Error {
  constructor(message: string, board: string) {
    super(`${message}\n${board}`);
    this.name = 'TableError';
  }
}

/**
 * One investigator as a player reads them off the table. `at` is the printed
 * name of their location and `threatArea` the printed names of the cards in
 * their threat area, in play order; both are left out when empty, so an
 * expectation lists only what is there. Names, not instance ids, keep an
 * expectation readable; the location's id is `BoardView.location(byName(at)).id`.
 */
export interface InvestigatorView {
  id: InvestigatorId;
  /** The printed name of the investigator card. */
  name: CardName;
  status: InvestigatorStatus;
  at?: CardName;
  clues: number;
  resources: number;
  damage: number;
  horror: number;
  /** Actions left this round (`Investigator.actionsRemaining`). */
  actions: number;
  threatArea?: CardName[];
}

/**
 * One enemy in play: its printed name, the location it is at (its printed name), the
 * investigator it is engaged with, its damage and whether it is exhausted.
 * The last three are left out when there is none, so a list of enemies reads
 * like the table and asserts only what is there. It has no instance id: a
 * view compares whole (`toEqual`), and `BoardView.enemy` still accepts
 * `byId` to pick one of several copies.
 */
export interface EnemyView {
  name: CardName;
  /** The printed name of the location it is at. */
  at?: CardName;
  engagedWith?: InvestigatorId;
  damage?: number;
  exhausted?: true;
}

/**
 * One location on a map. `cards` are the printed names of the cards placed
 * unengaged at it (enemies and story assets; enemies engaged with an
 * investigator are in `enemies` of the `BoardView` only), `attachments` those
 * attached to it, both in play order.
 * Empty lists are left out, and so is doom while there is none. Only the
 * revealed side prints a shroud, so `revealed` decides whether it has one.
 */
export type LocationView = LocationViewBase &
  (
    | {
        revealed: true;
        /** Its shroud with what its attachments add (`locationShroud`). */
        shroud: number;
      }
    | { revealed: false }
  );

/** What a `LocationView` shows on either side of the card. */
interface LocationViewBase {
  id: InstanceId;
  name: CardName;
  map: MapId;
  clues: number;
  doom?: number;
  investigators?: InvestigatorId[];
  cards?: CardName[];
  attachments?: CardName[];
}

/**
 * One map as the screen draws it: its locations in map order, the book layout cell of each one
 * that has a cell (`GameMap.layout`, without cells of locations that have left the map) and its
 * connections between them. An edge to a location on another map is left out, since one map's
 * drawing cannot show it.
 */
export interface MapView {
  id: MapId;
  name: string;
  visible: boolean;
  locations: readonly LocationView[];
  cells: Readonly<Record<InstanceId, GridCell>>;
  connections: readonly Edge[];
  /**
   * The enemies at each of its locations that has any, engaged ones included (an engaged enemy is
   * at its investigator's location), in card order. Keyed by id rather than read from
   * `EnemyView.at`, since two copies of a location share a name.
   */
  enemies: Readonly<Record<InstanceId, readonly MapEnemyView[]>>;
}

/**
 * An enemy on a map (`MapView.enemies`): its `EnemyView` with its instance id, since the map is
 * where the players act on an enemy (drag it to move or engage it), and copies share a name.
 */
export type MapEnemyView = EnemyView & { id: InstanceId };

/**
 * The current agenda's name, the doom on the card itself and, when it has one, the doom
 * threshold for the player count. The threshold is compared with all doom in play
 * (`BoardView.doomInPlay`), not with `doom`.
 */
export interface AgendaView {
  name: CardName;
  doom: number;
  threshold?: number;
}

/** The current act's name and, when it has one, the clues it needs for the player count. */
export interface ActView {
  name: CardName;
  clues?: number;
}

/**
 * One open decision as the players see it: the question (`prompt`, the
 * engine's i18n key), the card it is `about`, the investigator it is `for`
 * (the one tested or attacked, who answers it), the dialog `kind`, the test of
 * a skill test, the options by readable name (`optionName`) and, for options
 * whose counts the players confirm or adjust, the default counts by option
 * name (e.g. `{ attack: { damage: 1, horror: 2 } }`).
 */
export interface DecisionView {
  prompt: string;
  kind: Decision['kind'];
  /** The printed name of the card the decision is about (`Decision.subject`). */
  about?: CardName;
  for?: InvestigatorId;
  test?: SkillTest;
  options: string[];
  defaults?: Record<string, Record<string, number>>;
}

/** One enemy attack enemy step 3.3 lists: the enemy by printed name and the investigator it attacks. */
export interface DueAttackView {
  enemy: CardName;
  investigator: InvestigatorId;
}

/**
 * The board read back in game language: structured views of the investigators,
 * enemies, locations, agenda, act and open decisions, plus finders that fail
 * with a `TableError` instead of returning nothing. Tests assert on these
 * (`expect(board.investigator(alice)).toMatchObject({ clues: 1 })`) rather than
 * on raw state or on `formatBoard` text. It wraps one state and derives each
 * view when read, so a reader pays only for the parts it asks for and every
 * view reads from the same sources as the engine (no copy to fall out of
 * date). Build a new one with `boardView` after each command.
 */
export class BoardView {
  constructor(
    private readonly ctx: EngineContext,
    private readonly state: GameState,
  ) {}

  get round(): number {
    return this.state.meta.round;
  }

  get phase(): Phase {
    return this.state.meta.phase;
  }

  /** The step the phase assistant is at: the next one still to run. */
  get step(): PhaseStepId | undefined {
    return this.state.meta.steps[0]?.id;
  }

  /** The investigator whose turn is in progress; absent between turns. */
  get turn(): InvestigatorId | undefined {
    return this.state.meta.turn?.investigatorId;
  }

  get lead(): InvestigatorId | undefined {
    return this.state.meta.leadInvestigator;
  }

  get ended(): boolean {
    return this.state.meta.ended === true;
  }

  get resolution(): string | undefined {
    return this.state.meta.resolution;
  }

  get investigators(): readonly InvestigatorView[] {
    return this.state.investigators.map((inv) => investigatorView(this.ctx, this.state, inv));
  }

  /** Enemies in play, in card order. */
  get enemies(): readonly EnemyView[] {
    return enemiesInPlay(this.ctx, this.state).map((card) => enemyView(this.ctx, this.state, card));
  }

  /** Locations on a map, in map order. */
  get locations(): readonly LocationView[] {
    return Object.keys(this.state.board.maps).flatMap((id) =>
      mapLocations(this.state, id as MapId).map((locationId) =>
        locationView(this.ctx, this.state, requireCard(this.state, locationId)),
      ),
    );
  }

  /** The maps of the board, in the order the scenario declared them. */
  get maps(): readonly MapView[] {
    return Object.entries(this.state.board.maps).map(([id, map]) =>
      mapView(this.ctx, this.state, id as MapId, map),
    );
  }

  get agenda(): AgendaView | undefined {
    return agendaView(this.ctx, this.state);
  }

  /** All doom the agenda's threshold counts: on every card in play and the players' (`doomInPlay`). */
  get doomInPlay(): number {
    return doomInPlay(this.state);
  }

  /**
   * The clues the investigators hold between them, which they may pool to advance the act
   * (`act.clues`). Eliminated investigators have dropped theirs, so every seat counts.
   */
  get cluesHeld(): number {
    return this.investigators.reduce((sum, investigator) => sum + investigator.clues, 0);
  }

  get act(): ActView | undefined {
    return actView(this.ctx, this.state);
  }

  /** Open decisions, oldest first. */
  get decisions(): readonly DecisionView[] {
    return this.state.pending.map((decision) => decisionView(this.ctx, this.state, decision));
  }

  /** The attacks step 3.3 lists, in its order; empty outside that step. */
  get attacksDue(): readonly DueAttackView[] {
    return dueAttacks(this.ctx, this.state);
  }

  /**
   * The one investigator `matcher` picks (a bare `InvestigatorId` is
   * `byId(id)`); fails with the board attached if there is none or several.
   */
  investigator(ref: InvestigatorRef): InvestigatorView {
    const wanted = investigatorMatcher(ref);
    const matches = matchingInvestigators(this.state.investigators, wanted);
    const [only, ...others] = matches;
    if (!only) throw this.error(`no investigator ${describeMatcher(wanted)}`);
    if (others.length > 0)
      throw this.error(
        `${matches.length} investigators match ${describeMatcher(wanted)}; ` +
          `use one of ${matches.map((inv) => inv.id).join(', ')}`,
      );
    return investigatorView(this.ctx, this.state, only);
  }

  /**
   * One field of every investigator by id, in seat order
   * (`board.perInvestigator('clues')` is `{ roland: 1, daisy: 3 }`), so a test
   * asserts the whole table in one `toEqual`.
   */
  perInvestigator<K extends keyof InvestigatorView>(
    field: K,
  ): Record<InvestigatorId, InvestigatorView[K]> {
    return Object.fromEntries(this.investigators.map((inv) => [inv.id, inv[field]])) as Record<
      InvestigatorId,
      InvestigatorView[K]
    >;
  }

  /** The printed names of the in-play locations on `map`, in map order. */
  locationsOn(map: MapId): CardName[] {
    return this.locations.filter((location) => location.map === map).map((l) => l.name);
  }

  /** The one location in play `ref` picks (a bare `InstanceId` is `byId(id)`); fails with the board attached if none or several match. */
  location(ref: CardRef): LocationView {
    const matcher = cardMatcher(ref);
    const inPlay = this.locations.map((location) => requireCard(this.state, location.id));
    const matches = matchingCards(this.ctx, inPlay, matcher);
    const [only, ...others] = matches;
    if (!only) throw this.error(`no location ${describeMatcher(matcher)} in play`);
    if (others.length > 0)
      throw this.error(
        `${matches.length} locations match ${describeMatcher(matcher)}; use one of ${ids(matches)}`,
      );
    return locationView(this.ctx, this.state, only);
  }

  /** The one enemy in play `ref` picks (see `EnemyMatcher`; a bare `InstanceId` is `byId(id)`). */
  enemy(ref: EnemyRef): EnemyView {
    return enemyView(this.ctx, this.state, this.enemyCard(ref));
  }

  /**
   * The instance id of the enemy `ref` picks, for the commands that name
   * it (`PlayTable` resolves its enemy refs here); the view itself has no id.
   */
  enemyId(ref: EnemyRef): InstanceId {
    return this.enemyCard(ref).id;
  }

  private enemyCard(ref: EnemyRef): CardInstance {
    const selector = enemyMatcher(ref);
    const { card, engagedWith, at } =
      selector.by === 'enemy'
        ? selector
        : { card: selector, engagedWith: undefined, at: undefined };
    const atId = at === undefined ? undefined : this.location(at).id;
    const engagedId = engagedWith === undefined ? undefined : this.investigator(engagedWith).id;
    const matches = matchingCards(
      this.ctx,
      enemiesInPlay(this.ctx, this.state),
      cardMatcher(card),
    ).filter(
      (enemy) =>
        (engagedId === undefined ||
          (enemy.zone.kind === 'engaged' && enemy.zone.investigatorId === engagedId)) &&
        (atId === undefined || enemyLocation(this.state, enemy) === atId),
    );
    const [only, ...others] = matches;
    if (!only) throw this.error(`no enemy in play ${describeMatcher(selector)}`);
    if (others.length > 0)
      throw this.error(
        `${matches.length} enemies match ${describeMatcher(selector)} (${ids(matches)}); ` +
          'narrow it with enemyMatching(card, { engagedWith, at }), or use byId',
      );
    return only;
  }

  /** The printed names of the cards in `zone`, top first. */
  namesIn(zone: Zone): CardName[] {
    return namesIn(this.ctx, this.state, zone);
  }

  private error(message: string): TableError {
    return new TableError(message, formatBoard(this.ctx, this.state));
  }
}

/** The `BoardView` of `state`. */
export function boardView(ctx: EngineContext, state: GameState): BoardView {
  return new BoardView(ctx, state);
}

function ids(cards: readonly CardInstance[]): string {
  return cards.map((card) => card.id).join(', ');
}

function requireCard(state: GameState, id: InstanceId): CardInstance {
  const card = state.cards[id];
  if (!card) throw new RangeError(`the state has no card ${id}`);
  return card;
}

function nameOf(ctx: EngineContext, card: CardInstance): CardName {
  return cardName(cardStats(ctx.cards, card.code).name);
}

function namesIn(ctx: EngineContext, state: GameState, zone: Zone): CardName[] {
  return cardsInZone(state, zone).map((id) => nameOf(ctx, requireCard(state, id)));
}

function nameOfId(
  ctx: EngineContext,
  state: GameState,
  id: InstanceId | undefined,
): CardName | undefined {
  return id === undefined ? undefined : nameOf(ctx, requireCard(state, id));
}

function investigatorView(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): InvestigatorView {
  const at = nameOfId(ctx, state, investigator.locationId);
  return {
    id: investigator.id,
    name: cardName(investigator.name),
    status: investigator.status,
    ...(at === undefined ? {} : { at }),
    clues: investigator.clues,
    resources: investigator.resources,
    damage: investigator.health.damage,
    horror: investigator.sanity.horror,
    actions: investigator.actionsRemaining,
    ...listIfAny(
      'threatArea',
      namesIn(ctx, state, { kind: 'threatArea', investigatorId: investigator.id }),
    ),
  };
}

function enemiesInPlay(ctx: EngineContext, state: GameState): CardInstance[] {
  return cardsOfType(ctx, state, 'enemy').filter((card) => isInPlay(state, card));
}

/** The location an enemy is at: its own, or that of the investigator it is engaged with. */
function enemyLocation(state: GameState, enemy: CardInstance): InstanceId | undefined {
  const { zone } = enemy;
  if (zone.kind === 'atLocation') return zone.locationId;
  if (zone.kind !== 'engaged') return undefined;
  return state.investigators.find((inv) => inv.id === zone.investigatorId)?.locationId;
}

function enemyView(ctx: EngineContext, state: GameState, enemy: CardInstance): EnemyView {
  const at = nameOfId(ctx, state, enemyLocation(state, enemy));
  return {
    name: nameOf(ctx, enemy),
    ...(at === undefined ? {} : { at }),
    ...(enemy.zone.kind === 'engaged' ? { engagedWith: enemy.zone.investigatorId } : {}),
    ...(enemy.tokens.damage ? { damage: enemy.tokens.damage } : {}),
    ...(enemy.exhausted ? { exhausted: true as const } : {}),
  };
}

function locationView(ctx: EngineContext, state: GameState, location: CardInstance): LocationView {
  const present = state.investigators.filter((inv) => inv.locationId === location.id);
  return {
    id: location.id,
    name: nameOf(ctx, location),
    map: mapOf(location),
    ...(location.faceUp
      ? { revealed: true as const, shroud: locationShroud(ctx, state, location) }
      : { revealed: false as const }),
    clues: location.tokens.clue ?? 0,
    ...(location.tokens.doom ? { doom: location.tokens.doom } : {}),
    ...listIfAny(
      'investigators',
      present.map((inv) => inv.id),
    ),
    ...listIfAny('cards', namesIn(ctx, state, { kind: 'atLocation', locationId: location.id })),
    ...listIfAny('attachments', namesIn(ctx, state, { kind: 'attachedTo', hostId: location.id })),
  };
}

function mapView(ctx: EngineContext, state: GameState, id: MapId, map: GameMap): MapView {
  const { name, visible, layout, connections } = map;
  const onMap = mapLocations(state, id);
  const isOnMap = (location: InstanceId) => onMap.includes(location);
  return {
    id,
    name,
    visible,
    locations: onMap.map((location) => locationView(ctx, state, requireCard(state, location))),
    cells: Object.fromEntries(
      onMap.flatMap((location) => {
        const cell = layout[location];
        return cell ? [[location, cell]] : [];
      }),
    ),
    connections: connections.filter((edge) => isOnMap(edge.from) && isOnMap(edge.to)),
    enemies: enemiesByLocation(ctx, state, onMap),
  };
}

function enemiesByLocation(
  ctx: EngineContext,
  state: GameState,
  locations: readonly InstanceId[],
): Record<InstanceId, MapEnemyView[]> {
  const byLocation: Record<InstanceId, MapEnemyView[]> = {};
  for (const enemy of enemiesInPlay(ctx, state)) {
    const at = enemyLocation(state, enemy);
    if (at === undefined || !locations.includes(at)) continue;
    (byLocation[at] ??= []).push({ id: enemy.id, ...enemyView(ctx, state, enemy) });
  }
  return byLocation;
}

function mapOf({ zone, id }: CardInstance): MapId {
  if (zone.kind !== 'location') throw new RangeError(`${id} is not a location on a map`);
  return zone.mapId;
}

function agendaView(ctx: EngineContext, state: GameState): AgendaView | undefined {
  const agenda = state.agenda.current === undefined ? undefined : state.cards[state.agenda.current];
  if (!agenda) return undefined;
  const { doom } = cardStats(ctx.cards, agenda.code);
  return {
    name: nameOf(ctx, agenda),
    doom: agenda.tokens.doom ?? 0,
    ...(doom === undefined ? {} : { threshold: resolveValue(doom, state.meta.playerCount) }),
  };
}

function actView(ctx: EngineContext, state: GameState): ActView | undefined {
  const act = state.act.current === undefined ? undefined : state.cards[state.act.current];
  if (!act) return undefined;
  const { clues } = cardStats(ctx.cards, act.code);
  return {
    name: nameOf(ctx, act),
    ...(clues === undefined ? {} : { clues: resolveValue(clues, state.meta.playerCount) }),
  };
}

function decisionView(ctx: EngineContext, state: GameState, decision: Decision): DecisionView {
  const defaults = Object.fromEntries(
    decision.options.flatMap((option) => {
      const counts = {
        ...(option.amount ? { amount: option.amount.default } : {}),
        ...Object.fromEntries(
          Object.entries(option.amounts ?? {}).map(([name, range]) => [name, range.default]),
        ),
      };
      return Object.keys(counts).length > 0 ? [[optionName(option), counts]] : [];
    }),
  );
  const about = nameOfId(ctx, state, decision.subject);
  return {
    prompt: decision.prompt,
    kind: decision.kind,
    ...(about === undefined ? {} : { about }),
    ...(decision.decider.kind === 'investigator' ? { for: decision.decider.investigatorId } : {}),
    ...(decision.skillTest ? { test: decision.skillTest } : {}),
    options: decision.options.map(optionName),
    ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
  };
}

function dueAttacks(ctx: EngineContext, state: GameState): DueAttackView[] {
  return attacksStillDue(ctx, state).map((attack) => ({
    enemy: nameOf(ctx, requireCard(state, attack.enemyId)),
    investigator: attack.investigatorId,
  }));
}
