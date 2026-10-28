import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from '../cards';
import { isInPlay } from '../doom';
import { currentCard } from '../lookup';
import type { CardCode, InvestigatorCode, ResolutionId } from '../ids';
import type { CardInstance, ChaosToken, GameState, Investigator } from '../state';
import { victoryPoints } from '../victory';
import type { CampaignCommand } from './campaign_commands';
import {
  changeTrauma,
  findCurrentScenarioId,
  findTraumaFate,
  type CampaignLog,
  type CampaignResult,
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
  | 'notResigned'
  /** Everyone who resigned, the ones R3 leaves alive. */
  | 'resigned';

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
  /**
   * "… earns the Lita Chantler card": `card` for each of `to`, or with `choose`, for one of them
   * the players pick ("choose an investigator to earn …"), offered as a choice.
   */
  | {
      readonly kind: 'earnCard';
      readonly to: ResolutionTarget;
      readonly card: CardCode;
      readonly choose?: true;
    }
  | { readonly kind: 'markInsane'; readonly to: ResolutionTarget }
  /** "The investigators win!": the campaign ends with `result` (`EndCampaign`). */
  | { readonly kind: 'endCampaign'; readonly result: CampaignResult }
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
 * Where a card is when the game ends, as resolutions ask about it: `scenarioDeck` is any deck
 * of the scenario's own (The Midnight Masks' Cultist deck).
 */
export type CardPlace = 'inPlay' | 'setAside' | 'scenarioDeck' | 'victoryDisplay';

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
 * resolution awards them first. Someone the resolution kills, drives insane or
 * gives trauma up to their limit gets no further change. A defeat that reached
 * both health and sanity at once proposes a choice between 1 physical and 1
 * mental trauma, which the player makes (Rules Reference, "Trauma"). Undefined
 * while the game is still running,
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
  return withoutChangesForEliminated(game.campaign, [
    ...changes,
    ...game.investigators.flatMap(defeatTrauma),
  ]);
}

/**
 * `changes` without those for an investigator after the change that eliminates them: being
 * killed or driven insane by the resolution, or trauma that reaches their health or sanity on
 * the campaign log (Rules Reference, "Trauma"). The campaign rejects any later command for
 * them, so the proposal confirmed unchanged would fail as a whole; and being eliminated
 * outweighs the defeat trauma that follows. A standalone game has no log, so only its
 * resolution's `MarkKilled`/`MarkInsane` eliminate.
 */
function withoutChangesForEliminated(
  log: CampaignLog | undefined,
  changes: readonly ProposedChange[],
): ProposedChange[] {
  const team = new Map(log?.investigators.map((investigator) => [investigator.code, investigator]));
  const eliminated = new Set<InvestigatorCode>();
  return changes.filter((change) => {
    if (change.kind === 'choice')
      return !change.options.some((option) => 'code' in option && eliminated.has(option.code));
    if (change.kind !== 'command' || !('code' in change.command)) return true;
    const { command } = change;
    if (eliminated.has(command.code)) return false;
    if (command.type === 'MarkKilled' || command.type === 'MarkInsane')
      eliminated.add(command.code);
    const investigator = team.get(command.code);
    if (command.type === 'AddTrauma' && investigator !== undefined) {
      const traumatised = changeTrauma(investigator, command.kind, command.amount);
      team.set(command.code, traumatised);
      if (findTraumaFate(traumatised, command.kind) !== undefined) eliminated.add(command.code);
    }
    return true;
  });
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
    case 'earnCard': {
      const earns = targetCodes(game, step.to).map((code): CampaignCommand => ({
        type: 'EarnCard',
        code,
        card: step.card,
      }));
      if (!step.choose) return earns.map(command);
      return earns.length > 0 ? [{ kind: 'choice', options: earns }] : [];
    }
    case 'endCampaign':
      return [command({ type: 'EndCampaign', result: step.result })];
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
    case 'scenarioDeck':
    case 'victoryDisplay':
      return card.zone.kind === place;
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
    case 'resigned':
      return game.investigators.filter((inv) => inv.status === 'resigned');
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
