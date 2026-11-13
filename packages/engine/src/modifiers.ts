import { assertNever } from '@arkham/util';
import type { BasicAction } from './action_costs';
import { cardStats, type EngineContext } from './cards';
import { cardsInPlay, hasActiveAbilities } from './doom';
import type { InvestigatorId } from './ids';
import { binds, namesCard, type CardScope, type InvestigatorScope } from './scopes';
import { boostedSkills } from './investigators';
import type {
  CardChange,
  CardInstance,
  GameState,
  Investigator,
  SkillName,
  SkillValues,
} from './state';

/** The printed values of a location a modifier may change. */
export type LocationValue = 'shroud';

/** The printed values of an enemy a modifier may change. */
export type EnemyValue = 'fight' | 'evade';

/** The printed card values a modifier may change; `effectiveValue` reads them. */
export type CardValue = LocationValue | EnemyValue;

/**
 * Raises the cost of basic actions: Frozen in Fear's "The first move, fight, or evade action you
 * perform each round costs 1 additional action" is `{ value: 'actionCost', of: 'threatArea',
 * actions: ['move', 'fight', 'evade'], first: 'eachRound', by: 1 }`; `actionCost` reads it.
 */
export interface ActionCostModifier {
  value: 'actionCost';
  of: InvestigatorScope;
  actions: readonly BasicAction[];
  /**
   * Only the first of `actions` the investigator performs each round costs more: once they have
   * counted one off this round (`GameMeta.actionsTaken`), the rest cost the usual one.
   */
  first?: 'eachRound';
  /** The additional actions it costs. */
  by: number;
}

/**
 * A constant ability that changes a number while its card is in play (`CardStats.modifiers`), as
 * card data: `{ value: 'shroud', of: 'host', by: 2 }` is Obscuring Fog, `{ value: 'willpower', of:
 * 'threatArea', by: -1 }` a treachery's "You get -1 [willpower]". Each variant ties the value
 * to what can have it, so a location scope never names an investigator. Like any constant ability
 * it holds while its card is in play, and a location's only once it is revealed
 * (`hasActiveAbilities`). `modifiersOn` is the one place that collects them.
 */
export type Modifier =
  | { value: LocationValue; of: Exclude<CardScope, 'enemiesHere' | 'eachEnemy'>; by: number }
  | { value: EnemyValue; of: CardScope; by: number }
  | { value: SkillName; of: InvestigatorScope; by: number }
  | ActionCostModifier;

/** What a modifier is applied to: a card in play or an investigator. */
export type ModifiedSubject =
  { kind: 'card'; card: CardInstance } | { kind: 'investigator'; investigatorId: InvestigatorId };

/** A modifier that applies now, with the card whose constant ability it is. */
export interface ActiveModifier {
  source: CardInstance;
  modifier: Modifier;
}

/**
 * Every modifier of the cards in play that names `subject`, of any value, so each reader filters
 * the value it needs and can say which card changed it.
 */
export function modifiersOn(
  ctx: EngineContext,
  state: GameState,
  subject: ModifiedSubject,
): readonly ActiveModifier[] {
  return cardsInPlay(state)
    .filter(hasActiveAbilities)
    .flatMap((source) =>
      (cardStats(ctx.cards, source.code).modifiers ?? [])
        .filter((modifier) => names(ctx, state, source, modifier, subject))
        .map((modifier) => ({ source, modifier })),
    );
}

/**
 * The value `value` of `card` now: the printed value (0 when the card has none) plus every
 * active modifier that names the card, never below 0 (Rules Reference, "Modifiers"). The skill
 * test handlers, the suggestion and the views all read it, so they agree.
 */
export function effectiveValue(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
  value: CardValue,
): number {
  const { printed, changes } = modifiedValue(ctx, state, card, value);
  return Math.max(
    0,
    changes.reduce((total, { by }) => total + by, printed),
  );
}

/**
 * `value` of `card` in parts: the printed value (0 when the card has none) and what each active
 * modifier naming it changes, with its card, in the order the cards are in play. A skill test
 * keeps the parts (`SkillTest.modifiedFrom`), so its trace can say which card raised the difficulty.
 */
export function modifiedValue(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
  value: CardValue,
): { printed: number; changes: CardChange[] } {
  const changes = modifiersOn(ctx, state, { kind: 'card', card })
    .filter(({ modifier }) => modifier.value === value)
    .map(({ source, modifier }) => ({ cardId: source.id, by: modifier.by }));
  return { printed: cardStats(ctx.cards, card.code)[value] ?? 0, changes };
}

/**
 * What the cards in play change `investigator`'s `skill` by, each with its card, in the order the
 * cards are in play. A skill test shows each as a step of its own (`skillTestSuggestion`).
 */
export function skillChanges(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
  skill: SkillName,
): CardChange[] {
  return modifiersOn(ctx, state, { kind: 'investigator', investigatorId: investigator })
    .filter(({ modifier }) => modifier.value === skill)
    .map(({ source, modifier }) => ({ cardId: source.id, by: modifier.by }));
}

/**
 * `investigator`'s skill values now: the printed ones with their lasting boosts
 * (`boostedSkills`) and the changes of the cards in play (`skillChanges`), never below 0 (Rules
 * Reference, "Modifiers"). What Prey compares and what the investigator card shows.
 */
export function skillValues(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): SkillValues {
  const boosted = boostedSkills(investigator);
  const value = (skill: SkillName) =>
    Math.max(
      0,
      skillChanges(ctx, state, investigator.id, skill).reduce(
        (total, { by }) => total + by,
        boosted[skill],
      ),
    );
  return {
    willpower: value('willpower'),
    intellect: value('intellect'),
    combat: value('combat'),
    agility: value('agility'),
  };
}

function names(
  ctx: EngineContext,
  state: GameState,
  source: CardInstance,
  modifier: Modifier,
  subject: ModifiedSubject,
): boolean {
  switch (modifier.value) {
    case 'shroud':
    case 'fight':
    case 'evade':
      return subject.kind === 'card' && namesCard(ctx, state, source, modifier.of, subject.card);
    case 'willpower':
    case 'intellect':
    case 'combat':
    case 'agility':
    case 'actionCost':
      return subject.kind === 'investigator' && binds(source, modifier.of, subject.investigatorId);
    default:
      return assertNever(modifier);
  }
}
