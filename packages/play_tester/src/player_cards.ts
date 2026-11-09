import { cardCode, cardName, type CardCode, type CardName, type SkillName } from '@arkham/engine';
import type { SeededRandom } from './run';

/** A player card class. A signature card has none: it goes only to its investigator (`only`). */
export type PlayerClass = 'guardian' | 'seeker' | 'rogue' | 'mystic' | 'survivor' | 'neutral';

/**
 * How the deck bot plays a card (player-card-analysis.md, "Effects in table terms"): the bot reads
 * this, not card text, and plays what it says through table commands (`CardEffect`). A loose
 * reading on purpose: the bot plays cards like a table would, it doesn't check their timing.
 */
export type CardUse =
  /** Fights get `bonus` and deal `damage` more on a pass, while `uses` (ammo, charges) last. */
  | {
      readonly kind: 'weapon';
      readonly bonus: number;
      readonly damage: number;
      readonly uses?: number;
      /** The skill the attack uses instead of combat (Shrivelling). */
      readonly skill?: SkillName;
    }
  /** +1 to a test of one of `skills` for each resource spent. */
  | { readonly kind: 'paidBoost'; readonly skills: readonly SkillName[] }
  /** +`bonus` to a test of `skill` while investigating, while `uses` last. */
  | {
      readonly kind: 'freeBoost';
      readonly skill: SkillName;
      readonly bonus: number;
      readonly uses?: number;
    }
  /** +1 to `skill` while in play. */
  | { readonly kind: 'lasting'; readonly skill: SkillName }
  /** Discovers `amount` clues at the location; may first draw an encounter card. */
  | { readonly kind: 'clues'; readonly amount: number; readonly drawsEncounterCard?: boolean }
  /**
   * Deals `amount` damage to an enemy at the location, and `hurtsSelf` to the investigator: a card
   * that hits everyone at a location the player picks (Dynamite Blast) is always aimed at the bot's own.
   */
  | { readonly kind: 'damage'; readonly amount: number; readonly hurtsSelf?: number }
  /** Evades an enemy engaged with the investigator, dealing it `damage`. */
  | { readonly kind: 'evade'; readonly damage?: number }
  /** Heals 1 damage or horror per use (`test`: on a passed intellect test, else 1 damage). */
  | { readonly kind: 'heal'; readonly uses: number | 'test' }
  /** Gains `amount` resources, once per round when it `exhausts`, taking `horror` each time. */
  | {
      readonly kind: 'resources';
      readonly amount: number;
      readonly uses?: number;
      readonly exhausts?: boolean;
      readonly horror?: number;
    }
  /** One more action each turn while in play. */
  | { readonly kind: 'extraAction' }
  /** Disengages from each enemy and moves to a connecting location. */
  | { readonly kind: 'escape' }
  /** +`bonus` to a test the investigator would fail. */
  | { readonly kind: 'lucky'; readonly bonus: number }
  /** A skill card: its icons go to a test, and on a pass it `adds` damage, a clue or a heal. */
  | { readonly kind: 'commit'; readonly adds?: 'damage' | 'clue' | 'heal' }
  /** Nothing the table takes: the bot only commits its icons; `doom` it places when played. */
  | { readonly kind: 'none'; readonly doom?: number }
  /** Cancels an enemy attack on the investigator, or a treachery's revelation and takes `horror`. */
  | { readonly kind: 'cancel'; readonly what: 'attack' | 'revelation'; readonly horror?: number };

/**
 * A player card as the deck bot knows it: printed cost, class and skill icons, the health and
 * sanity an ally or accessory soaks, and how the bot plays it. Entered by hand, like the test
 * scenario's cards, never card text. A signature card names its investigator (`only`).
 */
export interface PlayerCard {
  readonly code: CardCode;
  readonly name: CardName;
  readonly type: 'asset' | 'event' | 'skill';
  readonly class?: PlayerClass;
  readonly only?: CardName;
  readonly cost?: number;
  readonly fast?: boolean;
  readonly icons: Partial<Record<SkillName | 'wild', number>>;
  readonly soak?: { readonly health?: number; readonly sanity?: number };
  readonly use: CardUse;
}

/**
 * The Core Set level 0 cards the tester's investigators can take, with their signature assets
 * (player-card-analysis.md, "Cards"). Weaknesses are left out.
 */
export const PLAYER_CARDS: readonly PlayerCard[] = [
  {
    code: cardCode('01006'),
    name: cardName("Roland's .38 Special"),
    type: 'asset',
    only: cardName('Roland Banks'),
    cost: 3,
    icons: { combat: 1, agility: 1, wild: 1 },
    use: { kind: 'weapon', bonus: 1, damage: 1, uses: 4 },
  },
  {
    code: cardCode('01008'),
    name: cardName("Daisy's Tote Bag"),
    type: 'asset',
    only: cardName('Daisy Walker'),
    cost: 2,
    icons: { willpower: 1, intellect: 1, wild: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01014'),
    name: cardName("Wendy's Amulet"),
    type: 'asset',
    only: cardName('Wendy Adams'),
    cost: 2,
    icons: { wild: 2 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01016'),
    name: cardName('.45 Automatic'),
    type: 'asset',
    class: 'guardian',
    cost: 4,
    icons: { agility: 1 },
    use: { kind: 'weapon', bonus: 1, damage: 1, uses: 4 },
  },
  {
    code: cardCode('01017'),
    name: cardName('Physical Training'),
    type: 'asset',
    class: 'guardian',
    cost: 2,
    icons: { willpower: 1, combat: 1 },
    use: { kind: 'paidBoost', skills: ['willpower', 'combat'] },
  },
  {
    code: cardCode('01018'),
    name: cardName('Beat Cop'),
    type: 'asset',
    class: 'guardian',
    cost: 4,
    icons: { combat: 1 },
    soak: { health: 2, sanity: 2 },
    use: { kind: 'lasting', skill: 'combat' },
  },
  {
    code: cardCode('01019'),
    name: cardName('First Aid'),
    type: 'asset',
    class: 'guardian',
    cost: 2,
    icons: { willpower: 1 },
    use: { kind: 'heal', uses: 3 },
  },
  {
    code: cardCode('01020'),
    name: cardName('Machete'),
    type: 'asset',
    class: 'guardian',
    cost: 3,
    icons: { combat: 1 },
    use: { kind: 'weapon', bonus: 1, damage: 1 },
  },
  {
    code: cardCode('01021'),
    name: cardName('Guard Dog'),
    type: 'asset',
    class: 'guardian',
    cost: 3,
    icons: { combat: 1 },
    soak: { health: 3, sanity: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01022'),
    name: cardName('Evidence!'),
    type: 'event',
    class: 'guardian',
    cost: 1,
    fast: true,
    icons: { intellect: 2 },
    use: { kind: 'clues', amount: 1 },
  },
  {
    code: cardCode('01023'),
    name: cardName('Dodge'),
    type: 'event',
    class: 'guardian',
    cost: 1,
    fast: true,
    icons: { willpower: 1, agility: 1 },
    use: { kind: 'cancel', what: 'attack' },
  },
  {
    code: cardCode('01024'),
    name: cardName('Dynamite Blast'),
    type: 'event',
    class: 'guardian',
    cost: 5,
    icons: { willpower: 1 },
    use: { kind: 'damage', amount: 3, hurtsSelf: 3 },
  },
  {
    code: cardCode('01025'),
    name: cardName('Vicious Blow'),
    type: 'skill',
    class: 'guardian',
    icons: { combat: 1 },
    use: { kind: 'commit', adds: 'damage' },
  },
  {
    code: cardCode('01030'),
    name: cardName('Magnifying Glass'),
    type: 'asset',
    class: 'seeker',
    cost: 1,
    fast: true,
    icons: { intellect: 1 },
    use: { kind: 'freeBoost', skill: 'intellect', bonus: 1 },
  },
  {
    code: cardCode('01031'),
    name: cardName('Old Book of Lore'),
    type: 'asset',
    class: 'seeker',
    cost: 3,
    icons: { willpower: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01032'),
    name: cardName('Research Librarian'),
    type: 'asset',
    class: 'seeker',
    cost: 2,
    icons: { agility: 1 },
    soak: { health: 1, sanity: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01033'),
    name: cardName('Dr. Milan Christopher'),
    type: 'asset',
    class: 'seeker',
    cost: 4,
    icons: { intellect: 1 },
    soak: { health: 1, sanity: 2 },
    use: { kind: 'lasting', skill: 'intellect' },
  },
  {
    code: cardCode('01034'),
    name: cardName('Hyperawareness'),
    type: 'asset',
    class: 'seeker',
    cost: 2,
    icons: { intellect: 1, agility: 1 },
    use: { kind: 'paidBoost', skills: ['intellect', 'agility'] },
  },
  {
    code: cardCode('01035'),
    name: cardName('Medical Texts'),
    type: 'asset',
    class: 'seeker',
    cost: 2,
    icons: { combat: 1 },
    use: { kind: 'heal', uses: 'test' },
  },
  {
    code: cardCode('01036'),
    name: cardName('Mind over Matter'),
    type: 'event',
    class: 'seeker',
    cost: 1,
    fast: true,
    icons: { combat: 1, agility: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01037'),
    name: cardName('Working a Hunch'),
    type: 'event',
    class: 'seeker',
    cost: 2,
    fast: true,
    icons: { intellect: 2 },
    use: { kind: 'clues', amount: 1 },
  },
  {
    code: cardCode('01038'),
    name: cardName('Barricade'),
    type: 'event',
    class: 'seeker',
    cost: 0,
    icons: { willpower: 1, intellect: 1, agility: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01039'),
    name: cardName('Deduction'),
    type: 'skill',
    class: 'seeker',
    icons: { intellect: 1 },
    use: { kind: 'commit', adds: 'clue' },
  },
  {
    code: cardCode('01044'),
    name: cardName('Switchblade'),
    type: 'asset',
    class: 'rogue',
    cost: 1,
    fast: true,
    icons: { agility: 1 },
    use: { kind: 'weapon', bonus: 0, damage: 0 },
  },
  {
    code: cardCode('01045'),
    name: cardName('Burglary'),
    type: 'asset',
    class: 'rogue',
    cost: 1,
    icons: { intellect: 1 },
    use: { kind: 'resources', amount: 3, exhausts: true },
  },
  {
    code: cardCode('01046'),
    name: cardName('Pickpocketing'),
    type: 'asset',
    class: 'rogue',
    cost: 2,
    icons: { agility: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01047'),
    name: cardName('.41 Derringer'),
    type: 'asset',
    class: 'rogue',
    cost: 3,
    icons: { combat: 1 },
    use: { kind: 'weapon', bonus: 2, damage: 0, uses: 3 },
  },
  {
    code: cardCode('01048'),
    name: cardName('Leo De Luca'),
    type: 'asset',
    class: 'rogue',
    cost: 6,
    icons: { intellect: 1 },
    soak: { health: 2, sanity: 2 },
    use: { kind: 'extraAction' },
  },
  {
    code: cardCode('01049'),
    name: cardName('Hard Knocks'),
    type: 'asset',
    class: 'rogue',
    cost: 2,
    icons: { combat: 1, agility: 1 },
    use: { kind: 'paidBoost', skills: ['combat', 'agility'] },
  },
  {
    code: cardCode('01050'),
    name: cardName('Elusive'),
    type: 'event',
    class: 'rogue',
    cost: 2,
    fast: true,
    icons: { intellect: 1, agility: 1 },
    use: { kind: 'escape' },
  },
  {
    code: cardCode('01051'),
    name: cardName('Backstab'),
    type: 'event',
    class: 'rogue',
    cost: 3,
    icons: { combat: 1, agility: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01052'),
    name: cardName('Sneak Attack'),
    type: 'event',
    class: 'rogue',
    cost: 2,
    icons: { intellect: 1, combat: 1 },
    use: { kind: 'damage', amount: 2 },
  },
  {
    code: cardCode('01053'),
    name: cardName('Opportunist'),
    type: 'skill',
    class: 'rogue',
    icons: { wild: 1 },
    use: { kind: 'commit' },
  },
  {
    code: cardCode('01058'),
    name: cardName('Forbidden Knowledge'),
    type: 'asset',
    class: 'mystic',
    cost: 0,
    icons: { intellect: 1 },
    use: { kind: 'resources', amount: 1, uses: 4, horror: 1 },
  },
  {
    code: cardCode('01059'),
    name: cardName('Holy Rosary'),
    type: 'asset',
    class: 'mystic',
    cost: 2,
    icons: { willpower: 1 },
    soak: { sanity: 2 },
    use: { kind: 'lasting', skill: 'willpower' },
  },
  {
    code: cardCode('01060'),
    name: cardName('Shrivelling'),
    type: 'asset',
    class: 'mystic',
    cost: 3,
    icons: { combat: 1 },
    use: { kind: 'weapon', bonus: 0, damage: 1, uses: 4, skill: 'willpower' },
  },
  {
    code: cardCode('01061'),
    name: cardName('Scrying'),
    type: 'asset',
    class: 'mystic',
    cost: 1,
    icons: { intellect: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01062'),
    name: cardName('Arcane Studies'),
    type: 'asset',
    class: 'mystic',
    cost: 2,
    icons: { willpower: 1, intellect: 1 },
    use: { kind: 'paidBoost', skills: ['willpower', 'intellect'] },
  },
  {
    code: cardCode('01063'),
    name: cardName('Arcane Initiate'),
    type: 'asset',
    class: 'mystic',
    cost: 1,
    icons: { willpower: 1 },
    soak: { health: 1, sanity: 2 },
    use: { kind: 'none', doom: 1 },
  },
  {
    code: cardCode('01064'),
    name: cardName('Drawn to the Flame'),
    type: 'event',
    class: 'mystic',
    cost: 0,
    icons: { willpower: 1, intellect: 1 },
    use: { kind: 'clues', amount: 2, drawsEncounterCard: true },
  },
  {
    code: cardCode('01065'),
    name: cardName('Ward of Protection'),
    type: 'event',
    class: 'mystic',
    cost: 1,
    fast: true,
    icons: { wild: 1 },
    use: { kind: 'cancel', what: 'revelation', horror: 1 },
  },
  {
    code: cardCode('01066'),
    name: cardName('Blinding Light'),
    type: 'event',
    class: 'mystic',
    cost: 2,
    icons: { willpower: 1, agility: 1 },
    use: { kind: 'evade', damage: 1 },
  },
  {
    code: cardCode('01067'),
    name: cardName('Fearless'),
    type: 'skill',
    class: 'mystic',
    icons: { willpower: 1 },
    use: { kind: 'commit', adds: 'heal' },
  },
  {
    code: cardCode('01072'),
    name: cardName('Leather Coat'),
    type: 'asset',
    class: 'survivor',
    cost: 0,
    icons: { combat: 1 },
    soak: { health: 2 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01073'),
    name: cardName('Scavenging'),
    type: 'asset',
    class: 'survivor',
    cost: 1,
    icons: { intellect: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01074'),
    name: cardName('Baseball Bat'),
    type: 'asset',
    class: 'survivor',
    cost: 2,
    icons: { combat: 1 },
    use: { kind: 'weapon', bonus: 2, damage: 1 },
  },
  {
    code: cardCode('01075'),
    name: cardName("Rabbit's Foot"),
    type: 'asset',
    class: 'survivor',
    cost: 1,
    icons: { wild: 1 },
    use: { kind: 'none' },
  },
  {
    code: cardCode('01076'),
    name: cardName('Stray Cat'),
    type: 'asset',
    class: 'survivor',
    cost: 1,
    icons: { agility: 1 },
    soak: { health: 1 },
    use: { kind: 'evade' },
  },
  {
    code: cardCode('01077'),
    name: cardName('Dig Deep'),
    type: 'asset',
    class: 'survivor',
    cost: 2,
    icons: { willpower: 1, agility: 1 },
    use: { kind: 'paidBoost', skills: ['willpower', 'agility'] },
  },
  {
    code: cardCode('01078'),
    name: cardName('Cunning Distraction'),
    type: 'event',
    class: 'survivor',
    cost: 5,
    icons: { intellect: 1, wild: 1 },
    use: { kind: 'evade' },
  },
  {
    code: cardCode('01079'),
    name: cardName('"Look what I found!"'),
    type: 'event',
    class: 'survivor',
    cost: 2,
    fast: true,
    icons: { intellect: 2 },
    use: { kind: 'clues', amount: 2 },
  },
  {
    code: cardCode('01080'),
    name: cardName('Lucky!'),
    type: 'event',
    class: 'survivor',
    cost: 1,
    fast: true,
    icons: {},
    use: { kind: 'lucky', bonus: 2 },
  },
  {
    code: cardCode('01081'),
    name: cardName('Survival Instinct'),
    type: 'skill',
    class: 'survivor',
    icons: { agility: 2 },
    use: { kind: 'commit' },
  },
  {
    code: cardCode('01086'),
    name: cardName('Knife'),
    type: 'asset',
    class: 'neutral',
    cost: 1,
    icons: { combat: 1 },
    use: { kind: 'weapon', bonus: 1, damage: 0 },
  },
  {
    code: cardCode('01087'),
    name: cardName('Flashlight'),
    type: 'asset',
    class: 'neutral',
    cost: 2,
    icons: { intellect: 1 },
    use: { kind: 'freeBoost', skill: 'intellect', bonus: 2, uses: 3 },
  },
  {
    code: cardCode('01088'),
    name: cardName('Emergency Cache'),
    type: 'event',
    class: 'neutral',
    cost: 0,
    icons: {},
    use: { kind: 'resources', amount: 3 },
  },
  {
    code: cardCode('01089'),
    name: cardName('Guts'),
    type: 'skill',
    class: 'neutral',
    icons: { willpower: 2 },
    use: { kind: 'commit' },
  },
  {
    code: cardCode('01090'),
    name: cardName('Perception'),
    type: 'skill',
    class: 'neutral',
    icons: { intellect: 2 },
    use: { kind: 'commit' },
  },
  {
    code: cardCode('01091'),
    name: cardName('Overpower'),
    type: 'skill',
    class: 'neutral',
    icons: { combat: 2 },
    use: { kind: 'commit' },
  },
  {
    code: cardCode('01092'),
    name: cardName('Manual Dexterity'),
    type: 'skill',
    class: 'neutral',
    icons: { agility: 2 },
    use: { kind: 'commit' },
  },
  {
    code: cardCode('01093'),
    name: cardName('Unexpected Courage'),
    type: 'skill',
    class: 'neutral',
    icons: { wild: 2 },
    use: { kind: 'commit' },
  },
];

/** The card named `name` in `PLAYER_CARDS`; fails for a card the deck bot doesn't know. */
export function playerCard(name: CardName): PlayerCard {
  const card = PLAYER_CARDS.find((known) => known.name === name);
  if (!card) throw new Error(`the deck bot knows no player card ${name}`);
  return card;
}

/** The classes each real investigator takes cards from (level 0 only); a blank one takes `neutral`. */
const CLASSES: ReadonlyMap<CardName, readonly PlayerClass[]> = new Map([
  [cardName('Roland Banks'), ['guardian', 'seeker', 'neutral']],
  [cardName('Daisy Walker'), ['seeker', 'mystic', 'neutral']],
  [cardName('Wendy Adams'), ['survivor', 'rogue', 'neutral']],
]);

/** The cards in a deck, as at the table (Rules Reference, "Deckbuilding"). */
const DECK_SIZE = 30;

/**
 * A shuffled deck for `investigator`: their signature card plus `DECK_SIZE` cards drawn from two
 * copies of each card of their classes (all there are when fewer).
 */
export function deckFor(investigator: CardName, random: SeededRandom): PlayerCard[] {
  const classes = CLASSES.get(investigator) ?? ['neutral'];
  const signature = PLAYER_CARDS.filter(({ only }) => only === investigator);
  const pool = PLAYER_CARDS.filter((card) => card.class && classes.includes(card.class)).flatMap(
    (card) => [card, card],
  );
  return random.shuffle([...signature, ...random.shuffle(pool).slice(0, DECK_SIZE)]);
}
