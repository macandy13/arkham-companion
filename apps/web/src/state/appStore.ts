import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  BoardView,
  CampaignCommand,
  CampaignDefinition,
  CampaignExecuteResult,
  CampaignId,
  CampaignLog,
  CampaignSummary,
  Difficulty,
  EncounterCardView,
  EngineContext,
  GameId,
  GameState,
  GameStore,
  GameSummary,
  InvestigatorSeat,
  LoggedEvent,
  ProposedChange,
  Rejection,
  ScenarioOutcome,
  ScenarioContext,
  ResolutionId,
  ScenarioId,
} from '@arkham/engine';
import { PlayTable, campaign, campaignId as toCampaignId, emptyState } from '@arkham/engine';
import { gameActions, type GameActions } from './gameActions';
import { GameSession, startGame, type PlayStep, type SkippedEffect } from './gameSession';
import type { DrawnCard } from '../encounter/drawnCards';
import { findScenario, type ScenarioEntry } from '../scenarios/scenarioCatalog';
import { parseGameExport, serialiseGameExport } from '../storage/gameExport';

/** Everything the new game wizard has decided; input to `AppState.startScenario`. */
export interface ScenarioStart {
  /** Name shown in the game list. */
  title: string;
  /**
   * The scenario to set up (`scenario`) and its card data. Its `CardDb` must hold the seated
   * investigators' cards, since `compileSetup` takes their stats from it. The same context runs
   * the game, so the definition is given once and its reference card and modifiers come with it.
   */
  ctx: ScenarioContext;
  difficulty: Difficulty;
  /** Seeds the game's RNG; chosen by the caller because the engine never reads randomness itself. */
  seed: number;
  /** In seat order; the first one is the lead investigator. */
  investigators: readonly InvestigatorSeat[];
}

/**
 * Everything the wizard's campaign path has decided; input to `AppState.startCampaign`. The
 * `ScenarioStart` part is the first game: `ctx` is the first scenario's, and its `CardDb` also
 * gives `StartCampaign` the team's printed stats.
 */
export interface CampaignStart extends ScenarioStart {
  /** The campaign to start; its first scenario must be `ctx.scenario`. */
  definition: CampaignDefinition;
  /** Name shown in the campaign list. */
  campaignTitle: string;
}

/** The campaign on the campaign screen, as `AppState.openCampaign` loaded it. */
export interface OpenCampaign {
  campaignId: CampaignId;
  title: string;
  /** Always the result of replaying the campaign's stored event log. */
  log: CampaignLog;
  /** The campaign's games, most recently played first. */
  games: GameSummary[];
}

/**
 * One resolution of the ended game's scenario and what it would write into the campaign log
 * (`campaign.proposeResolution` for that outcome): the log changes in the order the resolution
 * lists them, then the trauma of the game's defeats.
 */
export interface ResolutionOption {
  outcome: ScenarioOutcome;
  changes: readonly ProposedChange[];
}

/**
 * What an ended game writes into its campaign log, for the players to confirm
 * (`AppState.writeResolution`): every resolution of its scenario with its changes, so the players
 * can pick another one than the game reached if they played the ending differently. A standalone
 * game has one too, shown without a log to write.
 */
export interface PendingResolution {
  /** The resolution the game ended with (`campaign.gameOutcome`), which `options` holds. */
  reached: ScenarioOutcome;
  /** The scenario's resolutions in the guide's order, then "no resolution". */
  options: readonly ResolutionOption[];
  /** The campaign the resolution writes into; absent for a standalone game. */
  campaignId?: CampaignId;
}

/** The game on the play screen, as `AppState.openGame` loaded it and `AppState.actions` keep it. */
export interface OpenGame {
  gameId: GameId;
  /** Always the result of replaying the game's stored event log. */
  state: GameState;
  /**
   * Whether the game can be played: its scenario is in the catalog, which rebuilds the rules its
   * steps run with. A game not set up yet, or one imported from a newer app, can only be shown.
   */
  playable: boolean;
  /**
   * The screen's selectors: `state` read in game language (`BoardView`), e.g. names, the doom in
   * play against the agenda's threshold, the act's clues. Only a playable game has one, since
   * reading names and thresholds needs its scenario's cards.
   */
  board?: BoardView;
  /**
   * The game's log so far and the rules that name its cards, which the log dialog tells
   * (`gameLog`). Only a playable game has one, like `board`.
   */
  log?: GameLogSource;
  /** i18n key of the scenario's name (`ScenarioEntry.nameKey`); a playable game always has one. */
  scenarioNameKey?: string;
  /**
   * True while an action or undo is queued or running. Actions act on the turn in progress and
   * the first open decision, so the screen disables them meanwhile: a second tap would hit
   * whatever is open next.
   */
  busy: boolean;
  /** Whether `actions.undo` has a step to take back; the scenario start is never taken back. */
  canUndo: boolean;
  /**
   * Whether the players are adjusting the board (`GameActions.startAdjusting`): the steps since
   * show, but are stored only on "Done", as one step.
   */
  adjusting: boolean;
  /** Why the last action was refused, until the next action or `dismissRejection`. */
  rejection?: Rejection;
  /**
   * What the last action skipped for the players to do by hand (a card it names is missing), until
   * the next action or `dismissSkippedEffects`.
   */
  skippedEffects?: readonly SkippedEffect[];
  /**
   * The encounter cards the last action drew or placed and where they went, until the next action or
   * `dismissDrawnCards`.
   */
  drawnCards?: readonly DrawnCard[];
  /**
   * The enemy whose spawn location the players are choosing on the map (`AppState.startSpawn`),
   * until they tap one or cancel.
   */
  spawning?: EncounterCardView;
  /**
   * The resolution the ended game proposes, until it is written into the campaign log. Absent
   * while the game goes on, once its campaign has moved past its scenario, and for a scenario
   * without resolutions.
   */
  resolution?: PendingResolution;
}

/**
 * A game's log (`GameSession.entries`) with when its steps were stored (`GameSession.stepTimes`)
 * and the rules it is played with (`GameSession.ctx`).
 */
export interface GameLogSource {
  readonly ctx: EngineContext;
  readonly entries: readonly LoggedEvent[];
  readonly stepTimes: ReadonlyMap<string, number>;
}

/** The open game's log as `played` holds it now. */
function logSourceOf(played: GameSession): GameLogSource {
  return { ctx: played.ctx, entries: played.entries, stepTimes: played.stepTimes };
}

/** Looks a scenario up by id; `findScenario` in the app, a stub in tests. */
export type ScenarioLookup = (id: ScenarioId) => ScenarioEntry | undefined;

/** UI-facing state: the persisted game and campaign lists plus the currently open game. */
export interface AppState {
  games: GameSummary[];
  campaigns: CampaignSummary[];
  /** Open game, if any. */
  current?: OpenGame;
  /** Open campaign, if any; `null` once `openCampaign` found no such campaign. */
  campaign?: OpenCampaign | null;
  /** Reloads the game and campaign lists from the `GameStore`. */
  refresh(): Promise<void>;
  /** Creates an empty game, reloads the list and opens it. */
  newGame(): Promise<GameId>;
  /**
   * Sets a scenario up as a new saved game (`startGame`) and opens it. Rejects with
   * `CommandRejected` for invalid scenario data before anything is stored.
   */
  startScenario(start: ScenarioStart): Promise<GameId>;
  /**
   * Starts a campaign (`StartCampaign` on a new campaign log) and sets its first scenario up from
   * that log as a new saved game of the campaign, then opens the game. Rejects with
   * `CampaignCommandRejected` for an invalid team or `CommandRejected` for invalid scenario data
   * before anything is stored.
   */
  startCampaign(start: CampaignStart): Promise<GameId>;
  openGame(gameId: GameId): Promise<void>;
  /** Loads a campaign's log and its games for the campaign screen (`campaign`). */
  openCampaign(campaignId: CampaignId): Promise<void>;
  /**
   * Writes the open game's resolution into its campaign log as one undo step
   * (`campaign.applyResolution`): `outcome` is the resolution the players read, one of
   * `current.resolution.options`, and `confirmed` the commands they kept of its changes, as they
   * edited them. Afterwards the game has no pending resolution.
   * Rejects with `CampaignCommandRejected` and writes nothing if one of them is refused, and
   * rejects for a game without a pending resolution of a campaign.
   */
  writeResolution(outcome: ScenarioOutcome, confirmed: readonly CampaignCommand[]): Promise<void>;
  /**
   * What the play screen can do to the open game (`GameActions`). Each action is stored before
   * the new state shows; a refused one stores nothing and sets `current.rejection`. Actions run
   * one after another in the order they were sent, so two quick taps never both build on the
   * same state. They reject if the open game is not `playable`.
   */
  actions: GameActions;
  /** Clears `current.rejection` once the screen has shown it. */
  dismissRejection(): void;
  /** Clears `current.skippedEffects` once the players have read them. */
  dismissSkippedEffects(): void;
  /** Clears `current.drawnCards` once the players have read them. */
  dismissDrawnCards(): void;
  /** Lets the players choose on the map where `enemy` spawns (`current.spawning`). */
  startSpawn(enemy: EncounterCardView): void;
  /** Ends choosing a spawn location, after a tap on the map or a cancel. */
  cancelSpawn(): void;
  /** Renames a saved game and reloads the list. */
  renameGame(gameId: GameId, title: string): Promise<void>;
  /** Copies a saved game under `title` and reloads the list; returns the copy's id. */
  duplicateGame(gameId: GameId, title: string): Promise<GameId>;
  /** Deletes a saved game and reloads the list; closes it if it is the open one. */
  deleteGame(gameId: GameId): Promise<void>;
  /** JSON export text of a saved game (metadata, events, `stateVersion`). Rejects for unknown games. */
  exportGame(gameId: GameId): Promise<string>;
  /**
   * Creates a saved game from export text under a new id and reloads the list.
   * Rejects with a `GameImportError` if the text is not a valid export of this or an older version.
   */
  importGame(text: string): Promise<GameId>;
}

/** The rules a game of the catalog's scenario `entry` runs with: its definition and cards. */
function contextFor(entry: ScenarioEntry): ScenarioContext {
  // Investigator cards are not needed: after setup the engine reads investigators from the state.
  return { cards: entry.cards, scenario: entry.definition };
}

/**
 * The new campaign log of `start` under `campaignId` (`StartCampaign`), with the first game's setup
 * checked against it. Pure, so it can run before anything is stored; throws
 * `CampaignCommandRejected` for an invalid team and `CommandRejected` for invalid scenario data.
 */
function startCampaignLog(start: CampaignStart, campaignId: CampaignId): CampaignExecuteResult {
  const { definition, ctx, difficulty, seed, investigators } = start;
  const command = campaign.compileStart(definition, {
    campaignId,
    difficulty,
    investigators: investigators.map((seat) => seat.code),
  });
  const result = campaign.executeCommand({ cards: ctx.cards }, campaign.createEmptyLog(), command);
  PlayTable.setUp(ctx, { campaign: result.log, seed, investigators });
  return result;
}

/**
 * The resolution `state` proposes (`PendingResolution`), if it has ended and is not yet in the
 * campaign log: `log` is its campaign's log, absent for a standalone game. A log whose current
 * scenario is another one has written this game already.
 */
function pendingResolution(
  ctx: ScenarioContext,
  state: GameState,
  log: CampaignLog | undefined,
): PendingResolution | undefined {
  const resolutions = ctx.scenario.resolutions;
  if (resolutions === undefined) return undefined;
  if (log && campaign.findCurrentScenarioId(log) !== state.meta.scenarioId) return undefined;
  const reached = campaign.gameOutcome(state);
  const outcomes: ScenarioOutcome[] = [
    ...(Object.keys(resolutions.byId) as ResolutionId[]).map((id) => ({
      kind: 'resolution' as const,
      id,
    })),
    { kind: 'noResolution' },
  ];
  const options = outcomes.flatMap((outcome) => {
    const changes = campaign.proposeResolution(ctx, state, resolutions, outcome);
    return changes ? [{ outcome, changes }] : [];
  });
  // Only a game that ended with a resolution its scenario defines has anything to propose.
  if (!options.some((option) => campaign.sameOutcome(option.outcome, reached))) return undefined;
  return { reached, options, campaignId: log?.campaignId };
}

/**
 * Builds the app store around a `GameStore`. It is a factory (not a singleton)
 * so tests can inject an in-memory database and their own scenarios; the app
 * never touches IndexedDB directly (CLAUDE.md ground rules). It plays the
 * game only through `startGame` and a `GameSession`, never by running commands itself.
 */
export function createAppStore(
  gameStore: GameStore,
  scenarios: ScenarioLookup = findScenario,
): StoreApi<AppState> {
  return createStore<AppState>((set, get) => {
    // Each step must see the state its predecessor left, so they run strictly one at a time.
    let stepQueue = Promise.resolve();
    // The table behind `current`; mutable, so it stays out of the published state.
    let session: GameSession | undefined;
    // The campaign log of `current`'s game as stored, absent for a standalone one: each step
    // that ends the game proposes its resolution against it.
    let campaignLog: CampaignLog | undefined;
    // Actions and undos sent but not finished; `current.busy` while any are.
    let unfinishedSteps = 0;

    async function open(gameId: GameId): Promise<void> {
      const loaded = await gameStore.loadGame(gameId);
      const state = loaded?.state ?? emptyState();
      const entry = loaded && scenarios(state.meta.scenarioId);
      const ctx = entry && contextFor(entry);
      session = ctx && (await GameSession.open(gameStore, gameId, ctx));
      const campaignId = loaded?.summary.campaignId;
      campaignLog = campaignId && (await gameStore.loadCampaign(campaignId))?.log;
      set({
        current: {
          gameId,
          state: session?.state ?? state,
          playable: session !== undefined,
          board: session?.board,
          log: session && logSourceOf(session),
          scenarioNameKey: entry?.nameKey,
          busy: unfinishedSteps > 0,
          canUndo: session?.canUndo ?? false,
          adjusting: false,
          resolution: session && pendingResolution(session.ctx, session.state, campaignLog),
        },
      });
    }

    /** Publishes the session's state, unless the player left the game while a write was pending. */
    function publish(played: GameSession, rejection?: Rejection): void {
      const current = get().current;
      if (current?.gameId !== played.gameId) return;
      set({
        current: {
          ...current,
          state: played.state,
          board: played.board,
          log: logSourceOf(played),
          canUndo: played.canUndo,
          adjusting: played.adjusting,
          rejection,
          skippedEffects: played.skippedEffects.length > 0 ? played.skippedEffects : undefined,
          drawnCards: played.drawnCards.length > 0 ? played.drawnCards : undefined,
          resolution: pendingResolution(played.ctx, played.state, campaignLog),
        },
      });
    }

    async function playStep(step: PlayStep): Promise<void> {
      const played = session;
      if (!played) throw new Error('No playable game is open');
      try {
        publish(played, await played.play(step));
      } catch (error) {
        // The session reloaded what is stored; show that instead of the lost step.
        publish(played);
        throw error;
      }
    }

    /** Takes back the last step, or with `toStep` every step after it (`GameSession.undoTo`). */
    async function undoStep(toStep?: string): Promise<void> {
      const played = session;
      if (!played) return;
      try {
        await (toStep === undefined ? played.undo() : played.undoTo(toStep));
      } finally {
        publish(played);
      }
    }

    /** Runs `change` on the open game's adjustment (`GameSession`) and shows the result. */
    async function adjustStep(
      change: (played: GameSession) => Promise<Rejection | undefined>,
    ): Promise<void> {
      const played = session;
      if (!played) throw new Error('No playable game is open');
      try {
        publish(played, await change(played));
      } catch (error) {
        publish(played);
        throw error;
      }
    }

    /** Queues an action or undo (`enqueue`) and keeps `current.busy` set until it has finished. */
    async function queueStep(task: () => Promise<void>): Promise<void> {
      unfinishedSteps += 1;
      showBusy();
      try {
        await enqueue(task);
      } finally {
        unfinishedSteps -= 1;
        showBusy();
      }
    }

    function showBusy(): void {
      const current = get().current;
      const busy = unfinishedSteps > 0;
      if (current && current.busy !== busy) set({ current: { ...current, busy } });
    }

    /** Puts `task` behind every step and undo sent before it; a failed one doesn't block the rest. */
    function enqueue(task: () => Promise<void>): Promise<void> {
      const run = stepQueue.then(task);
      stepQueue = run.catch((error: unknown) => {
        console.warn('A queued game task failed.', error);
      });
      return run;
    }

    return {
      games: [],
      campaigns: [],
      async refresh() {
        const [games, campaigns] = await Promise.all([
          gameStore.listGames(),
          gameStore.listCampaigns(),
        ]);
        set({ games, campaigns });
      },
      async newGame() {
        const gameId = await gameStore.createGame({});
        await get().refresh();
        await get().openGame(gameId);
        return gameId;
      },
      async startScenario({ title, ctx, difficulty, seed, investigators }) {
        const gameId = await startGame(gameStore, title, ctx, { difficulty, seed, investigators });
        await get().refresh();
        await get().openGame(gameId);
        return gameId;
      },
      async startCampaign(start) {
        // The store hands out the id, so a dry run under a stand-in id refuses a bad team or
        // scenario before an empty campaign is stored.
        startCampaignLog(start, toCampaignId('pending'));
        const campaignId = await gameStore.createCampaign({ title: start.campaignTitle });
        const { log, events } = startCampaignLog(start, campaignId);
        await gameStore.appendCampaignEvents(campaignId, events);
        const { title, ctx, seed, investigators } = start;
        const options = { campaign: log, seed, investigators };
        const gameId = await startGame(gameStore, title, ctx, options, campaignId);
        await get().refresh();
        await get().openGame(gameId);
        return gameId;
      },
      openGame(gameId) {
        return enqueue(() => open(gameId));
      },
      async openCampaign(campaignId) {
        // Forget the last campaign, so a missing one never shows while another loads.
        set({ campaign: undefined });
        const loaded = await gameStore.loadCampaign(campaignId);
        if (!loaded) {
          set({ campaign: null });
          return;
        }
        const games = (await gameStore.listGames()).filter((g) => g.campaignId === campaignId);
        set({ campaign: { campaignId, title: loaded.summary.title, log: loaded.log, games } });
      },
      writeResolution(outcome, confirmed) {
        return queueStep(async () => {
          const played = session;
          const pending = get().current?.resolution;
          const campaignId = pending?.campaignId;
          if (!played || campaignId === undefined) throw new Error('No resolution to write');
          if (!pending?.options.some((option) => campaign.sameOutcome(option.outcome, outcome)))
            throw new Error('Not one of the scenario resolutions');
          const loaded = await gameStore.loadCampaign(campaignId);
          if (!loaded) throw new Error(`Unknown campaign ${campaignId}`);
          const ctx = { cards: played.ctx.cards };
          const { log, events } = campaign.applyResolution(
            ctx,
            loaded.log,
            played.state,
            confirmed,
            outcome,
          );
          await gameStore.appendCampaignEvents(campaignId, events, loaded.summary.lastSeq);
          campaignLog = log;
          publish(played);
          await get().refresh();
        });
      },
      actions: gameActions(
        (step) => queueStep(() => playStep(step)),
        (toStep) => queueStep(() => undoStep(toStep)),
        {
          start: () =>
            queueStep(() =>
              adjustStep(async (played) => {
                played.startAdjusting();
                return undefined;
              }),
            ),
          finish: () => queueStep(() => adjustStep((played) => played.finishAdjusting())),
          cancel: () =>
            queueStep(() =>
              adjustStep(async (played) => {
                played.cancelAdjusting();
                return undefined;
              }),
            ),
        },
      ),
      dismissRejection() {
        const open = get().current;
        if (open?.rejection) set({ current: { ...open, rejection: undefined } });
      },
      dismissSkippedEffects() {
        const open = get().current;
        if (open?.skippedEffects) set({ current: { ...open, skippedEffects: undefined } });
      },
      dismissDrawnCards() {
        const open = get().current;
        if (open?.drawnCards) set({ current: { ...open, drawnCards: undefined } });
      },
      startSpawn(enemy) {
        const open = get().current;
        if (open) set({ current: { ...open, spawning: enemy } });
      },
      cancelSpawn() {
        const open = get().current;
        if (open?.spawning) set({ current: { ...open, spawning: undefined } });
      },
      async renameGame(gameId, title) {
        await gameStore.renameGame(gameId, title);
        await get().refresh();
      },
      async duplicateGame(gameId, title) {
        const copyId = await gameStore.duplicateGame(gameId, title);
        await get().refresh();
        return copyId;
      },
      async deleteGame(gameId) {
        await gameStore.deleteGame(gameId);
        if (get().current?.gameId === gameId) {
          session = undefined;
          set({ current: undefined });
        }
        await get().refresh();
      },
      async exportGame(gameId) {
        const loaded = await gameStore.loadGame(gameId);
        if (!loaded) throw new Error(`Unknown game ${gameId}`);
        const { title, createdAt } = loaded.summary;
        return serialiseGameExport(title, createdAt, await gameStore.loadEvents(gameId));
      },
      async importGame(text) {
        const gameId = await gameStore.importGame(parseGameExport(text));
        await get().refresh();
        return gameId;
      },
    };
  });
}
