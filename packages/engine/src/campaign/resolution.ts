import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from '../cards';
import { isInPlay } from '../doom';
import { currentCard } from '../lookup';
import type { CardCode, InvestigatorCode, ResolutionId } from '../ids';
import type { CardInstance, ChaosToken, GameState, Investigator } from '../state';
import { victoryPoints } from '../victory';
import type { CampaignCommand } from './campaign_commands';
import {
  findCurrentScenarioId,
  type CampaignLog,
  type ScenarioOutcome,
  type StoryValue,
  type TraumaKind,
} from './campaign_log';
import { CampaignCommandRejected } from './campaign_rejection';
import {
  executeCommand,
  type CampaignContext,
  type CampaignExecuteResult,
} from './handle_campaign';

/** Whose campaign log entry a resolution step changes, read from the game that just ended. */
export type ResolutionTarget =
  /** Every investigator who played the scenario, defeated and resigned ones included. */
  | 'each'
  /** The lead investigator at the scenario's end. */
  | 'lead'
  /** Everyone who did not resign, e.g. The Gathering's R3: "each investigator who has not resigned is killed". */
  | 'notResigned';

/**
 * One step of a resolution as the campaign guide prints it, as data on the
 * `ScenarioDefinition`. `proposeResolution` turns the steps into campaign
 * commands for the players to confirm; only the story keys and token names
 * are entered, never the guide's text.
 */
export type ResolutionStep =
  | { readonly kind: 'record'; readonly key: string; readonly value: StoryValue }
  | { readonly kind: 'addChaosToken'; readonly token: ChaosToken }
  | { readonly kind: 'removeChaosToken'; readonly token: ChaosToken }
  /**
   * Experience: `bonus` plus, with `victoryDisplay`, the scenario's victory
   * points (`victoryPoints`), as in "each investigator earns experience equal
   * to the Victory X value of each card in the victory display".
   */
  | {
      readonly kind: 'awardXp';
      readonly to: ResolutionTarget;
      readonly bonus: number;
      readonly victoryDisplay: boolean;
    }
  | {
      readonly kind: 'addTrauma';
      readonly to: ResolutionTarget;
      readonly trauma: TraumaKind;
      readonly amount: number;
    }
  | { readonly kind: 'markKilled'; readonly to: ResolutionTarget }
  | { readonly kind: 'markInsane'; readonly to: ResolutionTarget }
  /**
   * A step about the players' own cards, which the app doesn't track (earning
   * a story asset, upgrading decks): shown for the players to do by hand.
   * `textKey` is the translation key of what to do.
   */
  | { readonly kind: 'byHand'; readonly textKey: string }
  /** `then` when the ended game answers `condition` with yes, else `otherwise`. */
  | {
      readonly kind: 'when';
      readonly condition: GameCondition;
      readonly then: readonly ResolutionStep[];
      readonly otherwise?: readonly ResolutionStep[];
    }
  /**
   * Writes the printed names of the `names` cards whose condition holds as
   * the list record `key`, as in "record the name of each unique Cultist
   * enemy in the victory display under 'Cultists We Interrogated'". Records
   * nothing when no condition holds.
   */
  | {
      readonly kind: 'recordNames';
      readonly key: string;
      readonly names: readonly { readonly code: CardCode; readonly when: GameCondition }[];
    };

/**
 * Where a card is when the game ends, as resolutions ask about it. A
 * scenario's own deck (The Midnight Masks' Cultist deck) is set aside, so
 * cards left out of it must go out of the game, not set aside.
 */
export type CardPlace = 'inPlay' | 'setAside' | 'victoryDisplay';

/** A question about the ended game that a `when` or `recordNames` step asks. */
export type GameCondition =
  /** Some copy of `code` is in one of `places`; false when the game has none. */
  | { readonly kind: 'cardIn'; readonly code: CardCode; readonly places: readonly CardPlace[] }
  /** The current agenda is one of `agendas`, as in "if it is Agenda 1" (like `AbilityCondition.currentAct`). */
  | { readonly kind: 'currentAgenda'; readonly agendas: readonly CardCode[] }
  | { readonly kind: 'anyOf'; readonly conditions: readonly GameCondition[] };

/** A scenario's resolutions, on `ScenarioDefinition.resolutions`. */
export interface ScenarioResolutions {
  /** The steps of each resolution, by the id `ScenarioEnded` records (`GameMeta.resolution`), e.g. `R1`. */
  readonly byId: Readonly<Partial<Record<ResolutionId, readonly ResolutionStep[]>>>;
  /** "If no resolution was reached": every investigator resigned or was defeated. */
  readonly none: readonly ResolutionStep[];
}

/**
 * One change `proposeResolution` proposes: a campaign command, a choice of
 * one command among `options` (the trauma of a defeat by damage and horror at
 * once), or a step the players do by hand. The players confirm or edit the
 * list, picking an option for each choice, before the commands go to
 * `handleCommand`.
 */
export type ProposedChange =
  | { readonly kind: 'command'; readonly command: CampaignCommand }
  | { readonly kind: 'choice'; readonly options: readonly CampaignCommand[] }
  | { readonly kind: 'byHand'; readonly textKey: string };

/**
 * The campaign log changes for an ended game: the steps of the resolution it
 * ended with (or of "no resolution"), then 1 physical trauma for each
 * investigator defeated by damage, 1 mental trauma for each defeated by
 * horror, and the trauma a card effect named for its defeat (Rules
 * Reference, "Trauma"). The defeat trauma comes last so that a
 * defeat which kills an investigator doesn't block the experience the
 * resolution awards them first; someone the resolution kills or drives insane
 * gets none. A defeat that reached both health and sanity at once proposes
 * a choice between 1 physical and 1 mental trauma, which the player makes
 * (Rules Reference, "Trauma"). Undefined while the game is still running,
 * or for a resolution id the scenario doesn't define.
 */
export function proposeResolution(
  ctx: EngineContext,
  game: GameState,
  resolutions: ScenarioResolutions,
): ProposedChange[] | undefined {
  if (game.meta.ended !== true) return undefined;
  const steps =
    game.meta.resolution === undefined ? resolutions.none : resolutions.byId[game.meta.resolution];
  if (steps === undefined) return undefined;
  const changes = steps.flatMap((step) => proposeStep(ctx, game, step));
  const eliminated = new Set(changes.flatMap(eliminatedCode));
  // A killed or insane investigator takes no more trauma (`AddTrauma` would be rejected), and
  // being killed by the resolution already outweighs it.
  const traumaFor = game.investigators.filter((inv) => !eliminated.has(inv.code));
  return [...changes, ...traumaFor.flatMap(defeatTrauma)];
}

function eliminatedCode(change: ProposedChange): InvestigatorCode[] {
  if (change.kind !== 'command') return [];
  const { command } = change;
  return command.type === 'MarkKilled' || command.type === 'MarkInsane' ? [command.code] : [];
}

/**
 * Writes a confirmed resolution to the campaign log in one step: the
 * commands the players confirmed (`proposeResolution`, edited as they
 * like), then `AdvanceScenario` with the game's outcome. Either every command
 * applies or the first rejection is thrown and the log stays as it was. Also
 * rejects a game that is still running (`scenarioNotEnded`) or that belongs
 * to another scenario than the campaign's current one (`notCurrentScenario`).
 */
export function applyResolution(
  ctx: CampaignContext,
  log: CampaignLog,
  game: GameState,
  confirmed: readonly CampaignCommand[],
): CampaignExecuteResult {
  if (game.meta.ended !== true) throw new CampaignCommandRejected({ code: 'scenarioNotEnded' });
  const current = findCurrentScenarioId(log);
  if (game.meta.scenarioId !== current)
    throw new CampaignCommandRejected({
      code: 'notCurrentScenario',
      scenarioId: game.meta.scenarioId,
      current,
    });
  const advance: CampaignCommand = { type: 'AdvanceScenario', outcome: outcomeOf(game) };
  return [...confirmed, advance].reduce<CampaignExecuteResult>(
    (result, command) => {
      const next = executeCommand(ctx, result.log, command);
      return { log: next.log, events: [...result.events, ...next.events] };
    },
    { log, events: [] },
  );
}

/**
 * The campaign commands of a proposal, without its by-hand steps: what
 * `applyResolution` takes when the players confirm it unchanged. A choice
 * they leave unchanged takes its first option (physical trauma for a defeat
 * by both), so no proposed trauma is lost.
 */
export function proposedCommands(changes: readonly ProposedChange[]): CampaignCommand[] {
  return changes.flatMap((change) => {
    switch (change.kind) {
      case 'command':
        return [change.command];
      case 'choice':
        return change.options.slice(0, 1);
      case 'byHand':
        return [];
      default:
        return assertNever(change);
    }
  });
}

function outcomeOf(game: GameState): ScenarioOutcome {
  return game.meta.resolution === undefined
    ? { kind: 'noResolution' }
    : { kind: 'resolution', id: game.meta.resolution };
}

function proposeStep(ctx: EngineContext, game: GameState, step: ResolutionStep): ProposedChange[] {
  switch (step.kind) {
    case 'record':
      return [command({ type: 'RecordStory', key: step.key, value: step.value })];
    case 'addChaosToken':
      return [command({ type: 'AddChaosToken', token: step.token })];
    case 'removeChaosToken':
      return [command({ type: 'RemoveChaosToken', token: step.token })];
    case 'awardXp': {
      const amount = step.bonus + (step.victoryDisplay ? victoryPoints(ctx, game) : 0);
      // `AwardXp` takes only positive amounts; earning nothing is no change to confirm.
      if (amount <= 0) return [];
      return targetCodes(game, step.to).map((code) => command({ type: 'AwardXp', code, amount }));
    }
    case 'addTrauma':
      return targetCodes(game, step.to).map((code) =>
        command({ type: 'AddTrauma', code, kind: step.trauma, amount: step.amount }),
      );
    case 'markKilled':
      return targetCodes(game, step.to).map((code) => command({ type: 'MarkKilled', code }));
    case 'markInsane':
      return targetCodes(game, step.to).map((code) => command({ type: 'MarkInsane', code }));
    case 'byHand':
      return [{ kind: 'byHand', textKey: step.textKey }];
    case 'when': {
      const steps = gameHolds(game, step.condition) ? step.then : (step.otherwise ?? []);
      return steps.flatMap((inner) => proposeStep(ctx, game, inner));
    }
    case 'recordNames': {
      const entries = step.names
        .filter(({ when }) => gameHolds(game, when))
        .map(({ code }) => cardStats(ctx.cards, code).name);
      if (entries.length === 0) return [];
      return [command({ type: 'RecordStory', key: step.key, value: { kind: 'list', entries } })];
    }
    default:
      return assertNever(step);
  }
}

/** Whether the ended `game` answers `condition` with yes. */
function gameHolds(game: GameState, condition: GameCondition): boolean {
  switch (condition.kind) {
    case 'cardIn':
      return Object.values(game.cards).some(
        (card) =>
          card.code === condition.code && condition.places.some((place) => isAt(game, card, place)),
      );
    case 'currentAgenda': {
      const agenda = currentCard(game, 'agenda');
      return agenda !== undefined && condition.agendas.includes(agenda.code);
    }
    case 'anyOf':
      return condition.conditions.some((inner) => gameHolds(game, inner));
    default:
      return assertNever(condition);
  }
}

function isAt(game: GameState, card: CardInstance, place: CardPlace): boolean {
  switch (place) {
    case 'inPlay':
      return isInPlay(game, card);
    case 'setAside':
      return card.zone.kind === 'setAside';
    case 'victoryDisplay':
      return card.zone.kind === 'victoryDisplay';
    default:
      return assertNever(place);
  }
}

function targetCodes(game: GameState, target: ResolutionTarget): InvestigatorCode[] {
  return targetInvestigators(game, target).map((investigator) => investigator.code);
}

function targetInvestigators(game: GameState, target: ResolutionTarget): Investigator[] {
  switch (target) {
    case 'each':
      return game.investigators;
    case 'lead':
      return game.investigators.filter((inv) => inv.id === game.meta.leadInvestigator);
    case 'notResigned':
      return game.investigators.filter((inv) => inv.status !== 'resigned');
    default:
      return assertNever(target);
  }
}

function defeatTrauma(investigator: Investigator): ProposedChange[] {
  const kinds = defeatTraumaKinds(investigator);
  const options = kinds.map((kind): CampaignCommand => ({
    type: 'AddTrauma',
    code: investigator.code,
    kind,
    amount: 1,
  }));
  if (options.length > 1) return [{ kind: 'choice', options }];
  return options.map(command);
}

/** The trauma kinds a defeat may cost; the player picks one when there are several. */
function defeatTraumaKinds(investigator: Investigator): TraumaKind[] {
  const { defeat } = investigator;
  if (investigator.status !== 'defeated' || defeat === undefined) return [];
  switch (defeat.cause) {
    case 'damage':
      return ['physical'];
    case 'horror':
      return ['mental'];
    case 'damageAndHorror':
      return ['physical', 'mental'];
    case 'cardEffect':
      return defeat.trauma === undefined ? [] : [defeat.trauma];
    default:
      return assertNever(defeat);
  }
}

function command(campaignCommand: CampaignCommand): ProposedChange {
  return { kind: 'command', command: campaignCommand };
}
