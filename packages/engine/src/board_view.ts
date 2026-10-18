import { listIfAny } from '@arkham/util';
import { locationsNamed } from './board';
import { cardStats, resolveValue, type EngineContext } from './cards';
import { optionName } from './describe_decision';
import { isInPlay } from './doom';
import { formatBoard } from './format_board';
import type { InstanceId, InvestigatorId, MapId } from './ids';
import { cardsInZone, cardsNamed, cardsOfType } from './lookup';
import { mapLocations } from './map';
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
 * A card named the way a player says it: its printed name, or an exact
 * `InstanceId` when copies share a name. An exact id match wins over a name match.
 */
export type CardRef = string;

/**
 * Picks one enemy in play: by `CardRef` alone, or narrowed by the investigator
 * it is engaged with or the location (`CardRef`) it is at, for when several
 * copies of a card are in play at once (three Swarms of Rats). A lookup that
 * matches more than one enemy fails instead of guessing.
 */
export type EnemySelector = CardRef | { name: CardRef; engagedWith?: InvestigatorId; at?: CardRef };

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
 * One investigator as a player reads them off the table. `at` is the name of
 * their location and `threatArea` the names of the cards in their threat area;
 * both are left out when empty, so an expectation lists only what is there.
 */
export interface InvestigatorView {
  id: InvestigatorId;
  name: string;
  status: InvestigatorStatus;
  at?: string;
  clues: number;
  resources: number;
  damage: number;
  horror: number;
  /** Actions left this round (`Investigator.actionsRemaining`). */
  actions: number;
  threatArea?: string[];
}

/**
 * One enemy in play: its name, the location it is at (by name), the
 * investigator it is engaged with, its damage and whether it is exhausted.
 * The last three are left out when there is none, so a list of enemies reads
 * like the table and asserts only what is there. It has no instance id: a
 * view compares whole (`toEqual`), and `BoardView.enemy` still accepts an
 * instance id to pick one of several copies.
 */
export interface EnemyView {
  name: string;
  at?: string;
  engagedWith?: InvestigatorId;
  damage?: number;
  exhausted?: true;
}

/**
 * One location on a map. `cards` are the names of the cards placed unengaged
 * at it (enemies and story assets; enemies engaged with an investigator are in
 * `enemies` of the `BoardView` only), `attachments` those attached to it.
 * Empty lists are left out.
 */
export interface LocationView {
  id: InstanceId;
  name: string;
  map: MapId;
  revealed: boolean;
  clues: number;
  investigators?: InvestigatorId[];
  cards?: string[];
  attachments?: string[];
}

/** The current agenda's name and the doom on the card itself (not the total in play). */
export interface AgendaView {
  name: string;
  doom: number;
}

/** The current act's name and, when it has one, the clues it needs for the player count. */
export interface ActView {
  name: string;
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
  about?: string;
  for?: InvestigatorId;
  test?: SkillTest;
  options: string[];
  defaults?: Record<string, Record<string, number>>;
}

/** One enemy attack enemy step 3.3 lists: the enemy by name and the investigator it attacks. */
export interface DueAttackView {
  enemy: string;
  investigator: InvestigatorId;
}

/**
 * The board read back in game language: structured views of the investigators,
 * enemies, locations, agenda, act and open decisions, plus finders that fail
 * with a `TableError` instead of returning nothing. Tests assert on these
 * (`expect(board.investigator(alice)).toMatchObject({ clues: 1 })`) rather than
 * on raw state or on `formatBoard` text. A snapshot of one state: build a new
 * one with `boardView` after each command.
 */
export class BoardView {
  readonly round: number;
  readonly phase: Phase;
  /** The step the phase assistant is at: the next one still to run. */
  readonly step?: PhaseStepId;
  /** The investigator whose turn is in progress; absent between turns. */
  readonly turn?: InvestigatorId;
  readonly lead?: InvestigatorId;
  readonly ended: boolean;
  readonly resolution?: string;
  readonly investigators: readonly InvestigatorView[];
  /** Enemies in play, in card order. */
  readonly enemies: readonly EnemyView[];
  /** Locations on a map, in map order. */
  readonly locations: readonly LocationView[];
  readonly agenda?: AgendaView;
  readonly act?: ActView;
  /** Open decisions, oldest first. */
  readonly decisions: readonly DecisionView[];
  /** The attacks step 3.3 lists, in its order; empty outside that step. */
  readonly attacksDue: readonly DueAttackView[];

  constructor(
    private readonly ctx: EngineContext,
    private readonly state: GameState,
  ) {
    const { meta } = state;
    this.round = meta.round;
    this.phase = meta.phase;
    this.step = meta.steps[0]?.id;
    this.turn = meta.turn?.investigatorId;
    this.lead = meta.leadInvestigator;
    this.ended = meta.ended === true;
    this.resolution = meta.resolution;
    this.investigators = state.investigators.map((inv) => investigatorView(ctx, state, inv));
    this.enemies = enemiesInPlay(ctx, state).map((card) => enemyView(ctx, state, card));
    this.locations = Object.keys(state.board.maps).flatMap((id) =>
      mapLocations(state, id as MapId).map((locationId) =>
        locationView(ctx, state, requireCard(state, locationId)),
      ),
    );
    this.agenda = agendaView(ctx, state);
    this.act = actView(ctx, state);
    this.decisions = state.pending.map((decision) => decisionView(ctx, state, decision));
    this.attacksDue = dueAttacks(ctx, state);
  }

  /** The investigator with `id`; fails with the board attached if there is none. */
  investigator(id: InvestigatorId): InvestigatorView {
    const found = this.investigators.find((inv) => inv.id === id);
    if (!found) throw this.error(`no investigator ${id}`);
    return found;
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

  /** The names of the in-play locations on `map`, in map order. */
  locationsOn(map: MapId): string[] {
    return this.locations.filter((location) => location.map === map).map((l) => l.name);
  }

  /** The one location in play `ref` names (an id, else a printed name). */
  location(ref: CardRef): LocationView {
    const byId = this.locations.find((location) => location.id === ref);
    if (byId) return byId;
    const named = locationsNamed(this.ctx, this.state, ref, { inPlay: true });
    const [only, ...others] = named;
    if (!only) throw this.error(`no location ${ref} in play`);
    if (others.length > 0)
      throw this.error(`${named.length} locations are named ${ref}; use one of ${ids(named)}`);
    return locationView(this.ctx, this.state, only);
  }

  /** The one enemy in play `selector` picks (see `EnemySelector`). */
  enemy(selector: EnemySelector): EnemyView {
    const { name, engagedWith, at } = typeof selector === 'string' ? { name: selector } : selector;
    const atId = at === undefined ? undefined : this.location(at).id;
    const inPlay = enemiesInPlay(this.ctx, this.state);
    const byId = inPlay.filter((card) => card.id === name);
    const candidates =
      byId.length > 0
        ? byId
        : cardsNamed(this.ctx, this.state, name, { typeCode: 'enemy' }).filter((card) =>
            inPlay.includes(card),
          );
    const matches = candidates.filter(
      (card) =>
        (engagedWith === undefined ||
          (card.zone.kind === 'engaged' && card.zone.investigatorId === engagedWith)) &&
        (atId === undefined || enemyLocation(this.state, card) === atId),
    );
    const [only, ...others] = matches;
    if (!only) throw this.error(`no enemy in play matching ${JSON.stringify(selector)}`);
    if (others.length > 0)
      throw this.error(
        `${matches.length} enemies match ${JSON.stringify(selector)} (${ids(matches)}); ` +
          'narrow it with { name, engagedWith } or { name, at }, or use an instance id',
      );
    return enemyView(this.ctx, this.state, only);
  }

  /** The names of the cards in `zone`, top first. */
  namesIn(zone: Zone): string[] {
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

function nameOf(ctx: EngineContext, card: CardInstance): string {
  return cardStats(ctx.cards, card.code).name;
}

function namesIn(ctx: EngineContext, state: GameState, zone: Zone): string[] {
  return cardsInZone(state, zone).map((id) => nameOf(ctx, requireCard(state, id)));
}

function nameOfId(
  ctx: EngineContext,
  state: GameState,
  id: InstanceId | undefined,
): string | undefined {
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
    name: investigator.name,
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
    revealed: location.faceUp,
    clues: location.tokens.clue ?? 0,
    ...listIfAny(
      'investigators',
      present.map((inv) => inv.id),
    ),
    ...listIfAny('cards', namesIn(ctx, state, { kind: 'atLocation', locationId: location.id })),
    ...listIfAny('attachments', namesIn(ctx, state, { kind: 'attachedTo', hostId: location.id })),
  };
}

function mapOf({ zone, id }: CardInstance): MapId {
  if (zone.kind !== 'location') throw new RangeError(`${id} is not a location on a map`);
  return zone.mapId;
}

function agendaView(ctx: EngineContext, state: GameState): AgendaView | undefined {
  const agenda = state.agenda.current === undefined ? undefined : state.cards[state.agenda.current];
  return agenda && { name: nameOf(ctx, agenda), doom: agenda.tokens.doom ?? 0 };
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
  const [step] = state.meta.steps;
  if (step?.id !== 'enemiesAttack') return [];
  return (step.attacks ?? []).map((attack) => ({
    enemy: nameOf(ctx, requireCard(state, attack.enemyId)),
    investigator: attack.investigatorId,
  }));
}
