import { neighbours } from './board';
import { resolveValue, type EngineContext } from './cards';
import { describeDecision } from './describe_decision';
import { doomInPlay } from './doom';
import type { InstanceId, MapId } from './ids';
import { cardsInZone } from './lookup';
import { mapLocations } from './map';
import { PHASE_STEP_TITLES } from './phases';
import type { CardInstance, Decision, GameState, Investigator, PhaseStep } from './state';
import type { Zone } from './zone';

/**
 * The board as plain text, for debugging and test failure messages: round and
 * phase, the outstanding phase steps, the turn in progress and the turns
 * taken, current agenda and act, every map with its locations (clues,
 * investigators, enemies, connections), every investigator, the encounter
 * piles and a card whose revelation is being resolved, set-aside cards, victory display and
 * pending decisions, each skill test with its suggested values. Cards are
 * named by their `CardDb` name; instance IDs appear only in brackets where
 * copies need telling apart (locations, enemies, and pending decisions that
 * would otherwise read the same). The order is fixed (map,
 * zone and seat order), so the output is stable enough for inline snapshots.
 * Pure: it returns the text and never prints it.
 */
export function formatBoard(ctx: EngineContext, state: GameState): string {
  return [
    `Round ${state.meta.round}, ${state.meta.phase} phase`,
    ...stepLines(state),
    ...turnLines(state),
    agendaLine(ctx, state),
    actLine(ctx, state),
    ...Object.keys(state.board.maps).flatMap((id) => mapLines(ctx, state, id as MapId)),
    'Investigators:',
    ...state.investigators.map((investigator) => investigatorLine(ctx, state, investigator)),
    encounterLine(ctx, state),
    ...resolvingLines(ctx, state),
    `Set aside: ${countIn(state, { kind: 'setAside' })} cards`,
    `Victory display: ${listOrNone(namesIn(ctx, state, { kind: 'victoryDisplay' }))}`,
    ...decisionLines(ctx, state),
  ].join('\n');
}

/** The phase steps still to run, by name; nothing when none are left. */
function stepLines(state: GameState): string[] {
  const { steps } = state.meta;
  if (steps.length === 0) return [];
  return [`Steps left: ${steps.map((step) => stepLabel(state, step)).join(', ')}`];
}

function stepLabel(state: GameState, step: PhaseStep): string {
  if (step.id === 'drawEncounterCard')
    return `drawEncounterCard (${investigatorName(state, step.investigatorId)})`;
  if (step.id === 'enemiesAttack' && step.attacks)
    return `enemiesAttack (${step.attacks.length} attacks to resolve)`;
  return `${step.id} (${PHASE_STEP_TITLES[step.id]})`;
}

/** The turn in progress and the turns already taken this round, if any. */
function turnLines(state: GameState): string[] {
  const { turn, turnsTaken } = state.meta;
  return [
    ...(turn ? [`Turn: ${investigatorName(state, turn.investigatorId)}`] : []),
    ...(turnsTaken.length > 0
      ? [`Turns taken: ${turnsTaken.map((id) => investigatorName(state, id)).join(', ')}`]
      : []),
  ];
}

function agendaLine(ctx: EngineContext, state: GameState): string {
  const agenda = currentCard(state, state.agenda.current);
  if (!agenda) return 'Agenda: none';
  const threshold = ctx.cards.get(agenda.code)?.doom;
  const of = threshold === undefined ? '' : `/${resolveValue(threshold, state.meta.playerCount)}`;
  return `Agenda: ${nameOf(ctx, agenda)} – doom ${doomInPlay(state)}${of}`;
}

function actLine(ctx: EngineContext, state: GameState): string {
  const act = currentCard(state, state.act.current);
  if (!act) return 'Act: none';
  const clues = ctx.cards.get(act.code)?.clues;
  const requirement =
    clues === undefined
      ? 'no clue requirement'
      : `needs ${resolveValue(clues, state.meta.playerCount)} clues`;
  return `Act: ${nameOf(ctx, act)} – ${requirement}`;
}

function mapLines(ctx: EngineContext, state: GameState, id: MapId): string[] {
  const map = state.board.maps[id];
  if (!map) return [];
  const hidden = map.visible ? '' : ' (hidden)';
  const locations = mapLocations(state, id).flatMap((locationId) =>
    locationLines(ctx, state, locationId),
  );
  return [`Map ${map.name}${hidden}:`, ...(locations.length > 0 ? locations : ['  no locations'])];
}

function locationLines(ctx: EngineContext, state: GameState, locationId: InstanceId): string[] {
  const location = state.cards[locationId];
  if (!location) return [];
  const revealed = location.faceUp ? `revealed, ${location.tokens.clue ?? 0} clues` : 'unrevealed';
  const present = state.investigators.filter(
    (investigator) => investigator.locationId === locationId,
  );
  const enemies = [
    ...cardsIn(state, { kind: 'atLocation', locationId }),
    ...present.flatMap((investigator) =>
      cardsIn(state, { kind: 'engaged', investigatorId: investigator.id }),
    ),
  ];
  const attached = cardsIn(state, { kind: 'attachedTo', hostId: locationId });
  return [
    `  ${labelOf(ctx, location)} – ${revealed}`,
    ...(present.length > 0 ? [`    investigators: ${present.map((i) => i.name).join(', ')}`] : []),
    ...enemies.map((card) => `    ${cardAtLocationLine(ctx, state, card)}`),
    ...(attached.length > 0
      ? [`    attached: ${attached.map((card) => nameOf(ctx, card)).join(', ')}`]
      : []),
    `    connects to: ${listOrNone(neighbours(state, locationId).map((id) => nameOfId(ctx, state, id)))}`,
  ];
}

/** An enemy (or other card) at a location, with what the players track on it. */
function cardAtLocationLine(ctx: EngineContext, state: GameState, card: CardInstance): string {
  const zone = card.zone;
  const details = [
    ...(card.tokens.damage ? [`${card.tokens.damage} damage`] : []),
    ...(card.tokens.doom ? [`${card.tokens.doom} doom`] : []),
    ...(card.exhausted ? ['exhausted'] : []),
    zone.kind === 'engaged'
      ? `engaged with ${investigatorName(state, zone.investigatorId)}`
      : 'unengaged',
  ];
  return `${labelOf(ctx, card)} – ${details.join(', ')}`;
}

function investigatorLine(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): string {
  const where =
    investigator.locationId === undefined
      ? 'nowhere'
      : nameOfId(ctx, state, investigator.locationId);
  const status = investigator.status === 'active' ? '' : ` (${investigator.status})`;
  const threatArea = namesIn(ctx, state, { kind: 'threatArea', investigatorId: investigator.id });
  return (
    `  ${investigator.name}${status} – ${where}; ` +
    `damage ${investigator.health.damage}/${investigator.health.max}, ` +
    `horror ${investigator.sanity.horror}/${investigator.sanity.max}, ` +
    `${investigator.clues} clues, ${investigator.resources} resources, ` +
    `actions left ${investigator.actionsRemaining}; ` +
    `threat area: ${listOrNone(threatArea)}`
  );
}

function encounterLine(ctx: EngineContext, state: GameState): string {
  const [top] = namesIn(ctx, state, { kind: 'encounterDiscard' });
  const discardTop = top === undefined ? '' : `, top: ${top}`;
  return (
    `Encounter deck: ${countIn(state, { kind: 'encounterDeck' })} cards; ` +
    `discard: ${countIn(state, { kind: 'encounterDiscard' })} cards${discardTop}`
  );
}

/** The encounter cards whose revelation is still being resolved, if any. */
function resolvingLines(ctx: EngineContext, state: GameState): string[] {
  const resolving = namesIn(ctx, state, { kind: 'resolving' });
  return resolving.length > 0 ? [`Resolving: ${resolving.join(', ')}`] : [];
}

function decisionLines(ctx: EngineContext, state: GameState): string[] {
  if (state.pending.length === 0) return ['Pending decisions: none'];
  const described = state.pending.map((decision) => ({
    decision,
    text: describeDecision(ctx, state, decision),
  }));
  return [
    'Pending decisions:',
    ...described.flatMap(({ decision, text }) => {
      const repeated = described.filter((other) => other.text === text).length > 1;
      return [`  ${repeated ? subjectTag(decision) : ''}${text}`, ...suggestionLines(decision)];
    }),
  ];
}

/**
 * The instance id of a decision's subject card in brackets, which tells two
 * decisions apart that read the same, e.g. the attacks of opportunity of two
 * copies of one enemy.
 */
function subjectTag({ subject }: Decision): string {
  return subject === undefined ? '' : `[${subject}] `;
}

/**
 * The suggested values of a skill test, on a line of their own so the
 * decision line (`describeDecision`) reads the same with or without them.
 */
function suggestionLines({ suggestion }: Decision): string[] {
  if (!suggestion) return [];
  return [
    `    suggested: skill ${suggestion.skill} vs difficulty ${suggestion.difficulty} (${suggestion.outcome})`,
  ];
}

function currentCard(state: GameState, id: InstanceId | undefined): CardInstance | undefined {
  return id === undefined ? undefined : state.cards[id];
}

// A card without a definition is shown by its code, so a broken card db still prints.
function nameOf(ctx: EngineContext, card: CardInstance): string {
  return ctx.cards.get(card.code)?.name ?? card.code;
}

function labelOf(ctx: EngineContext, card: CardInstance): string {
  return `${nameOf(ctx, card)} [${card.id}]`;
}

function nameOfId(ctx: EngineContext, state: GameState, id: InstanceId): string {
  const card = state.cards[id];
  return card ? nameOf(ctx, card) : id;
}

function investigatorName(state: GameState, id: string): string {
  return state.investigators.find((investigator) => investigator.id === id)?.name ?? id;
}

function cardsIn(state: GameState, zone: Zone): CardInstance[] {
  return cardsInZone(state, zone).flatMap((id) => state.cards[id] ?? []);
}

function namesIn(ctx: EngineContext, state: GameState, zone: Zone): string[] {
  return cardsIn(state, zone).map((card) => nameOf(ctx, card));
}

function countIn(state: GameState, zone: Zone): number {
  return cardsInZone(state, zone).length;
}

function listOrNone(names: readonly string[]): string {
  return names.length > 0 ? names.join(', ') : 'none';
}
