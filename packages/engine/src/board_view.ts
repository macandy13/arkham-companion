import { assertNever, listIfAny, recordIfAny } from '@arkham/util';
import { isConnectionOpen, neighbours } from './board';
import { tokenObjective } from './abilities';
import {
  advanceActionOf,
  cardActionsOfferedTo,
  cluesToAdvance,
  printedActions,
  type OfferedCardAction,
  type PrintedActionView,
} from './card_actions';

export type { PrintedActionView };
import { effectiveValue } from './card_values';
import {
  cardStats,
  resolveValue,
  type CardStats,
  type CardType,
  type EngineContext,
  type LocationSymbol,
  type ScaledValue,
  type Trait,
} from './cards';
import { optionName } from './describe_decision';
import type { Command } from './commands';
import { agendaThreshold, doomInPlay, isInPlay } from './doom';
import { changesGameState, handle } from './handle';
import { enemyHealth } from './enemies';
import type { Keyword } from './keywords';
import { forcedAttackPrompt } from './forced_attacks';
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
import {
  cardName,
  type CardCode,
  type CardImagePath,
  type CardName,
  type EncounterSetCode,
  type InstanceId,
  type InvestigatorId,
  type MapId,
  type ResolutionId,
} from './ids';
import { cardsInZone, cardsOfType, currentCard } from './lookup';
import { mapLocations, type Edge, type GameMap, type GridCell } from './map';
import { attacksStillDue } from './phases';
import {
  SYMBOL_TOKENS,
  pickReferenceSide,
  type ReferenceSide,
  type SymbolToken,
  type SymbolTokenEffect,
} from './scenario';
import { NAMED_AMOUNTS } from './state';
import {
  boostedSkills,
  cluesHeldByGroup,
  clueSpenders,
  defaultCluePayments,
  requireInvestigator,
} from './investigators';
import { CommandRejected } from './rejection';
import {
  forbiddenFor,
  isRestricted,
  LOCATION_RESTRICTIONS,
  type Forbidden,
  type LocationRestriction,
} from './restrictions';
import { skillTestSuggestion, type SkillTestInput } from './skill_modifiers';
import { victoryPoints } from './victory';
import type {
  AmountRange,
  CardInstance,
  ChaosToken,
  Decision,
  Difficulty,
  GameState,
  HeldAction,
  Investigator,
  InvestigatorStatus,
  NamedAmount,
  Phase,
  PhaseStepId,
  QueuedStep,
  SkillTest,
  SkillTestKind,
  SkillTestSuggestion,
  SkillValues,
} from './state';
import {
  encounterDeck,
  encounterDiscard,
  resolvingZone,
  setAside,
  victoryDisplay,
  type Zone,
} from './zone';

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
 * their threat area, in play order; both are left out when empty, and so are
 * `doom` while there is none and `turnTaken` before their turn this round, so
 * an expectation lists only what is there. Names, not instance ids, keep an
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
  /** The printed health, which `damage` counts down from. */
  health: number;
  damage: number;
  /** The printed sanity, which `horror` counts down from. */
  sanity: number;
  horror: number;
  /** Doom on their player cards (`Investigator.doomOnPlayerCards`). */
  doom?: number;
  /** The printed willpower, intellect, combat and agility, the base of their skill tests. */
  skills: SkillValues;
  /** The lasting boosts of their skills (`Investigator.skillBoosts`), left out while there are none. */
  boosts?: Partial<SkillValues>;
  /** Their skill values with the boosts added (`boostedSkills`); the printed ones while there are none. */
  boostedSkills: SkillValues;
  /** The picture of their investigator card (`Investigator.imageSrc`), when the card data has one. */
  image?: CardImagePath;
  /** Actions left this round (`Investigator.actionsRemaining`). */
  actions: number;
  /** They have taken their turn this round (`GameMeta.turnsTaken`). */
  turnTaken?: true;
  threatArea?: CardName[];
  /** Printed names of the cards they control (`playArea` zone, e.g. Lita Chantler), left out while there are none. */
  controls?: CardName[];
  /**
   * What the cards in play forbid them, verbs by noun (`forbiddenFor`): `{ clues: ['discover',
   * 'spend'] }` under The Masked Hunter, `{ cards: ['play'] }` under Dissonant Voices. The screen
   * offers none of it; absent when nothing is forbidden.
   */
  forbidden?: Forbidden;
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
  /** Its health for this game's player count (`enemyHealth`); left out when it prints none. */
  health?: number;
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
        /** Its shroud now, constant abilities included (`effectiveValue`). */
        shroud: number;
        /**
         * The clue value its revealed side prints (`CardStats.clues`), "2 per investigator", which
         * the card draws with the clues left (`clues`) on it.
         */
        printedClues: ScaledValue;
        /**
         * The action abilities its revealed side prints ("[action] Resign."), whoever may take
         * them, in printed order, for drawing on the card; what the turn investigator may take
         * now is `BoardView.cardActions`. Absent when it prints none.
         */
        printedActions?: readonly PrintedActionView[];
      }
    | { revealed: false }
  );

/** What a `LocationView` shows on either side of the card. */
interface LocationViewBase {
  id: InstanceId;
  name: CardName;
  map: MapId;
  /** The picture of the side it shows (`CardStats.imageSrc` once revealed, else `backImageSrc`), when the card data has one. */
  image?: CardImagePath;
  /** Its connection symbol (`CardStats.symbol`), when the card data has one. */
  symbol?: LocationSymbol;
  /** The encounter set it belongs to (`CardStats.encounterCode`), whose icon its set medallion prints. */
  encounterSet?: EncounterSetCode;
  clues: number;
  doom?: number;
  investigators?: InvestigatorId[];
  cards?: CardName[];
  attachments?: CardName[];
  /**
   * What the cards in play forbid at it (`isRestricted`): moving into it (the Parlor's barrier),
   * investigating it (Locked Door). The screen offers neither; absent when nothing is forbidden.
   */
  forbidden?: LocationRestriction[];
}

/**
 * One map as the screen draws it: its locations in map order, the book layout cell of each one
 * that has a cell (`GameMap.layout`, without cells of locations that have left the map) and its
 * connections between them. An edge to a location on another map is left out, since one map's
 * drawing cannot show it, and so is a `revealedOnly` edge until both its locations are revealed.
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
 * What an enemy's card prints, for drawing it in full (`BoardView.enemyStats`): its fight and evade
 * now (constant abilities included), its attack, traits, keywords and victory points, and the
 * picture of its card. Its health and damage are on its `EnemyView`.
 */
export interface EnemyStatsView {
  /** The picture of its card (`CardStats.imageSrc`), when the card data has one. */
  image?: CardImagePath;
  /** The encounter set it belongs to (`CardStats.encounterCode`), whose icon its set medallion prints. */
  encounterSet?: EncounterSetCode;
  fight: number;
  evade: number;
  attack: { damage: number; horror: number };
  traits: readonly Trait[];
  keywords: readonly Keyword[];
  victory?: number;
}

/**
 * A card as the players pick it up to read it (`BoardView.cardsIn`): its printed name, type and
 * traits, and the pictures of its front and back when the card data has them. The card zoom shows
 * a picture and falls back to the rest without one.
 */
export interface CardFaceView {
  /** The card in play, to act on it (`BoardView.cardActions` by `cardId`). */
  id: InstanceId;
  name: CardName;
  type: CardType;
  traits: readonly Trait[];
  /** The picture of its front (`CardStats.imageSrc`). */
  image?: CardImagePath;
  /** The picture of its back (`CardStats.backImageSrc`), for a card with two sides. */
  backImage?: CardImagePath;
  /** The encounter set it belongs to (`CardStats.encounterCode`), whose icon its set medallion prints. */
  encounterSet?: EncounterSetCode;
}

/** A basic action against an enemy (`BoardView.enemyActions`). */
export type EnemyAction = 'fight' | 'evade' | 'engage';

const ENEMY_ACTIONS: readonly EnemyAction[] = ['fight', 'evade', 'engage'];

/**
 * One card action the investigator may take in their turn (`BoardView.cardActions`): the card by
 * id and printed name, the index `UseCardAction.action` takes, and its designator, which names the
 * action when it has one (Resign, Parley).
 */
export interface CardActionView extends OfferedCardAction {
  readonly card: CardName;
}

/**
 * One investigator who may pay towards a group clue cost (`BoardView.cluePayers`): the clues they
 * hold and the ones the engine's split has them pay (`defaultCluePayments`), where the players'
 * own split starts.
 */
export interface CluePayerView {
  readonly id: InvestigatorId;
  readonly name: CardName;
  /** The picture of their investigator card (`InvestigatorView.image`), when the card data has one. */
  readonly image?: CardImagePath;
  readonly clues: number;
  readonly pays: number;
}

/**
 * An enemy on a map (`MapView.enemies`) or in a threat area (`BoardView.enemiesEngagedWith`): its
 * `EnemyView` with its instance id, since those are where the players act on an enemy (drag it to
 * move or engage it, fight or evade it), and copies share a name.
 */
export type MapEnemyView = EnemyView & { id: InstanceId };

/**
 * The current agenda (`id`, to act on it), its name, the doom on the card itself and, when it has
 * one, the doom threshold for the player count. The threshold is compared with all doom in play
 * (`BoardView.doomInPlay`), not with `doom`.
 */
export interface AgendaView {
  id: InstanceId;
  name: CardName;
  /** The picture of its front, the side in play (`CardStats.imageSrc`), when the card data has one. */
  image?: CardImagePath;
  /** The encounter set it belongs to (`CardStats.encounterCode`), whose icon its title prints. */
  encounterSet?: EncounterSetCode;
  doom: number;
  threshold?: number;
}

/**
 * The current act like `AgendaView`: its name, the clue tokens on it and, when clues advance it,
 * how (`ActAdvance`).
 */
export interface ActView {
  id: InstanceId;
  name: CardName;
  /** The picture of its front, the side in play (`CardStats.imageSrc`), when the card data has one. */
  image?: CardImagePath;
  /** The encounter set it belongs to (`CardStats.encounterCode`), whose icon its title prints. */
  encounterSet?: EncounterSetCode;
  clues: number;
  advance?: ActAdvance;
}

/**
 * How clues advance the current act, with the clues it needs for the starting player count:
 * the investigators spend the clues they hold (`spendClues`, its `advanceBySpendingClues`
 * action, which the turn's investigator takes), or it advances itself once enough clues lie on it
 * (`cluesOnAct`, an objective like Disrupting the Ritual's, `whenTokensOnSelf`).
 */
export type ActAdvance =
  | { readonly kind: 'spendClues'; readonly held: number; readonly threshold: number }
  | { readonly kind: 'cluesOnAct'; readonly threshold: number };

/**
 * One open decision as the players see it: the question (`prompt`, the
 * engine's i18n key), the card it is `about`, the investigator it is `for`
 * (the one tested or attacked, who answers it), the dialog `kind`, the test of
 * a skill test, the options by readable name (`optionName`), the `labels` the
 * UI translates for the names that are not their own label (`does not provoke`
 * is `decision.doesNotProvoke`, while an investigator's name or a scenario's
 * key is), and, for options whose counts the players confirm or adjust, the
 * range of each count by option name (`counts`).
 */
export interface DecisionView {
  prompt: string;
  kind: Decision['kind'];
  /** The printed name of the card the decision is about (`Decision.subject`). */
  about?: CardName;
  /**
   * The card the dialog shows beside its question: the card the decision is about, else the
   * encounter card whose revelation asks it (`BoardView.resolving`), so a test an encounter card
   * starts shows that card too.
   */
  card?: CardFaceView;
  for?: InvestigatorId;
  test?: SkillTest;
  /** The basic action a skill test belongs to (`Decision.testKind`), which says what its pass `amount` counts. */
  action?: SkillTestKind['kind'];
  options: string[];
  labels?: Record<string, string>;
  /**
   * The counts the players confirm or adjust by option name, each with its default and limits:
   * `amount` (the clues a passed investigation discovers, the damage a passed fight deals) and
   * the named ones (`{ attack: { damage: { default: 1, min: 0 }, horror: … } }`). The answer
   * carries them as `ResolveDecision.amount` and `amounts`.
   */
  counts?: Record<string, DecisionCounts>;
  /** For an attack of opportunity, the action that provoked it and waits until the attacks are answered. */
  provokedBy?: ProvokingActionView;
}

/**
 * The action an attack of opportunity waits on (`DecisionView.provokedBy`, the queued `HeldAction`):
 * its command and, for one aimed at a card, that card's printed name (where a move goes, the
 * location investigated, the enemy engaged, the card whose action is used).
 */
export interface ProvokingActionView {
  action: HeldAction['type'];
  card?: CardName;
}

/** The counts of one option of a `DecisionView`: its `amount` and its named amounts. */
export type DecisionCounts = Partial<Record<'amount' | NamedAmount, AmountRange>>;

/**
 * One card in an encounter pile (`EncounterPilesView`): its id and code to act on it, its printed
 * name and type, the picture of its front and its victory points where it prints them.
 */
export interface EncounterCardView {
  id: InstanceId;
  code: CardCode;
  name: CardName;
  type: CardType;
  /** The picture of its front (`CardStats.imageSrc`), when the card data has one. */
  image?: CardImagePath;
  victory?: number;
}

/**
 * The encounter piles as the screen shows them (`BoardView.encounter`): how many cards are left in
 * the deck (face down, so only the count), the discard pile top first, the set-aside cards and the
 * victory display in card order.
 */
export interface EncounterPilesView {
  deckCount: number;
  discard: readonly EncounterCardView[];
  setAside: readonly EncounterCardView[];
  victoryDisplay: readonly EncounterCardView[];
}

/**
 * The side of the scenario reference card a game plays with (`BoardView.reference`): the card's
 * `code` (`ScenarioDefinition.referenceCode`, by which the screen finds its printed texts), the
 * side its `difficulty` picks (`pickReferenceSide`) and one row per symbol token that side
 * defines, in the order the card prints them (`SYMBOL_TOKENS`). The screen draws it as the
 * scenario card.
 */
export interface ReferenceView {
  code: CardCode;
  /**
   * The scenario's own encounter set, whose icon the card prints on its medallion: the current
   * agenda's (`AgendaView.encounterSet`), since a scenario's agendas, acts and reference card all
   * belong to that set.
   */
  encounterSet?: EncounterSetCode;
  difficulty: Difficulty;
  side: ReferenceSide;
  rows: readonly ReferenceRowView[];
}

/** One symbol token's row on the reference card: its printed modifier, if any, and its effect text's key. */
export interface ReferenceRowView extends SymbolTokenEffect {
  token: SymbolToken;
}

/**
 * The encounter card being resolved (`BoardView.resolving`): a drawn card waits in the `resolving`
 * zone while its revelation asks the players something. `drawnBy` is the investigator it was drawn
 * for (from its queued placement), and `keywords` its printed keywords plus surge when it gained
 * surge while resolving.
 */
export interface ResolvingCardView extends EncounterCardView {
  drawnBy?: InvestigatorId;
  keywords: readonly Keyword[];
}

/**
 * Where a card is, in the players' words (`BoardView.placeOf`): a pile, an investigator's threat
 * area, engaged with an investigator, at a location by its printed name, or attached to a card. Any
 * other zone (a deck of the act or agenda, out of the game) is `elsewhere`.
 */
export type CardPlaceView =
  | {
      kind:
        | 'encounterDeck'
        | 'encounterDiscard'
        | 'setAside'
        | 'victoryDisplay'
        | 'resolving'
        | 'elsewhere';
    }
  | { kind: 'threatArea' | 'engaged' | 'playArea'; investigator: InvestigatorId }
  | { kind: 'atLocation'; location: CardName }
  | { kind: 'attachedTo'; card: CardName };

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

  get resolution(): ResolutionId | undefined {
    return this.state.meta.resolution;
  }

  get investigators(): readonly InvestigatorView[] {
    return this.state.investigators.map((inv) => investigatorView(this.ctx, this.state, inv));
  }

  /** Enemies in play, in card order. */
  get enemies(): readonly EnemyView[] {
    return enemiesInPlay(this.ctx, this.state).map((card) => enemyView(this.ctx, this.state, card));
  }

  /**
   * The enemies engaged with `investigator`, in card order: those in their threat area, with their
   * ids, since the threat area fights and evades them.
   */
  enemiesEngagedWith(investigator: InvestigatorId): readonly MapEnemyView[] {
    return enemiesInPlay(this.ctx, this.state)
      .map((enemy) => mapEnemyView(this.ctx, this.state, enemy))
      .filter(({ engagedWith }) => engagedWith === investigator);
  }

  /**
   * The basic actions `investigator` may take against `enemy` now, in this order: fight, evade,
   * engage. Each is a dry run of its command (`handle`, the events dropped), so the screen offers
   * only what the rules allow and they stay in the engine: evade only an enemy engaged with them
   * (or a massive one at their location), fight no unengaged aloof enemy, engage none engaged
   * with them already or massive, and all of them only at their location. Whether they have an
   * action left is not asked, since a card can let them take one for free.
   */
  enemyActions(investigator: InvestigatorId, enemy: InstanceId): readonly EnemyAction[] {
    const commands: Record<EnemyAction, Command> = {
      fight: { type: 'Fight', investigatorId: investigator, enemyId: enemy },
      evade: { type: 'Evade', investigatorId: investigator, enemyId: enemy },
      engage: { type: 'EngageEnemy', investigatorId: investigator, enemyId: enemy },
    };
    return ENEMY_ACTIONS.filter((action) => {
      try {
        handle(this.ctx, this.state, commands[action]);
        return true;
      } catch (error) {
        // A refusal is the answer: the rules do not allow this action now.
        if (!(error instanceof CommandRejected)) throw error;
        return false;
      }
    });
  }

  /**
   * Who may pay a group clue cost of `required` that `first` takes the action for (the act's
   * advance, a `CardActionView.groupClues` cost): the active investigators no card forbids to spend
   * clues, in seat order, each with the clues they hold and what the engine's split has them pay
   * when the players name no payers (`first` all they can, then the others). The players change
   * the split and send it as `UseCardAction.spend`.
   */
  cluePayers(first: InvestigatorId, required: number): readonly CluePayerView[] {
    const split = defaultCluePayments(this.ctx, this.state, first, required);
    return clueSpenders(this.ctx, this.state).map((inv) => {
      const { name, image } = investigatorView(this.ctx, this.state, inv);
      const pays = split.find(({ investigatorId }) => investigatorId === inv.id)?.amount ?? 0;
      return image
        ? { id: inv.id, name, image, clues: inv.clues, pays }
        : { id: inv.id, name, clues: inv.clues, pays };
    });
  }

  /**
   * The card actions the cards in play offer `investigator` (`cardActionsOfferedTo`): a revealed
   * location's where they are, an enemy's at their location, a threat area's at its owner's
   * location, and the current agenda's and act's, leaving out an action that would change
   * nothing now (`changesGameState`: no damage for "Heal 3 damage"). They take one in their turn. The act's
   * spend-clues advance is left out: `act.advance` shows it, with the clues it counts, and
   * `PlayTable.spendCluesToAdvanceAct` takes it.
   */
  cardActions(investigator: InvestigatorId): readonly CardActionView[] {
    const inv = requireInvestigator(this.state, investigator);
    const act = currentCard(this.state, 'act');
    const advance = act === undefined ? -1 : advanceActionOf(this.ctx, act);
    return cardActionsOfferedTo(this.ctx, this.state, inv)
      .filter(({ cardId, action }) => !(cardId === act?.id && action === advance))
      .filter(({ cardId, action }) =>
        changesGameState(this.ctx, this.state, {
          type: 'UseCardAction',
          investigatorId: investigator,
          cardId,
          action,
        }),
      )
      .map((offered) => ({
        ...offered,
        card: nameOf(this.ctx, requireCard(this.state, offered.cardId)),
      }));
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

  get act(): ActView | undefined {
    return actView(this.ctx, this.state);
  }

  /** The encounter deck's count, the discard pile, the set-aside cards and the victory display. */
  get encounter(): EncounterPilesView {
    const cardsIn = (zone: Zone) =>
      cardsInZone(this.state, zone).map((id) =>
        encounterCardView(this.ctx, requireCard(this.state, id)),
      );
    return {
      deckCount: cardsInZone(this.state, encounterDeck).length,
      discard: cardsIn(encounterDiscard),
      setAside: cardsIn(setAside),
      victoryDisplay: cardsIn(victoryDisplay),
    };
  }

  /**
   * The victory points the players have earned so far: the cards in the victory display and the
   * cleared locations that print victory (`victoryPoints`), as the scenario's resolution counts them.
   */
  get victoryPoints(): number {
    return victoryPoints(this.ctx, this.state);
  }

  /** The encounter card being resolved, if a revelation waits for the players (`ResolvingCardView`). */
  get resolving(): ResolvingCardView | undefined {
    const [id] = cardsInZone(this.state, resolvingZone);
    if (id === undefined) return undefined;
    const card = requireCard(this.state, id);
    const printed = cardStats(this.ctx.cards, card.code).keywords ?? [];
    const surged = card.gainedSurge && !printed.some(({ name }) => name === 'surge');
    const placement = queuedPlacementOf(this.state, id);
    return {
      ...encounterCardView(this.ctx, card),
      ...(placement ? { drawnBy: placement.drawn.investigatorId } : {}),
      keywords: surged ? [...printed, { name: 'surge' }] : printed,
    };
  }

  /** The card `id` as the encounter piles show it, wherever it is now. */
  encounterCard(id: InstanceId): EncounterCardView {
    return encounterCardView(this.ctx, requireCard(this.state, id));
  }

  /** Where the card `id` is now (`CardPlaceView`), e.g. where a drawn encounter card went. */
  placeOf(id: InstanceId): CardPlaceView {
    const { zone } = requireCard(this.state, id);
    switch (zone.kind) {
      case 'encounterDeck':
      case 'encounterDiscard':
      case 'setAside':
      case 'victoryDisplay':
      case 'resolving':
        return { kind: zone.kind };
      case 'threatArea':
      case 'engaged':
      case 'playArea':
        return { kind: zone.kind, investigator: zone.investigatorId };
      case 'atLocation':
        return {
          kind: 'atLocation',
          location: nameOf(this.ctx, requireCard(this.state, zone.locationId)),
        };
      case 'attachedTo':
        return { kind: 'attachedTo', card: nameOf(this.ctx, requireCard(this.state, zone.hostId)) };
      case 'scenarioDeck':
      case 'outOfGame':
      case 'agendaDeck':
      case 'actDeck':
      case 'location':
        return { kind: 'elsewhere' };
      default:
        return assertNever(zone);
    }
  }

  /**
   * The scenario reference card side this game's difficulty plays with; absent on a board without
   * a scenario (`EngineContext.scenario`), which has no reference card.
   */
  get reference(): ReferenceView | undefined {
    const { scenario } = this.ctx;
    if (!scenario) return undefined;
    const { difficulty } = this.state.meta;
    const side = pickReferenceSide(difficulty);
    const effects = scenario.reference[side];
    const encounterSet = this.agenda?.encounterSet;
    return {
      code: scenario.referenceCode,
      ...(encounterSet === undefined ? {} : { encounterSet }),
      difficulty,
      side,
      rows: SYMBOL_TOKENS.flatMap((token) => {
        const effect = effects[token];
        return effect ? [{ token, ...effect }] : [];
      }),
    };
  }

  /** The chaos tokens in the bag for this scenario and difficulty, the players' to draw from. */
  get chaosBag(): readonly ChaosToken[] {
    return this.state.chaosBag;
  }

  /**
   * A skill test the players take at the table outside any decision, such as one a player card
   * asks for: the investigator's skill against the `test`'s difficulty, with the players'
   * `input` (their modifier and the tokens they drew), as `skillTestSuggestion` computes it at
   * their location. Nothing is played: the game does not change.
   */
  skillTest(
    investigator: InvestigatorId,
    test: SkillTest,
    input: SkillTestInput = {},
  ): SkillTestSuggestion {
    const { locationId } = requireInvestigator(this.state, investigator);
    return skillTestSuggestion(
      this.ctx,
      this.state,
      {
        investigatorId: investigator,
        ...test,
        ...(locationId === undefined ? {} : { locationId }),
      },
      input,
    );
  }

  /**
   * What the card of the enemy with id `enemy` prints, for its details: fight and evade as they
   * are now (constant abilities included, `effectiveValue`), the damage and horror of its attack,
   * its traits, keywords and victory points, and its picture. Kept apart from `EnemyView`, which every board read lists, since only the details
   * window needs them.
   */
  enemyStats(enemy: InstanceId): EnemyStatsView {
    const card = requireCard(this.state, enemy);
    const stats = cardStats(this.ctx.cards, card.code);
    const { damage = 0, horror = 0, imageSrc, encounterCode, victory } = stats;
    return {
      ...(imageSrc === undefined ? {} : { image: imageSrc }),
      ...(encounterCode === undefined ? {} : { encounterSet: encounterCode }),
      fight: effectiveValue(this.ctx, this.state, card, 'fight'),
      evade: effectiveValue(this.ctx, this.state, card, 'evade'),
      attack: { damage, horror },
      traits: stats.traits,
      keywords: stats.keywords ?? [],
      ...(victory === undefined ? {} : { victory }),
    };
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

  /**
   * The locations a move from `location` can go to: its open connections on every map, a one-way
   * one only from its start (`neighbours`, which the move itself checks), so the screen can
   * offer a move there.
   */
  connectedTo(location: InstanceId): readonly InstanceId[] {
    return neighbours(this.state, location);
  }

  /** The investigators at `location`, in seat order, as its `LocationView.investigators` lists them. */
  investigatorsAt(location: InstanceId): readonly InvestigatorView[] {
    return this.state.investigators
      .filter((inv) => inv.locationId === location)
      .map((inv) => investigatorView(this.ctx, this.state, inv));
  }

  /**
   * The enemies at `location`, engaged ones included, in card order, as its map lists them
   * (`MapView.enemies`), so a screen showing one location needs no map.
   */
  enemiesAt(location: InstanceId): readonly MapEnemyView[] {
    return enemiesByLocation(this.ctx, this.state, [location])[location] ?? [];
  }

  /** The location `investigator` stands at; none until setup places them. */
  locationOf(investigator: InvestigatorId): InstanceId | undefined {
    return requireInvestigator(this.state, investigator).locationId;
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
          narrowingHint(engagedWith === undefined, at === undefined),
      );
    return only;
  }

  /** The printed names of the cards in `zone`, top first. */
  namesIn(zone: Zone): CardName[] {
    return namesIn(this.ctx, this.state, zone);
  }

  /**
   * The cards in `zone` to read, in the order of `namesIn`. Kept apart from the views' name
   * lists (`InvestigatorView.threatArea`, `LocationView.attachments`), which expectations compare
   * by name, since only the card zoom needs the rest.
   */
  cardsIn(zone: Zone): readonly CardFaceView[] {
    return cardsInZone(this.state, zone).map((id) =>
      cardFaceOf(this.ctx, requireCard(this.state, id)),
    );
  }

  private error(message: string): TableError {
    return new TableError(message, formatBoard(this.ctx, this.state));
  }
}

/** The `BoardView` of `state`. */
export function boardView(ctx: EngineContext, state: GameState): BoardView {
  return new BoardView(ctx, state);
}

/**
 * How to pick one of several matching enemies: by the narrowings the selector
 * doesn't use yet, or by id once it uses both.
 */
function narrowingHint(withoutEngaged: boolean, withoutAt: boolean): string {
  const unused = [...(withoutEngaged ? ['engagedWith'] : []), ...(withoutAt ? ['at'] : [])];
  if (unused.length === 0) return 'use byId';
  return `narrow it with enemyMatching(card, { ${unused.join(', ')} }), or use byId`;
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

function cardFaceOf(ctx: EngineContext, card: CardInstance): CardFaceView {
  const { typeCode, traits, imageSrc, backImageSrc, encounterCode } = cardStats(
    ctx.cards,
    card.code,
  );
  return {
    id: card.id,
    name: nameOf(ctx, card),
    type: typeCode,
    traits,
    ...(imageSrc === undefined ? {} : { image: imageSrc }),
    ...(backImageSrc === undefined ? {} : { backImage: backImageSrc }),
    ...(encounterCode === undefined ? {} : { encounterSet: encounterCode }),
  };
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
    health: investigator.health.max,
    damage: investigator.health.damage,
    sanity: investigator.sanity.max,
    horror: investigator.sanity.horror,
    ...(investigator.doomOnPlayerCards > 0 ? { doom: investigator.doomOnPlayerCards } : {}),
    skills: investigator.skills,
    ...(investigator.skillBoosts === undefined ? {} : { boosts: investigator.skillBoosts }),
    boostedSkills: boostedSkills(investigator),
    ...(investigator.imageSrc === undefined ? {} : { image: investigator.imageSrc }),
    actions: investigator.actionsRemaining,
    ...(state.meta.turnsTaken.includes(investigator.id) ? { turnTaken: true as const } : {}),
    ...listIfAny(
      'threatArea',
      namesIn(ctx, state, { kind: 'threatArea', investigatorId: investigator.id }),
    ),
    ...listIfAny(
      'controls',
      namesIn(ctx, state, { kind: 'playArea', investigatorId: investigator.id }),
    ),
    ...recordIfAny('forbidden', forbiddenFor(ctx, state, investigator.id)),
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

function mapEnemyView(ctx: EngineContext, state: GameState, enemy: CardInstance): MapEnemyView {
  return { id: enemy.id, ...enemyView(ctx, state, enemy) };
}

function enemyView(ctx: EngineContext, state: GameState, enemy: CardInstance): EnemyView {
  const at = nameOfId(ctx, state, enemyLocation(state, enemy));
  const health = enemyHealth(cardStats(ctx.cards, enemy.code), state);
  return {
    name: nameOf(ctx, enemy),
    ...(at === undefined ? {} : { at }),
    ...(enemy.zone.kind === 'engaged' ? { engagedWith: enemy.zone.investigatorId } : {}),
    ...(health === undefined ? {} : { health }),
    ...(enemy.tokens.damage ? { damage: enemy.tokens.damage } : {}),
    ...(enemy.exhausted ? { exhausted: true as const } : {}),
  };
}

/** The clue value of a location whose card data prints none, so every revealed side has one. */
const NO_CLUES: ScaledValue = { fixed: 0, perInvestigator: 0 };

function locationView(ctx: EngineContext, state: GameState, location: CardInstance): LocationView {
  const present = state.investigators.filter((inv) => inv.locationId === location.id);
  const { imageSrc, backImageSrc, actions, symbol, clues, encounterCode } = cardStats(
    ctx.cards,
    location.code,
  );
  const image = location.faceUp ? imageSrc : backImageSrc;
  return {
    id: location.id,
    name: nameOf(ctx, location),
    map: mapOf(location),
    ...(image === undefined ? {} : { image }),
    ...(symbol === undefined ? {} : { symbol }),
    ...(encounterCode === undefined ? {} : { encounterSet: encounterCode }),
    ...(location.faceUp
      ? {
          revealed: true as const,
          shroud: effectiveValue(ctx, state, location, 'shroud'),
          printedClues: clues ?? NO_CLUES,
          ...listIfAny('printedActions', printedActions(actions ?? [])),
        }
      : { revealed: false as const }),
    clues: location.tokens.clue ?? 0,
    ...(location.tokens.doom ? { doom: location.tokens.doom } : {}),
    ...listIfAny(
      'investigators',
      present.map((inv) => inv.id),
    ),
    ...listIfAny('cards', namesIn(ctx, state, { kind: 'atLocation', locationId: location.id })),
    ...listIfAny('attachments', namesIn(ctx, state, { kind: 'attachedTo', hostId: location.id })),
    ...listIfAny(
      'forbidden',
      LOCATION_RESTRICTIONS.filter((cannot) => isRestricted(ctx, state, location, cannot)),
    ),
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
    connections: connections.filter(
      (edge) => isOnMap(edge.from) && isOnMap(edge.to) && isConnectionOpen(state, edge),
    ),
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
    (byLocation[at] ??= []).push(mapEnemyView(ctx, state, enemy));
  }
  return byLocation;
}

function mapOf({ zone, id }: CardInstance): MapId {
  if (zone.kind !== 'location') throw new RangeError(`${id} is not a location on a map`);
  return zone.mapId;
}

function agendaView(ctx: EngineContext, state: GameState): AgendaView | undefined {
  const agenda = currentCard(state, 'agenda');
  if (!agenda) return undefined;
  const { imageSrc, encounterCode } = cardStats(ctx.cards, agenda.code);
  const threshold = agendaThreshold(ctx, state, agenda);
  return {
    id: agenda.id,
    name: nameOf(ctx, agenda),
    ...(imageSrc === undefined ? {} : { image: imageSrc }),
    ...(encounterCode === undefined ? {} : { encounterSet: encounterCode }),
    doom: agenda.tokens.doom ?? 0,
    ...(threshold === undefined ? {} : { threshold }),
  };
}

function actView(ctx: EngineContext, state: GameState): ActView | undefined {
  const act = currentCard(state, 'act');
  if (!act) return undefined;
  const stats = cardStats(ctx.cards, act.code);
  const advance = actAdvance(ctx, state, stats);
  return {
    id: act.id,
    name: nameOf(ctx, act),
    ...(stats.imageSrc === undefined ? {} : { image: stats.imageSrc }),
    ...(stats.encounterCode === undefined ? {} : { encounterSet: stats.encounterCode }),
    clues: act.tokens.clue ?? 0,
    ...(advance === undefined ? {} : { advance }),
  };
}

function actAdvance(
  ctx: EngineContext,
  state: GameState,
  stats: CardStats,
): ActAdvance | undefined {
  const onAct = tokenObjective(stats, 'clue');
  if (onAct !== undefined)
    return { kind: 'cluesOnAct', threshold: resolveValue(onAct, state.meta.playerCount) };
  const spent = cluesToAdvance(stats);
  if (spent === undefined) return undefined;
  return {
    kind: 'spendClues',
    held: cluesHeldByGroup(ctx, state),
    threshold: resolveValue(spent, state.meta.playerCount),
  };
}

function decisionView(ctx: EngineContext, state: GameState, decision: Decision): DecisionView {
  const counts = Object.fromEntries(
    decision.options.flatMap((option) => {
      const ranges: DecisionCounts = {
        ...(option.amount ? { amount: option.amount } : {}),
        ...Object.fromEntries(
          NAMED_AMOUNTS.flatMap((name) => {
            const range = option.amounts?.[name];
            return range ? [[name, range]] : [];
          }),
        ),
      };
      return Object.keys(ranges).length > 0 ? [[optionName(option), ranges]] : [];
    }),
  );
  const labels = Object.fromEntries(
    decision.options.flatMap((option) => {
      const name = optionName(option);
      return name === option.label ? [] : [[name, option.label]];
    }),
  );
  const about = nameOfId(ctx, state, decision.subject);
  const [resolving] = cardsInZone(state, resolvingZone);
  const cardId = decision.subject ?? resolving;
  const card = cardId === undefined ? undefined : cardFaceOf(ctx, requireCard(state, cardId));
  const provokedBy =
    decision.prompt === forcedAttackPrompt('attackOfOpportunity')
      ? provokingAction(ctx, state)
      : undefined;
  return {
    prompt: decision.prompt,
    kind: decision.kind,
    ...(about === undefined ? {} : { about }),
    ...(card === undefined ? {} : { card }),
    ...(decision.decider.kind === 'investigator' ? { for: decision.decider.investigatorId } : {}),
    ...(decision.skillTest ? { test: decision.skillTest } : {}),
    ...(decision.testKind ? { action: decision.testKind.kind } : {}),
    options: decision.options.map(optionName),
    ...(Object.keys(labels).length > 0 ? { labels } : {}),
    ...(Object.keys(counts).length > 0 ? { counts } : {}),
    ...(provokedBy ? { provokedBy } : {}),
  };
}

/** The action held in the queue until the attacks of opportunity it provoked are answered. */
function provokingAction(ctx: EngineContext, state: GameState): ProvokingActionView | undefined {
  const held = state.meta.queue?.find(
    (step): step is Extract<QueuedStep, { kind: 'action' }> => step.kind === 'action',
  )?.command;
  if (!held) return undefined;
  const card = nameOfId(ctx, state, targetOf(state, held));
  return { action: held.type, ...(card === undefined ? {} : { card }) };
}

function targetOf(state: GameState, action: HeldAction): InstanceId | undefined {
  switch (action.type) {
    case 'MoveInvestigator':
      return action.to;
    case 'Investigate':
      return requireInvestigator(state, action.investigatorId).locationId;
    case 'EngageEnemy':
      return action.enemyId;
    case 'UseCardAction':
      return action.cardId;
    case 'GainResources':
    case 'DrawCards':
    case 'PlayCard':
      return undefined;
    default:
      return assertNever(action);
  }
}

/** The queued placement of the drawn card `id`, which names the investigator it was drawn for. */
function queuedPlacementOf(
  state: GameState,
  id: InstanceId,
): Extract<QueuedStep, { kind: 'placeDrawnCard' }> | undefined {
  return state.meta.queue?.find(
    (step): step is Extract<QueuedStep, { kind: 'placeDrawnCard' }> =>
      step.kind === 'placeDrawnCard' && step.drawn.cardId === id,
  );
}

function encounterCardView(ctx: EngineContext, card: CardInstance): EncounterCardView {
  const { name, typeCode, imageSrc, victory } = cardStats(ctx.cards, card.code);
  return {
    id: card.id,
    code: card.code,
    name: cardName(name),
    type: typeCode,
    ...(imageSrc === undefined ? {} : { image: imageSrc }),
    ...(victory === undefined ? {} : { victory }),
  };
}

function dueAttacks(ctx: EngineContext, state: GameState): DueAttackView[] {
  return attacksStillDue(ctx, state).map((attack) => ({
    enemy: nameOf(ctx, requireCard(state, attack.enemyId)),
    investigator: attack.investigatorId,
  }));
}
